import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync, backup } from "node:sqlite";
import { createApplication } from "./index.mjs";
import { bootstrapAdministrator, hashPassword } from "./accounts.mjs";
import { consistentBackup } from "./database.mjs";
import { seedAccount, testProfile } from "./account-fixture.mjs";
import { parseAccountCsv, backgroundVersion } from "../shared/accounts.ts";
import { initialEngine } from "../shared/exam.ts";
async function fixture() {
  const path = join(
    mkdtempSync(join(tmpdir(), "labmeched-accounts-")),
    "test.sqlite",
  );
  const app = createApplication({ dbPath: path });
  await bootstrapAdministrator(app.db, {
    username: "000029220",
    password: "InitAccount9",
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  function client() {
    let cookie = "";
    return async (path, method = "GET", body) => {
      const r = await fetch(
        `http://127.0.0.1:${app.server.address().port}/api${path}`,
        {
          method,
          headers: { cookie, "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );
      if (r.headers.get("set-cookie"))
        cookie = r.headers.get("set-cookie").split(";")[0];
      return { status: r.status, body: await r.json() };
    };
  }
  const admin = client();
  await admin("/auth/login", "POST", {
    username: "000029220",
    password: "InitAccount9",
  });
  return {
    app,
    path,
    client,
    admin,
    async ready() {
      assert.equal(
        (
          await admin("/auth/change-password", "POST", {
            currentPassword: "InitAccount9",
            newPassword: "ChangedAccount9",
          })
        ).status,
        200,
      );
    },
  };
}
test("accounts require first password change and never expose a public setup endpoint or stored password", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.client()("/auth/setup", "POST", {})).status, 404);
    const status = await f.admin("/auth/status");
    assert.equal(status.body.user.mustChangePassword, true);
    assert.equal(status.body.user.password, undefined);
    assert.equal((await f.admin("/admin/users")).status, 403);
    assert.equal(
      (await f.admin("/attempts", "POST", { kind: "daily" })).status,
      403,
    );
    await f.ready();
    assert.equal((await f.admin("/admin/users")).status, 200);
    assert.equal(
      (
        await f.admin("/auth/change-password", "POST", {
          currentPassword: "ChangedAccount9",
          newPassword: "ChangedAccount9",
        })
      ).status,
      400,
    );
  } finally {
    await f.app.close();
  }
});
test("generated credentials, profile validation, ownership, frozen snapshots and disabled tasks are enforced by APIs", async () => {
  const f = await fixture();
  try {
    await f.ready();
    const cohort = (
      await f.admin("/admin/cohorts", "POST", { name: "背景快照測試班" })
    ).body.cohort;
    const created = await f.admin("/admin/users", "POST", {
      username: "00000123",
      name: "",
      cohortId: cohort.id,
    });
    assert.equal(created.status, 201);
    const u = created.body.user;
    assert.equal(u.username, "00000123");
    assert.ok(u.learnerCode);
    assert.equal(u.mustChangePassword, true);
    assert.ok(
      !f.app.db
        .prepare("SELECT password FROM users WHERE id=?")
        .get(u.id)
        .password.includes(created.body.temporaryPassword),
    );
    const learner = f.client();
    await learner("/auth/login", "POST", {
      username: u.username,
      password: created.body.temporaryPassword,
    });
    assert.equal((await learner("/me/profile")).status, 403);
    assert.equal(
      (
        await learner("/auth/change-password", "POST", {
          currentPassword: created.body.temporaryPassword,
          newPassword: "LearnerPassword9",
        })
      ).status,
      200,
    );
    assert.equal((await learner("/admin/users")).status, 403);
    assert.equal(
      (
        await learner(`/admin/users/${u.id}`, "PATCH", {
          role: "administrator",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await learner("/me/profile", "PUT", {
          ...testProfile,
          role: "administrator",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await learner("/me/profile", "PUT", {
          ...testProfile,
          usageFrequency: "偶爾",
        })
      ).status,
      400,
    );
    assert.equal(
      (await learner("/attempts", "POST", { kind: "daily" })).status,
      403,
    );
    assert.equal(
      (await learner("/me/profile", "PUT", testProfile)).status,
      200,
    );
    for (const kind of ["weekly", "biweekly"])
      assert.equal((await learner("/attempts", "POST", { kind })).status, 403);
    const started = await learner("/attempts", "POST", { kind: "daily" });
    assert.equal(started.status, 201);
    const a = started.body.attempt;
    assert.equal(a.version, "AU5800-2026-10-28-v6");
    assert.equal(a.backgroundVersion, backgroundVersion);
    assert.equal(a.backgroundSnapshot.clinicalMonths, 18);
    await f.admin(`/admin/users/${u.id}`, "PATCH", { cohortId: null });
    assert.equal(
      (await learner(`/attempts/${a.id}`)).body.attempt.backgroundSnapshot
        .cohortId,
      cohort.id,
    );
    await learner("/me/profile", "PUT", {
      ...testProfile,
      department: "血液",
      clinicalMonths: 30,
    });
    assert.equal(
      (await learner(`/attempts/${a.id}`)).body.attempt.backgroundSnapshot
        .clinicalMonths,
      18,
    );
    const otherId = await seedAccount(f.app.db, "other", "learner");
    assert.equal(
      (
        await f.admin(`/admin/users/${u.id}/profile`, "PUT", {
          ...testProfile,
          department: "鏡檢",
          clinicalMonths: 40,
        })
      ).status,
      200,
    );
    assert.equal(
      (await learner("/me/profile")).body.profile.clinicalMonths,
      40,
    );
    assert.equal(
      (await learner(`/attempts/${a.id}`)).body.attempt.backgroundSnapshot
        .clinicalMonths,
      18,
    );
    const other = f.client();
    await other("/auth/login", "POST", {
      username: "other",
      password: "Testing123!",
    });
    assert.equal((await other(`/attempts/${a.id}`)).status, 404);
    assert.equal(
      (await other(`/admin/users/${u.id}/profile`, "PUT", testProfile)).status,
      403,
    );
    assert.ok(otherId);
    await f.admin(`/admin/users/${u.id}`, "PATCH", { enabled: false });
    assert.equal((await learner("/attempts")).status, 401);
    assert.equal(
      f.app.db
        .prepare("SELECT COUNT(*) AS n FROM attempts WHERE user_id=?")
        .get(u.id).n,
      1,
    );
  } finally {
    await f.app.close();
  }
});
test("CSV preview is read-only, import is atomic, and concurrent duplicates cannot overwrite an account", async () => {
  const f = await fixture();
  try {
    await f.ready();
    await f.admin("/admin/cohorts", "POST", { name: "測試班別" });
    const rows = parseAccountCsv(
      '\uFEFFusername,name,cohort\r\n000001,"甲,乙",測試班別\r\n000002,"引號""名稱",\r\n',
    );
    assert.equal(rows[0].username, "000001");
    assert.equal(rows[0].name, "甲,乙");
    assert.throws(() =>
      parseAccountCsv("username,password,role\nabc,foo,administrator"),
    );
    assert.equal(
      (await f.admin("/admin/users/import", "POST", { rows, dryRun: true }))
        .status,
      200,
    );
    assert.equal(
      f.app.db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
      1,
    );
    const imported = await f.admin("/admin/users/import", "POST", {
      rows,
      dryRun: false,
    });
    assert.equal(imported.status, 201);
    assert.equal(imported.body.credentials.length, 2);
    const before = f.app.db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
    assert.equal(
      (
        await f.admin("/admin/users/import", "POST", {
          rows: [{ username: "unique", name: "", cohort: "" }, rows[0]],
          dryRun: false,
        })
      ).status,
      409,
    );
    assert.equal(
      f.app.db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
      before,
    );
    assert.equal(
      (
        await f.admin("/admin/users/import", "POST", {
          rows: [{ username: "valid", role: "administrator" }],
          dryRun: false,
        })
      ).status,
      400,
    );
    const both = await Promise.all(
      [1, 2].map(() =>
        f.admin("/admin/users", "POST", { username: "concurrent" }),
      ),
    );
    assert.deepEqual(both.map((x) => x.status).sort(), [201, 409]);
  } finally {
    await f.app.close();
  }
});
test("last enabled administrator is protected; password resets revoke sessions and audits contain no secrets", async () => {
  const f = await fixture();
  try {
    await f.ready();
    const adminId = (await f.admin("/auth/status")).body.user.id;
    for (const body of [{ role: "learner" }, { enabled: false }])
      assert.equal(
        (await f.admin(`/admin/users/${adminId}`, "PATCH", body)).status,
        409,
      );
    const u = (
      await f.admin("/admin/users", "POST", { username: "reset-user" })
    ).body;
    const learner = f.client();
    await learner("/auth/login", "POST", {
      username: u.user.username,
      password: u.temporaryPassword,
    });
    const reset = await f.admin(
      `/admin/users/${u.user.id}/reset-password`,
      "POST",
      {},
    );
    assert.equal(reset.status, 200);
    assert.notEqual(reset.body.temporaryPassword, u.temporaryPassword);
    assert.equal((await learner("/auth/status")).body.user, null);
    assert.equal(
      (
        await learner("/auth/login", "POST", {
          username: u.user.username,
          password: u.temporaryPassword,
        })
      ).status,
      401,
    );
    await learner("/auth/login", "POST", {
      username: u.user.username,
      password: reset.body.temporaryPassword,
    });
    assert.equal(
      (await learner("/auth/status")).body.user.mustChangePassword,
      true,
    );
    const audit = JSON.stringify((await f.admin("/admin/audit")).body);
    assert.ok(!audit.includes(reset.body.temporaryPassword));
    assert.ok(!audit.includes("ChangedAccount9"));
    assert.ok(!audit.includes("token"));
  } finally {
    await f.app.close();
  }
});
test("migration backs up v1 consistently, preserves hashes/results and restores cleanly without replaying migrations", async () => {
  const folder = mkdtempSync(join(tmpdir(), "accounts-migration-")),
    path = join(folder, "old.sqlite");
  const old = new DatabaseSync(path),
    hash = await hashPassword("LegacyPassword9");
  old.exec(
    `CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,enabled INTEGER NOT NULL,password TEXT NOT NULL,created_at INTEGER NOT NULL); CREATE TABLE attempts(id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,version TEXT,status TEXT,started_at INTEGER,submitted_at INTEGER,revision INTEGER,state TEXT,result TEXT,rubric TEXT); PRAGMA user_version=1;`,
  );
  old
    .prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)")
    .run("old-admin", "000029220", "既有管理員", "administrator", 1, hash, 1);
  const result = JSON.stringify({ score: 77, groups: [], errors: [] });
  old
    .prepare("INSERT INTO attempts VALUES(?,?,?,?,?,?,?,?,?,?,?)")
    .run(
      "old-record",
      "old-admin",
      "daily",
      "AU5800-2026-10-v1",
      "submitted",
      1,
      2,
      0,
      JSON.stringify(initialEngine("AU5800-2026-10-v1")),
      result,
      "[]",
    );
  old.close();
  let app = createApplication({ dbPath: path });
  assert.ok(app.migration.backup);
  const backupPath = app.migration.backup;
  assert.equal(
    app.db.prepare("SELECT password FROM users").get().password,
    hash,
  );
  assert.equal(
    app.db.prepare("SELECT result FROM attempts").get().result,
    result,
  );
  assert.equal(
    app.db.prepare("SELECT background_snapshot FROM attempts").get()
      .background_snapshot,
    null,
  );
  assert.equal(
    app.db.prepare("SELECT must_change_password FROM users").get()
      .must_change_password,
    1,
  );
  const id = app.db
    .prepare("SELECT learner_code FROM users")
    .get().learner_code;
  await app.close();
  app = createApplication({ dbPath: path });
  assert.equal(app.migration.backup, null);
  assert.equal(
    app.db.prepare("SELECT learner_code FROM users").get().learner_code,
    id,
  );
  const copied = consistentBackup(app.db, path);
  const cliBackup = spawnSync(
    process.execPath,
    ["scripts/database-backup.mjs"],
    { env: { ...process.env, AU5800_DB: path }, encoding: "utf8" },
  );
  assert.equal(cliBackup.status, 0, cliBackup.stderr);
  await app.close();
  const source = new DatabaseSync(copied, { readOnly: true });
  const restoredPath = join(folder, "restored.sqlite");
  await backup(source, restoredPath);
  source.close();
  const restored = new DatabaseSync(restoredPath);
  assert.equal(
    restored.prepare("PRAGMA integrity_check").get().integrity_check,
    "ok",
  );
  assert.equal(
    restored.prepare("SELECT result FROM attempts").get().result,
    result,
  );
  restored.close();
  const restoredApp = createApplication({ dbPath: restoredPath });
  assert.equal(
    restoredApp.db.prepare("SELECT result FROM attempts").get().result,
    result,
  );
  await restoredApp.close();
  const before = new DatabaseSync(backupPath, { readOnly: true });
  assert.equal(before.prepare("PRAGMA user_version").get().user_version, 1);
  assert.equal(
    before.prepare("SELECT password FROM users").get().password,
    hash,
  );
  before.close();
  const cliTarget = join(folder, "cli-restored.sqlite");
  const cli = spawnSync(
    process.execPath,
    ["scripts/database-restore.mjs", copied, cliTarget],
    { encoding: "utf8" },
  );
  assert.equal(cli.status, 0, cli.stderr);
  const cliRestored = createApplication({ dbPath: cliTarget });
  assert.equal(
    cliRestored.db.prepare("SELECT result FROM attempts").get().result,
    result,
  );
  await cliRestored.close();
});
test("closed weekly attempts remain readable and abandonable but cannot advance, receive events or be submitted", async () => {
  const f = await fixture();
  try {
    await f.ready();
    const id = (await f.admin("/auth/status")).body.user.id;
    const state = JSON.stringify(initialEngine("AU5800-weekly-2026-10-27-v3"));
    f.app.db
      .prepare(
        "INSERT INTO attempts(id,user_id,kind,version,status,started_at,revision,state,rubric) VALUES(?,?,'weekly',?,'active',?,0,?,'[]')",
      )
      .run(
        "closed-attempt",
        id,
        "AU5800-weekly-2026-10-27-v3",
        Date.now(),
        state,
      );
    const loaded = await f.admin("/attempts/closed-attempt");
    assert.equal(loaded.status, 200);
    assert.equal(loaded.body.attempt.readOnly, true);
    for (const operation of ["events", "submit"])
      assert.equal(
        (
          await f.admin(`/attempts/closed-attempt/${operation}`, "POST", {
            revision: 0,
          })
        ).status,
        403,
      );
    assert.equal(
      f.app.db.prepare("SELECT state FROM attempts").get().state,
      state,
    );
    assert.equal(
      f.app.db.prepare("SELECT COUNT(*) AS n FROM events").get().n,
      0,
    );
    assert.equal(
      (await f.admin("/attempts/closed-attempt/abandon", "POST", {})).status,
      200,
    );
  } finally {
    await f.app.close();
  }
});
test("concurrent administrator demotions cannot remove every enabled administrator", async () => {
  const f = await fixture();
  try {
    await f.ready();
    const first = (await f.admin("/auth/status")).body.user.id;
    const second = await seedAccount(f.app.db, "second-admin", "administrator");
    const other = f.client();
    await other("/auth/login", "POST", {
      username: "second-admin",
      password: "Testing123!",
    });
    await Promise.all([
      f.admin(`/admin/users/${second}`, "PATCH", { role: "learner" }),
      other(`/admin/users/${first}`, "PATCH", { role: "learner" }),
    ]);
    assert.equal(
      f.app.db
        .prepare(
          "SELECT COUNT(*) AS n FROM users WHERE role='administrator' AND enabled=1",
        )
        .get().n,
      1,
    );
  } finally {
    await f.app.close();
  }
});
