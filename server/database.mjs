import { randomUUID, randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
export const databaseVersion = 3;

export function consistentBackup(db, dbPath) {
  const dir = resolve(dirname(dbPath), "backups");
  mkdirSync(dir, { recursive: true });
  const file = resolve(
    dir,
    `before-accounts-${Date.now()}-${randomUUID()}.sqlite`,
  );
  db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
  const copy = new DatabaseSync(file, { readOnly: true });
  try {
    if (copy.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw Error("備份完整性檢查失敗。");
  } finally {
    copy.close();
  }
  return file;
}
export const newLearnerCode = () =>
  `L-${randomBytes(6).toString("hex").toUpperCase()}`;
export function migrateDatabase(db, dbPath = ":memory:") {
  db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > databaseVersion)
    throw Error("資料庫版本高於本程式，拒絕降版寫入。");
  if (version === databaseVersion)
    return { from: version, to: version, backup: null };
  const existing = !!db
    .prepare("SELECT name FROM sqlite_master WHERE name='users'")
    .get();
  const backup =
    existing && dbPath !== ":memory:" && existsSync(dbPath)
      ? consistentBackup(db, dbPath)
      : null;
  db.exec("BEGIN IMMEDIATE");
  try {
    if (version < 2) {
      db.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, password TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, version TEXT NOT NULL, status TEXT NOT NULL, started_at INTEGER NOT NULL, submitted_at INTEGER, revision INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, result TEXT, rubric TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_attempt ON attempts(user_id) WHERE status='active';
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id), seq INTEGER NOT NULL, at INTEGER NOT NULL, source TEXT NOT NULL, command TEXT NOT NULL, accepted INTEGER NOT NULL, label TEXT NOT NULL, error TEXT NOT NULL, UNIQUE(attempt_id,seq));
      CREATE INDEX IF NOT EXISTS learner_history ON attempts(user_id,started_at);
      CREATE TABLE cohorts (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL);
      ALTER TABLE users ADD COLUMN learner_code TEXT;
      ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN cohort_id TEXT REFERENCES cohorts(id);
      CREATE UNIQUE INDEX unique_learner_code ON users(learner_code);
      CREATE TABLE learner_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id), version TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE account_audit (id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), target_id TEXT, action TEXT NOT NULL, at INTEGER NOT NULL, metadata TEXT NOT NULL);
      CREATE INDEX account_audit_target ON account_audit(target_id,at);
      ALTER TABLE attempts ADD COLUMN background_snapshot TEXT;
      ALTER TABLE attempts ADD COLUMN background_version TEXT;
    `);
      const update = db.prepare("UPDATE users SET learner_code=? WHERE id=?");
      for (const row of db.prepare("SELECT id FROM users").all())
        update.run(newLearnerCode(), row.id);
      db.prepare(
        "UPDATE users SET must_change_password=1 WHERE username=? AND role='administrator'",
      ).run("000029220");
    }
    db.exec(`
      CREATE TABLE invitations (
        id TEXT PRIMARY KEY, cohort_id TEXT NOT NULL REFERENCES cohorts(id),
        code_hash TEXT UNIQUE NOT NULL, code_suffix TEXT NOT NULL,
        expires_at INTEGER NOT NULL, max_uses INTEGER NOT NULL CHECK(max_uses > 0),
        used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count >= 0 AND used_count <= max_uses),
        revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
        created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL
      );
      ALTER TABLE users ADD COLUMN invitation_id TEXT REFERENCES invitations(id);
      CREATE INDEX users_invitation ON users(invitation_id);
      PRAGMA user_version=3;
      COMMIT;
    `);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { from: version, to: databaseVersion, backup };
}
