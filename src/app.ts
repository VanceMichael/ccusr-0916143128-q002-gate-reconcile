import Fastify, { FastifyInstance } from "fastify";
import { DatabaseSync } from "node:sqlite";
import { migrate, openDatabase } from "./db.js";

type ExhibitInput = { item_id: string; declaration_id: string };
type EventInput = { event_id: string; item_id: string; type: "ENTRY" | "MOVE" | "EXIT"; venue?: string; occurred_at: string };

function exhibit(db: DatabaseSync, itemId: string): Record<string, unknown> | undefined {
  return db.prepare("SELECT * FROM exhibits WHERE item_id=?").get(itemId) as Record<string, unknown> | undefined;
}

export function buildApp(path: string): FastifyInstance {
  migrate(path);
  const app = Fastify({ logger: false });
  const db = openDatabase(path);

  app.addHook("onClose", async () => db.close());

  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: ExhibitInput }>("/exhibits", async (request, reply) => {
    const body = request.body;
    if (!body?.item_id || !body?.declaration_id) return reply.code(400).send({ error: "缺少展品或申报标识" });
    try {
      db.prepare("INSERT INTO exhibits(item_id,declaration_id,state) VALUES(?,?,'DECLARED')")
        .run(body.item_id, body.declaration_id);
      return reply.code(201).send(exhibit(db, body.item_id));
    } catch {
      return reply.code(409).send({ error: "展品已登记" });
    }
  });

  app.get<{ Params: { itemId: string } }>("/exhibits/:itemId", async (request, reply) => {
    const row = exhibit(db, request.params.itemId);
    return row ?? reply.code(404).send({ error: "展品不存在" });
  });

  app.post<{ Body: EventInput }>("/events", async (request, reply) => {
    const event = request.body;
    if (!event?.event_id || !event?.item_id || !event?.occurred_at || !["ENTRY", "MOVE", "EXIT"].includes(event.type)) {
      return reply.code(400).send({ error: "扫描事件字段不完整" });
    }
    const existing = db.prepare("SELECT item_id, applied_revision FROM scan_events WHERE event_id=?").get(event.event_id) as Record<string, unknown> | undefined;
    if (existing) return reply.send({ duplicate: true, exhibit: exhibit(db, String(existing.item_id)) });
    db.exec("BEGIN IMMEDIATE");
    try {
      const current = exhibit(db, event.item_id);
      if (!current) throw new Error("展品不存在");
      const state = String(current.state);
      const valid = (event.type === "ENTRY" && state === "DECLARED" && event.venue)
        || (event.type === "MOVE" && state === "INSIDE" && event.venue)
        || (event.type === "EXIT" && state === "INSIDE");
      if (!valid) throw new Error("扫描顺序与当前状态不符");
      const nextState = event.type === "EXIT" ? "EXITED" : "INSIDE";
      const nextRevision = Number(current.revision) + 1;
      const nextVenue = event.type === "EXIT" ? null : event.venue ?? String(current.venue ?? "");
      db.prepare("UPDATE exhibits SET state=?,venue=?,revision=? WHERE item_id=?")
        .run(nextState, nextVenue, nextRevision, event.item_id);
      db.prepare("INSERT INTO scan_events(event_id,item_id,type,venue,occurred_at,applied_revision) VALUES(?,?,?,?,?,?)")
        .run(event.event_id, event.item_id, event.type, event.venue ?? null, event.occurred_at, nextRevision);
      db.exec("COMMIT");
      return reply.code(201).send({ duplicate: false, exhibit: exhibit(db, event.item_id) });
    } catch (error) {
      db.exec("ROLLBACK");
      return reply.code(409).send({ error: error instanceof Error ? error.message : "事件应用失败" });
    }
  });

  return app;
}
