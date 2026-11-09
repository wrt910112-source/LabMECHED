import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createRegistrationGuard } from "./registration-limits.mjs";

const digest = (code) => createHash("sha256").update(code).digest("hex");
export function createInvitationService(db, helpers) {
  const {
    error,
    hashPassword,
    usernameInput,
    passwordInput,
    insert,
    transaction,
    audit,
    view,
    rowFor,
  } = helpers;
  const guard = createRegistrationGuard();
  function allowed(body, keys) {
    if (Object.keys(body).some((k) => !keys.includes(k)))
      throw error(400, "請求包含不允許修改的欄位。");
  }
  function initialized() {
    if (
      !db
        .prepare(
          "SELECT id FROM users WHERE role='administrator' AND enabled=1",
        )
        .get()
    )
      throw error(403, "管理員尚未完成初始化，暫不開放註冊。");
  }
  function available(hash) {
    initialized();
    const invitation = db
      .prepare("SELECT * FROM invitations WHERE code_hash=?")
      .get(hash);
    if (!invitation) throw error(400, "邀請碼不正確，請向課程管理員確認。");
    if (invitation.revoked)
      throw error(400, "邀請碼已停用，請向課程管理員索取新碼。");
    if (invitation.expires_at <= Date.now())
      throw error(400, "邀請碼已過期，請聯絡課程管理員。");
    if (invitation.used_count >= invitation.max_uses)
      throw error(409, "邀請碼名額已滿，請聯絡課程管理員。");
    return invitation;
  }
  function unique(username) {
    if (db.prepare("SELECT id FROM users WHERE username=?").get(username))
      throw error(409, "帳號已存在，請改用其他帳號；既有帳號請直接登入。");
  }
  async function register({ req, bodyOf, send, issueSession }) {
    guard.check(req.socket.remoteAddress || "unknown");
    const body = await bodyOf(req);
    allowed(body, ["inviteCode", "username", "password"]);
    if (
      typeof body.inviteCode !== "string" ||
      !/^[A-Za-z0-9_-]{22}$/.test(body.inviteCode.trim())
    )
      throw error(400, "邀請碼格式不正確，請完整貼上管理員提供的邀請碼。");
    const hash = digest(body.inviteCode.trim());
    available(hash);
    const username = usernameInput(body.username);
    passwordInput(body.password);
    unique(username);
    const userId = await guard.run(async () => {
      // Queued requests may have expired or been revoked before hashing begins.
      available(hash);
      unique(username);
      const passwordHash = await hashPassword(body.password);
      return transaction(() => {
        const invitation = available(hash);
        unique(username);
        const id = insert(
          {
            username,
            name: username,
            role: "learner",
            cohortId: invitation.cohort_id,
          },
          passwordHash,
          false,
          invitation.id,
        );
        db.prepare(
          "UPDATE invitations SET used_count=used_count+1 WHERE id=?",
        ).run(invitation.id);
        audit(id, id, "self-register", {
          invitationId: invitation.id,
          cohortId: invitation.cohort_id,
        });
        return id;
      });
    });
    await issueSession(userId);
    send(201, { user: view(rowFor(userId)) });
  }
  function invitationView(row) {
    return {
      id: row.id,
      cohortId: row.cohort_id,
      cohortName: row.cohort_name,
      codeSuffix: row.code_suffix,
      expiresAt: row.expires_at,
      maxUses: row.max_uses,
      usedCount: row.used_count,
      createdAt: row.created_at,
      status: row.revoked
        ? "revoked"
        : row.expires_at <= Date.now()
          ? "expired"
          : row.used_count >= row.max_uses
            ? "full"
            : "active",
    };
  }
  const get = (id) =>
    db
      .prepare(
        "SELECT i.*,c.name AS cohort_name FROM invitations i JOIN cohorts c ON c.id=i.cohort_id WHERE i.id=?",
      )
      .get(id);
  function settings(body) {
    if (
      typeof body.expiresAt !== "number" ||
      !Number.isSafeInteger(body.expiresAt) ||
      body.expiresAt <= Date.now() ||
      body.expiresAt > 8640000000000000
    )
      throw error(400, "請設定有效且晚於現在的到期時間。");
    if (!Number.isSafeInteger(body.maxUses) || body.maxUses < 1)
      throw error(400, "註冊名額需為正整數。");
  }
  async function admin({ path, req, bodyOf, send, adminWrite, user }) {
    if (path === "/api/admin/invitations") {
      if (req.method === "GET") {
        send(200, {
          invitations: db
            .prepare(
              "SELECT i.*,c.name AS cohort_name FROM invitations i JOIN cohorts c ON c.id=i.cohort_id ORDER BY i.created_at DESC,i.id",
            )
            .all()
            .map(invitationView),
        });
      } else if (req.method === "POST") {
        const body = await bodyOf(req);
        allowed(body, ["cohortId", "expiresAt", "maxUses"]);
        const code = randomBytes(16).toString("base64url");
        const id = randomUUID();
        adminWrite(() => {
          settings(body);
          if (
            typeof body.cohortId !== "string" ||
            !db.prepare("SELECT id FROM cohorts WHERE id=?").get(body.cohortId)
          )
            throw error(400, "請先建立並選擇班別／課程。");
          db.prepare(
            "INSERT INTO invitations(id,cohort_id,code_hash,code_suffix,expires_at,max_uses,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)",
          ).run(
            id,
            body.cohortId,
            digest(code),
            code.slice(-4),
            body.expiresAt,
            body.maxUses,
            user.id,
            Date.now(),
          );
          audit(user.id, id, "invitation-create", {
            cohortId: body.cohortId,
            expiresAt: body.expiresAt,
            maxUses: body.maxUses,
          });
        });
        send(201, { invitation: invitationView(get(id)), code });
      } else throw error(405, "不支援此方法。");
      return true;
    }
    const match = path.match(/^\/api\/admin\/invitations\/([^/]+)$/);
    if (!match) return false;
    if (req.method !== "PATCH") throw error(405, "不支援此方法。");
    const body = await bodyOf(req);
    allowed(body, ["expiresAt", "maxUses", "revoked"]);
    if (!Object.keys(body).length) throw error(400, "請提供更新設定。");
    adminWrite(() => {
      const row = get(match[1]);
      if (!row) throw error(404, "找不到邀請碼。");
      if (row.revoked) throw error(400, "邀請碼已停用，請建立新碼。");
      if (body.revoked !== undefined && body.revoked !== true)
        throw error(400, "停用後不能重新啟用邀請碼。");
      const next = {
        expiresAt:
          body.expiresAt === undefined ? row.expires_at : body.expiresAt,
        maxUses: body.maxUses === undefined ? row.max_uses : body.maxUses,
      };
      if (body.revoked !== true) settings(next);
      else if (body.expiresAt !== undefined || body.maxUses !== undefined)
        throw error(400, "停用與修改設定請分開操作。");
      if (next.maxUses < row.used_count)
        throw error(400, "名額不得低於已使用數。");
      db.prepare(
        "UPDATE invitations SET expires_at=?,max_uses=?,revoked=? WHERE id=?",
      ).run(next.expiresAt, next.maxUses, body.revoked ? 1 : 0, row.id);
      audit(
        user.id,
        row.id,
        body.revoked ? "invitation-revoke" : "invitation-update",
        next,
      );
    });
    send(200, { invitation: invitationView(get(match[1])) });
    return true;
  }
  return { register, admin };
}
