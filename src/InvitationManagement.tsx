import { useEffect, useState, type FormEvent } from "react";
import type { Cohort, Invitation } from "../shared/accounts";
import { api } from "./examApi";

const labels = {
  active: "有效",
  expired: "過期",
  full: "額滿",
  revoked: "停用",
};
// datetime-local contains no timezone. Convert explicitly for the course's Taipei timezone.
const inputTime = (time: number) =>
  new Date(time + 8 * 3600000).toISOString().slice(0, 16);
const timestamp = (value: string) => new Date(`${value}:00+08:00`).getTime();
const stamp = (time: number) =>
  new Date(time).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });

export default function InvitationManagement({
  cohorts,
}: {
  cohorts: Cohort[];
}) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [secret, setSecret] = useState(""),
    [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<Invitation | null>(null);
  const [now, setNow] = useState(Date.now());
  async function load() {
    setInvitations(
      (await api<{ invitations: Invitation[] }>("/admin/invitations"))
        .invitations,
    );
  }
  async function run(job: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await job();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void run(load);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!secret) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [secret]);
  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      secret &&
      !window.confirm("目前邀請碼只顯示一次，請確認已複製保存後再建立新碼。")
    )
      return;
    const form = e.currentTarget,
      fields = new FormData(form);
    void run(async () => {
      const result = await api<{ invitation: Invitation; code: string }>(
        "/admin/invitations",
        {
          method: "POST",
          body: {
            cohortId: fields.get("cohortId"),
            expiresAt: timestamp(String(fields.get("expiresAt"))),
            maxUses: Number(fields.get("maxUses")),
          },
        },
      );
      setSecret(result.code);
      setCopied(false);
      form.reset();
      await load();
    });
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fields = new FormData(e.currentTarget);
    void run(async () => {
      await api(`/admin/invitations/${editing.id}`, {
        method: "PATCH",
        body: {
          expiresAt: timestamp(String(fields.get("expiresAt"))),
          maxUses: Number(fields.get("maxUses")),
        },
      });
      setEditing(null);
      await load();
    });
  }
  return (
    <section
      className="account-panel invitation-management"
      id="course-invitations"
      aria-label="課程邀請碼管理"
    >
      <header className="account-page-heading">
        <div>
          <h2>課程邀請碼</h2>
          <p>
            每組邀請碼獨立計算名額；停用學員不會退還名額。忘記密碼由管理員重設。
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => void run(load)}>
          重新整理邀請碼
        </button>
      </header>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      <form
        onSubmit={create}
        className="invitation-form"
        aria-label="建立課程邀請碼"
      >
        <label>
          班別／課程
          <select
            name="cohortId"
            aria-label="班別／課程"
            required
            disabled={busy || !cohorts.length}
            defaultValue=""
          >
            <option value="">請選擇班別／課程</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          到期時間（台北時間）
          <input
            name="expiresAt"
            type="datetime-local"
            required
            defaultValue={inputTime(Date.now() + 7 * 86400000)}
          />
        </label>
        <label>
          註冊名額
          <input
            name="maxUses"
            type="number"
            required
            min={1}
            step={1}
            defaultValue={30}
          />
        </label>
        <button disabled={busy || !cohorts.length}>建立邀請碼</button>
      </form>
      {!cohorts.length && <p>請先在班別／課程管理建立課程，再產生邀請碼。</p>}
      {secret && (
        <div className="invitation-secret" role="status">
          <strong>完整邀請碼只顯示這一次，請妥善保存並交付參與者。</strong>
          <code>{secret}</code>
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                try { await navigator.clipboard.writeText(secret); }
                catch { throw new Error("無法自動複製，請選取上方完整邀請碼後手動複製。"); }
                setCopied(true);
              })
            }
          >
            {copied ? "已複製邀請碼" : "複製邀請碼"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("完整碼關閉後無法再次查看，確認已保存？"))
                setSecret("");
            }}
          >
            已保存，關閉完整碼
          </button>
        </div>
      )}
      <div className="account-table-scroll">
        <table>
          <thead>
            <tr>
              {[
                "班別／課程",
                "代碼末四碼",
                "到期時間（台北）",
                "已用／總名額",
                "狀態",
                "操作",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invitations.map((i) => (
              <tr key={i.id}>
                <td>{i.cohortName}</td>
                <td>…{i.codeSuffix}</td>
                <td>{stamp(i.expiresAt)}</td>
                <td>
                  {i.usedCount}／{i.maxUses}
                </td>
                <td>
                  {
                    labels[
                      i.status !== "revoked" && i.expiresAt <= now
                        ? "expired"
                        : i.status
                    ]
                  }
                </td>
                <td>
                  <button
                    type="button"
                    disabled={busy || i.status === "revoked"}
                    onClick={() => setEditing(i)}
                  >
                    修改期限／名額
                  </button>
                  <button
                    type="button"
                    disabled={busy || i.status === "revoked"}
                    onClick={() => {
                      if (
                        window.confirm(
                          `停用 ${i.cohortName} 的邀請碼 …${i.codeSuffix}？已註冊學員不受影響。`,
                        )
                      )
                        void run(async () => {
                          await api(`/admin/invitations/${i.id}`, {
                            method: "PATCH",
                            body: { revoked: true },
                          });
                          setEditing(null);
                          await load();
                        });
                    }}
                  >
                    停用邀請碼
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!invitations.length && <p>尚未建立邀請碼。</p>}
      {editing && (
        <form
          key={editing.id}
          className="invitation-form"
          onSubmit={save}
          aria-label="修改課程邀請碼"
        >
          <h3>
            {editing.cohortName} · …{editing.codeSuffix}
          </h3>
          <label>
            到期時間（台北時間）
            <input
              name="expiresAt"
              type="datetime-local"
              required
              defaultValue={inputTime(editing.expiresAt)}
            />
          </label>
          <label>
            註冊名額
            <input
              name="maxUses"
              type="number"
              required
              min={Math.max(1, editing.usedCount)}
              step={1}
              defaultValue={editing.maxUses}
            />
          </label>
          <button disabled={busy}>儲存邀請碼設定</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(null)}
          >
            取消修改
          </button>
        </form>
      )}
    </section>
  );
}
