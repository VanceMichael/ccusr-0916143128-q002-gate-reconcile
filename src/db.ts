import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const schema = `
CREATE TABLE IF NOT EXISTS exhibits (
  item_id TEXT PRIMARY KEY,
  declaration_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('DECLARED','INSIDE','EXITED')),
  venue TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS scan_events (
  event_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES exhibits(item_id),
  type TEXT NOT NULL CHECK (type IN ('ENTRY','MOVE','EXIT')),
  venue TEXT,
  occurred_at TEXT NOT NULL,
  applied_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scan_item ON scan_events(item_id, applied_revision);
`;

export function databasePath(): string {
  return resolve(process.env.EXHIBIT_DB_PATH ?? "exhibits.sqlite3");
}

export function openDatabase(path = databasePath()): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  return db;
}

export function migrate(path = databasePath()): void {
  const db = openDatabase(path);
  try {
    db.exec(schema);
  } finally {
    db.close();
  }
}
