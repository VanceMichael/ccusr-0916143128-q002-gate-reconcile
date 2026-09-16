import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildApp } from "../src/app.js";

test("在线扫描按业务顺序推进且重放幂等", async () => {
  const folder = mkdtempSync(join(tmpdir(), "exhibit-gate-"));
  const app = buildApp(join(folder, "test.sqlite3"));
  try {
    assert.equal((await app.inject({ method: "POST", url: "/exhibits", payload: { item_id: "EX-001", declaration_id: "D-1" } })).statusCode, 201);
    const entry = { event_id: "scan-1", item_id: "EX-001", type: "ENTRY", venue: "HALL-A", occurred_at: "2026-09-08T02:28:00Z" };
    assert.equal((await app.inject({ method: "POST", url: "/events", payload: entry })).statusCode, 201);
    const replay = await app.inject({ method: "POST", url: "/events", payload: entry });
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.json().duplicate, true);
    const move = await app.inject({ method: "POST", url: "/events", payload: { event_id: "scan-2", item_id: "EX-001", type: "MOVE", venue: "HALL-B", occurred_at: "2026-09-09T03:00:00Z" } });
    assert.equal(move.json().exhibit.revision, 2);
  } finally {
    await app.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test("出境不能先于入场", async () => {
  const folder = mkdtempSync(join(tmpdir(), "exhibit-gate-"));
  const app = buildApp(join(folder, "test.sqlite3"));
  try {
    await app.inject({ method: "POST", url: "/exhibits", payload: { item_id: "EX-002", declaration_id: "D-2" } });
    const response = await app.inject({ method: "POST", url: "/events", payload: { event_id: "scan-x", item_id: "EX-002", type: "EXIT", occurred_at: "2026-09-08T02:28:00Z" } });
    assert.equal(response.statusCode, 409);
  } finally {
    await app.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
