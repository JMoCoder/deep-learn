import { DatabaseSync } from "node:sqlite";
import { dbPath } from "../config.js";

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

export function openMemoryDb(): DatabaseSync {
  const memory = new DatabaseSync(":memory:");
  memory.exec("PRAGMA foreign_keys = ON;");
  migrate(memory);
  return memory;
}

function migrate(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_topic_id TEXT,
      current_section_id TEXT
    );

    INSERT OR IGNORE INTO app_state (id, current_topic_id, current_section_id)
    VALUES (1, NULL, NULL);

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      phase TEXT NOT NULL,
      export_state TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boundaries (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    CREATE TABLE IF NOT EXISTS outline_nodes (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      parent_id TEXT,
      title TEXT NOT NULL,
      intent TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      outline_node_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      body_md TEXT NOT NULL,
      generated_at INTEGER NOT NULL,
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      section_id TEXT,
      body TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source = 'append_note'),
      created_at INTEGER NOT NULL,
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      topic_id TEXT PRIMARY KEY,
      messages_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    CREATE TABLE IF NOT EXISTS activity_days (
      day TEXT PRIMARY KEY,
      count INTEGER NOT NULL
    );
  `);

  addColumn(database, "outline_nodes", "objective TEXT NOT NULL DEFAULT ''");
  addColumn(database, "outline_nodes", "depends_on TEXT NOT NULL DEFAULT '[]'");
  addColumn(database, "outline_nodes", "target_chars INTEGER NOT NULL DEFAULT 0");
  addColumn(database, "notes", "reason_code TEXT NOT NULL DEFAULT '1'");
  addColumn(database, "notes", "note_type TEXT NOT NULL DEFAULT '思考'");
}

function addColumn(database: DatabaseSync, table: string, definition: string): void {
  try {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/duplicate column/i.test(message)) throw error;
  }
}
