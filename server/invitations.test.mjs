import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { createApplication } from "./index.mjs";
import {
  createAccountService,
  hashPassword,
  verifyPassword,
} from "./accounts.mjs";
import { seedAccount, testProfile } from "./account-fixture.mjs";
import { createRegistrationGuard } from "./registration-limits.mjs";

async function fixture() {
  const app = createApplication({ dbPath: ":memory:" });
  await seedAccount(app.db, "invite-admin");
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  function client() {
    let cookie = "";
    return async (path, method = "GET", body, headers = {}) => {
      const response = await fetch(base + path, {
        method,
        headers: { "Content-Type": "application/json", cookie, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.headers.get("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      return {
        status: response.status,
        body: await response.json(),
        cookie,
        headers: response.headers,
      };
    };
  }
  const admin = client();
  assert.equal(
    (
      await admin("/auth/login", "POST", {
        username: "invite-admin",
        password: "Testing123!",
      })
    ).status,
    200,
  );
  const cohort = (
    await admin("/admin/cohorts", "POST", { name: "邀請註冊驗證班" })
  ).body.cohort;
  const invite = async (settings = {}) => {
    const r = await admin("/admin/invitations", "POST", {
      cohortId: cohort.id,
      expiresAt: Date.now() + 86400000,
      maxUses: 30,
      ...settings,
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body;
  };
  const body = (code, username = "new-learner") => ({
    inviteCode: code,
    username,
    password: "LearnerSecret9",
  });
  return { app, client, admin, cohort, invite, body };
}

test("invited registration joins only its course, logs in immediately and keeps admin account controls", async () => {
  const f = await fixture();
  try {
    const { code, invitation } = await f.invite();
    const student = f.client();
    const r = await student("/auth/register", "POST", f.body(code));
    assert.equal(r.status, 201);
    assert.match(r.cookie, /^au5800_session=/);
    assert.equal(r.body.user.role, "learner");
    assert.equal(r.body.user.cohortId, f.cohort.id);
    assert.equal(r.body.user.invitationId, invitation.id);
    assert.equal(r.body.user.mustChangePassword, false);
    assert.equal(r.body.user.profileComplete, false);
    assert.equal(
      (await student("/me/profile", "PUT", testProfile)).status,
      200,
    );
    assert.equal(
      (await student("/auth/status")).body.user.profileComplete,
      true,
    );
    assert.equal((await student("/admin/invitations")).status, 403);
    const stored = f.app.db
      .prepare("SELECT * FROM users WHERE id=?")
      .get(r.body.user.id);
    assert.ok(await verifyPassword("LearnerSecret9", stored.password));
    assert.notEqual(stored.password, "LearnerSecret9");
    const listed = await f.admin("/admin/invitations");
    assert.equal(listed.body.invitations[0].usedCount, 1);
    assert.equal(listed.body.invitations[0].codeSuffix, code.slice(-4));
    assert.ok(!JSON.stringify(listed.body).includes(code));
    const row = f.app.db.prepare("SELECT * FROM invitations").get();
    assert.equal(
      row.code_hash,
      createHash("sha256").update(code).digest("hex"),
    );
    const audit = JSON.stringify(
      f.app.db.prepare("SELECT * FROM account_audit").all(),
    );
    assert.ok(!audit.includes(code));
    assert.ok(!audit.includes("LearnerSecret9"));
    const id = r.body.user.id;
    assert.equal(
      (await f.admin(`/admin/users/${id}/reset-password`, "POST", {})).status,
      200,
    );
    assert.equal((await student("/me/profile")).status, 401);
    assert.equal(
      (await f.admin(`/admin/users/${id}`, "PATCH", { enabled: false })).status,
      200,
    );
    assert.equal(
      (await f.admin("/admin/invitations")).body.invitations[0].usedCount,
      1,
    );
  } finally {
    await f.app.close();
  }
});

test("invalid registrations never consume seats and cannot choose roles or courses", async () => {
  const f = await fixture();
  try {
    const { code, invitation } = await f.invite();
    for (const invalid of [
      { ...f.body(code), role: "administrator" },
      { ...f.body(code), enabled: true },
      { ...f.body(code), cohortId: f.cohort.id },
      { ...f.body(code), password: "short" },
      { ...f.body(code), username: "!" },
      f.body("bad"),
      f.body("A".repeat(22)),
    ])
      assert.ok(
        (await f.client()("/auth/register", "POST", invalid)).status >= 400,
      );
    assert.equal(
      (
        await f.client()("/auth/register", "POST", f.body(code), {
          Origin: "https://attacker.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (await f.admin("/admin/invitations")).body.invitations[0].usedCount,
      0,
    );
    assert.equal(
      (await f.client()("/auth/register", "POST", f.body(code))).status,
      201,
    );
    assert.equal(
      (await f.client()("/auth/register", "POST", f.body(code, "NEW-LEARNER")))
        .status,
      409,
    );
    assert.equal(
      (
        await f.admin(`/admin/invitations/${invitation.id}`, "PATCH", {
          maxUses: 0,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.admin(`/admin/invitations/${invitation.id}`, "PATCH", {
          maxUses: null,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.admin(`/admin/invitations/${invitation.id}`, "PATCH", {
          maxUses: 1,
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.client()("/auth/register", "POST", f.body(code, "no-room")))
        .status,
      409,
    );
    assert.equal(
      (
        await f.admin(`/admin/invitations/${invitation.id}`, "PATCH", {
          maxUses: 3,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.admin(`/admin/invitations/${invitation.id}`, "PATCH", {
          revoked: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.client()("/auth/register", "POST", f.body(code, "revoked")))
        .status,
      400,
    );
    assert.equal(
      (
        await f.admin(`/admin/invitations/${invitation.id}`, "PATCH", {
          revoked: false,
        })
      ).status,
      400,
    );
    assert.equal(
      (await f.admin("/admin/invitations")).body.invitations[0].usedCount,
      1,
    );
    const expired = await f.invite();
    f.app.db
      .prepare("UPDATE invitations SET expires_at=? WHERE id=?")
      .run(Date.now() - 1, expired.invitation.id);
    assert.match(
      (
        await f.client()(
          "/auth/register",
          "POST",
          f.body(expired.code, "expired"),
        )
      ).body.message,
      /過期/,
    );
    assert.equal((await f.client()("/admin/invitations")).status, 401);
    f.app.db
      .prepare("UPDATE users SET enabled=0 WHERE role='administrator'")
      .run();
    assert.equal(
      (await f.client()("/auth/register", "POST", f.body(code, "no-admin")))
        .status,
      403,
    );
  } finally {
    await f.app.close();
  }
});

test("thirty participants sharing one socket source register together without lost seats or errors", async () => {
  const f = await fixture();
  try {
    const { code, invitation } = await f.invite();
    const before = process.memoryUsage().rss;
    let peak = before;
    const timer = setInterval(() => {
      peak = Math.max(peak, process.memoryUsage().rss);
    }, 5);
    const start = performance.now();
    let responses;
    try {
      responses = await Promise.all(
        Array.from({ length: 30 }, (_, i) =>
          f.client()("/auth/register", "POST", f.body(code, `class-${i}`)),
        ),
      );
    } finally {
      clearInterval(timer);
    }
    assert.deepEqual(
      responses.map((r) => r.status),
      Array(30).fill(201),
    );
    assert.equal(new Set(responses.map((r) => r.body.user.id)).size, 30);
    assert.ok(responses.every((r) => r.body.user.cohortId === f.cohort.id));
    assert.equal(
      f.app.db
        .prepare("SELECT used_count FROM invitations WHERE id=?")
        .get(invitation.id).used_count,
      30,
    );
    console.log(
      `30 parallel registrations: ${Math.round(performance.now() - start)} ms; peak RSS ${Math.round(peak / 1048576)} MB, increase ${Math.round((peak - before) / 1048576)} MB (local test process)`,
    );
  } finally {
    await f.app.close();
  }
});

test("last-seat and duplicate-account races create only one account and consume one seat", async () => {
  const f = await fixture();
  try {
    for (const duplicate of [false, true]) {
      const { code, invitation } = await f.invite({
        maxUses: duplicate ? 30 : 1,
      });
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          f.client()(
            "/auth/register",
            "POST",
            f.body(code, duplicate ? "same-name" : `last-seat-${i}`),
          ),
        ),
      );
      assert.equal(results.filter((r) => r.status === 201).length, 1);
      assert.ok(results.every((r) => [201, 409].includes(r.status)));
      assert.equal(
        f.app.db
          .prepare("SELECT used_count FROM invitations WHERE id=?")
          .get(invitation.id).used_count,
        1,
      );
    }
  } finally {
    await f.app.close();
  }
});

test("revocation and expiry during password hashing are rechecked inside the registration transaction", async () => {
  const f = await fixture();
  try {
    for (const revoke of [true, false]) {
      const { code, invitation } = await f.invite();
      let entered, release;
      const started = new Promise((r) => {
        entered = r;
      });
      const gate = new Promise((r) => {
        release = r;
      });
      const service = createAccountService(f.app.db, {
        registrationHash: async (password) => {
          entered();
          await gate;
          return hashPassword(password);
        },
      });
      const registration = service.register({
        req: { socket: { remoteAddress: "test" } },
        bodyOf: async () =>
          f.body(code, revoke ? "revoked-during-hash" : "expired-during-hash"),
        send: () => assert.fail("registration must not succeed"),
        issueSession: () => assert.fail("must not log in"),
      });
      await started;
      if (revoke)
        await f.admin(`/admin/invitations/${invitation.id}`, "PATCH", {
          revoked: true,
        });
      else
        f.app.db
          .prepare("UPDATE invitations SET expires_at=? WHERE id=?")
          .run(Date.now() - 1, invitation.id);
      release();
      await assert.rejects(registration, /停用|過期/);
      assert.equal(
        f.app.db
          .prepare("SELECT used_count FROM invitations WHERE id=?")
          .get(invitation.id).used_count,
        0,
      );
    }
  } finally {
    await f.app.close();
  }
});

test("registration guard bounds rate, source retention and hashing queue", async () => {
  let now = 0;
  const guard = createRegistrationGuard({ now: () => now });
  for (let i = 0; i < 60; i++) guard.check("shared-ip");
  assert.throws(() => guard.check("shared-ip"), /此連線來源/);
  for (let i = 0; i < 59; i++) guard.check(`source-${i}`);
  assert.throws(() => guard.check("another-source"), /過於頻繁/);
  now = 60000;
  guard.check("shared-ip");
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  let active = 0,
    peak = 0;
  const job = async () => {
    peak = Math.max(peak, ++active);
    await gate;
    active--;
  };
  const jobs = Array.from({ length: 32 }, () => guard.run(job));
  await assert.rejects(
    guard.run(job),
    (e) => e.status === 503 && e.retryAfter === 60,
  );
  release();
  await Promise.all(jobs);
  assert.equal(peak, 2);
});

test("forwarding headers cannot bypass the socket-source registration limit", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 60; i++) {
      const response = await f.client()("/auth/register", "POST", f.body("A".repeat(22)), { "X-Forwarded-For": `192.0.2.${i + 1}` });
      assert.equal(response.status, 400);
    }
    const limited = await f.client()("/auth/register", "POST", f.body("A".repeat(22)), { "X-Forwarded-For": "203.0.113.1" });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.equal(f.app.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='learner'").get().n, 0);
  } finally { await f.app.close(); }
});

test("v2 migration backs up data and preserves credentials, cohorts, snapshots and restore compatibility", async () => {
  const directory = mkdtempSync(join(tmpdir(), "invite-migrate-"));
  const path = join(directory, "test.sqlite");
  let app = createApplication({ dbPath: path });
  const userId = await seedAccount(app.db, "old-account");
  const before = app.db
    .prepare(
      "SELECT password,learner_code,must_change_password FROM users WHERE id=?",
    )
    .get(userId);
  // Reconstruct an authentic v2 database by removing v3/v4 additions.
  app.db.exec(
    "DROP TABLE practice_events; DROP TABLE practice_sessions; DROP TABLE training_activity; DROP TABLE training_leases; ALTER TABLE events DROP COLUMN diagnostic; ALTER TABLE attempts DROP COLUMN analytics_participant; DROP INDEX users_invitation; ALTER TABLE users DROP COLUMN invitation_id; DROP TABLE invitations; PRAGMA user_version=2;",
  );
  app.db
    .prepare("INSERT INTO cohorts VALUES(?,?,?)")
    .run("retained-course", "既有課程", 1);
  app.db
    .prepare("UPDATE users SET cohort_id=? WHERE id=?")
    .run("retained-course", userId);
  const snapshot = JSON.stringify({ ...testProfile, cohortId: "retained-course", cohortName: "既有課程" });
  app.db.prepare("INSERT INTO attempts(id,user_id,kind,version,status,started_at,submitted_at,revision,state,result,rubric,background_snapshot,background_version) VALUES(?,?,'daily','retained-version','submitted',1,2,1,?,?,?,?,?)")
    .run("retained-attempt", userId, '{"retained":true}', '{"score":90}', '[]', snapshot, "retained-profile-version");
  const oldAttempt = app.db.prepare("SELECT * FROM attempts WHERE id='retained-attempt'").get();
  await app.close();
  app = createApplication({ dbPath: path });
  assert.equal(app.migration.from, 2);
  assert.equal(app.migration.to, 4);
  assert.ok(existsSync(app.migration.backup));
  assert.deepEqual(
    app.db
      .prepare(
        "SELECT password,learner_code,must_change_password FROM users WHERE id=?",
      )
      .get(userId),
    before,
  );
  assert.equal(
    app.db.prepare("SELECT cohort_id FROM users WHERE id=?").get(userId)
      .cohort_id,
    "retained-course",
  );
  assert.deepEqual({...app.db.prepare("SELECT * FROM attempts WHERE id='retained-attempt'").get()}, {...oldAttempt,analytics_participant:null});
  const saved = new DatabaseSync(app.migration.backup, { readOnly: true });
  assert.equal(saved.prepare("PRAGMA user_version").get().user_version, 2);
  saved.close();
  await app.close();
  app = createApplication({ dbPath: path });
  assert.equal(app.migration.backup, null);
  await app.close();
});
