import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import type { User, Attempt } from "../shared/exam";
import {
  departments,
  identities,
  parseAccountCsv,
  type Cohort,
  type ImportAccount,
} from "../shared/accounts";
import { api, ApiError } from "./examApi";
import { ProfileForm } from "./AccountProfile";
import { refreshAccountSession } from "./accountSession";
type Credential = { user: User; temporaryPassword: string };
function AccountDialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="account-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button onClick={close} aria-label={`關閉${title}`}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export default function AdminAccounts({
  inspect,
}: {
  inspect: (id: string) => void;
}) {
  const [users, setUsers] = useState<User[]>([]),
    [cohorts, setCohorts] = useState<Cohort[]>([]),
    [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState({
    query: "",
    department: "",
    identity: "",
    status: "",
    complete: "",
    cohort: "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [mode, setMode] = useState<
      "create" | "import" | "profile" | "history" | null
    >(null);
  const [credentials, setCredentials] = useState<Credential[]>([]),
    [rows, setRows] = useState<ImportAccount[]>([]),
    [preview, setPreview] = useState(false),
    [history, setHistory] = useState<Attempt[]>([]);
  const [role, setRole] = useState("learner"),
    [cohortId, setCohortId] = useState("");
  const [audit, setAudit] = useState<
    {
      id: string;
      action: string;
      at: number;
      actor: string;
      metadata: { fields?: string[] };
    }[]
  >([]);
  const selected = users.find((u) => u.id === selectedId);
  async function load() {
    const [u, c] = await Promise.all([
      api<{ users: User[] }>("/admin/users"),
      api<{ cohorts: Cohort[] }>("/admin/cohorts"),
    ]);
    setUsers(u.users);
    setCohorts(c.cohorts);
    setSelectedId((id) =>
      u.users.some((x) => x.id === id) ? id : u.users[0]?.id || "",
    );
  }
  useEffect(() => {
    void run(load);
  }, []);
  useEffect(() => {
    setRole(selected?.role || "learner");
    setCohortId(selected?.cohortId || "");
  }, [selected?.id, selected?.role, selected?.cohortId]);
  useEffect(() => {
    if (!credentials.length) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [credentials.length]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 401)
        await refreshAccountSession();
    } finally {
      setBusy(false);
    }
  }
  function closeCredentials() {
    if (
      window.confirm(
        "臨時密碼只顯示一次，請確認已妥善交付。關閉後如遺失須重新重設。",
      )
    )
      setCredentials([]);
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    await run(async () => {
      const r = await api<Credential>("/admin/users", { method: "POST", body });
      setCredentials([r]);
      setMode(null);
      await load();
    });
  }
  const filtered = users.filter(
    (u) =>
      (!filter.query ||
        `${u.username} ${u.name} ${u.learnerCode}`
          .toLowerCase()
          .includes(filter.query.toLowerCase())) &&
      (!filter.department || u.profile?.department === filter.department) &&
      (!filter.identity || u.profile?.identity === filter.identity) &&
      (!filter.status || String(u.enabled) === filter.status) &&
      (!filter.complete || String(u.profileComplete) === filter.complete) &&
      (!filter.cohort ||
        (filter.cohort === "none"
          ? !u.cohortId
          : u.cohortId === filter.cohort)),
  );
  const select = (
    key: keyof typeof filter,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={filter[key]}
        onChange={(e) => setFilter({ ...filter, [key]: e.target.value })}
      >
        <option value="">全部</option>
        {options.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="account-admin" aria-label="學員與帳號管理">
      <header className="account-page-heading">
        <div>
          <small>教學管理 / 學員管理</small>
          <h1>學員與帳號管理</h1>
          <p>資料取自目前資料庫；背景身分與系統權限分開管理。</p>
        </div>
        <div>
          <button onClick={() => setMode("create")} disabled={busy}>
            建立學員／帳號
          </button>
          <button
            onClick={() => {
              setRows([]);
              setPreview(false);
              setMode("import");
            }}
            disabled={busy}
          >
            CSV 批次建立
          </button>
          <button onClick={() => void run(load)} disabled={busy}>
            重新載入
          </button>
        </div>
      </header>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      <div className="account-filters">
        <label>
          搜尋帳號／暱稱／代碼
          <input
            value={filter.query}
            onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          />
        </label>
        {select(
          "department",
          "組別",
          departments.map((x) => ({ value: x, label: x })),
        )}
        {select(
          "identity",
          "主要身分",
          identities.map((x) => ({ value: x, label: x })),
        )}
        {select("status", "帳號狀態", [
          { value: "true", label: "啟用" },
          { value: "false", label: "停用" },
        ])}
        {select("complete", "背景資料", [
          { value: "true", label: "完整" },
          { value: "false", label: "待填" },
        ])}
        {select("cohort", "班別", [
          { value: "none", label: "未分班" },
          ...cohorts.map((c) => ({ value: c.id, label: c.name })),
        ])}
      </div>
      <div className="account-management-grid">
        <section className="account-panel account-list">
          <div className="account-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>學員代碼／登入帳號</th>
                  <th>暱稱</th>
                  <th>組別／身分</th>
                  <th>臨床年資</th>
                  <th>狀態</th>
                  <th>背景</th>
                  <th>權限</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    aria-selected={selectedId === u.id}
                    onClick={() => setSelectedId(u.id)}
                  >
                    <td>
                      <button onClick={() => setSelectedId(u.id)}>
                        {u.learnerCode}
                        <small>{u.username}</small>
                      </button>
                    </td>
                    <td>{u.name}</td>
                    <td>
                      {u.profile ? (
                        <>
                          {u.profile.department}
                          <small>{u.profile.identity}</small>
                        </>
                      ) : (
                        "待填"
                      )}
                    </td>
                    <td>
                      {u.profile
                        ? `${Math.floor(u.profile.clinicalMonths / 12)}年${u.profile.clinicalMonths % 12}月`
                        : "待填"}
                    </td>
                    <td>
                      <span
                        className={`account-status ${u.enabled ? "enabled" : "disabled"}`}
                      >
                        {u.enabled ? "啟用" : "停用"}
                      </span>
                    </td>
                    <td>{u.profileComplete ? "完整" : "待填"}</td>
                    <td>{u.role === "administrator" ? "管理員" : "學員"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && <p>目前沒有符合篩選條件的帳號。</p>}
        </section>
        <aside
          className="account-panel account-details"
          aria-label="選取帳號詳情"
        >
          {selected ? (
            <>
              <h2>{selected.learnerCode}</h2>
              <p>
                {selected.username} · {selected.name}
              </p>
              <p
                className={`account-status ${selected.enabled ? "enabled" : "disabled"}`}
              >
                {selected.enabled ? "啟用" : "停用"} ·{" "}
                {selected.mustChangePassword
                  ? "須更換初始／臨時密碼"
                  : "密碼已設定"}
              </p>
              <dl>
                <dt>組別／主要身分</dt>
                <dd>
                  {selected.profile
                    ? `${selected.profile.department}／${selected.profile.identity}`
                    : "背景資料待填"}
                </dd>
                <dt>使用經驗</dt>
                <dd>{selected.profile?.experience || "待填"}</dd>
                <dt>最近一年使用頻率</dt>
                <dd>{selected.profile?.usageFrequency || "待填"}</dd>
                <dt>曾親自執行保養</dt>
                <dd>
                  {selected.profile
                    ? selected.profile.maintenanceKinds.join("、") || "無"
                    : "待填"}
                </dd>
                <dt>最近一年保養頻率</dt>
                <dd>{selected.profile?.maintenanceFrequency || "待填"}</dd>
              </dl>
              <label>
                系統權限
                <select
                  aria-label="選取帳號系統權限"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="learner">學員</option>
                  <option value="administrator">管理員</option>
                </select>
              </label>
              <label>
                班別
                <select
                  aria-label="選取帳號班別"
                  value={cohortId}
                  onChange={(e) => setCohortId(e.target.value)}
                >
                  <option value="">未分班</option>
                  {cohorts.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="account-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (
                        !window.confirm(
                          "儲存權限與班別？權限變動會使該帳號的現有登入失效。",
                        )
                      )
                        return;
                      await api(`/admin/users/${selected.id}`, {
                        method: "PATCH",
                        body: { role, cohortId: cohortId || null },
                      });
                      await load();
                      await refreshAccountSession();
                    })
                  }
                >
                  儲存權限／班別
                </button>
                <button disabled={busy} onClick={() => setMode("profile")}>
                  檢視／修正背景
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (
                        !window.confirm(
                          `重設 ${selected.username} 的密碼？現有登入將失效。`,
                        )
                      )
                        return;
                      const r = await api<Credential>(
                        `/admin/users/${selected.id}/reset-password`,
                        { method: "POST", body: {} },
                      );
                      setCredentials([r]);
                      await load();
                    })
                  }
                >
                  產生臨時密碼
                </button>
                <button
                  disabled={busy}
                  className="account-danger"
                  onClick={() =>
                    void run(async () => {
                      if (
                        !window.confirm(
                          `${selected.enabled ? "停用" : "啟用"}此帳號？教學紀錄會保留。`,
                        )
                      )
                        return;
                      await api(`/admin/users/${selected.id}`, {
                        method: "PATCH",
                        body: { enabled: !selected.enabled },
                      });
                      await load();
                      await refreshAccountSession();
                    })
                  }
                >
                  {selected.enabled ? "停用帳號" : "啟用帳號"}
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await api<{ attempts: Attempt[] }>(
                        `/attempts?user=${encodeURIComponent(selected.id)}`,
                      );
                      setHistory(r.attempts);
                      setMode("history");
                    })
                  }
                >
                  查看既有紀錄
                </button>
              </div>
              <p>停用不刪除歷史紀錄。最後一位啟用管理員不能停用或降權。</p>
            </>
          ) : (
            <p>選取帳號以查看詳情。</p>
          )}
        </aside>
      </div>
      <div className="account-secondary-grid">
        <form
          className="account-panel"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              name = new FormData(form).get("name");
            void run(async () => {
              await api("/admin/cohorts", { method: "POST", body: { name } });
              form.reset();
              await load();
            });
          }}
        >
          <h2>班別管理</h2>
          <label>
            新增班別名稱
            <input name="name" required maxLength={80} />
          </label>
          <button disabled={busy}>建立班別</button>
          <p>
            {cohorts.length
              ? cohorts.map((c) => c.name).join("、")
              : "尚未建立班別。"}
          </p>
        </form>
        <section className="account-panel">
          <h2>首波開放任務</h2>
          <p>日保養：已開放</p>
          <p>QC 異常處理：已開放</p>
          <p>周／雙周保養：未開放，歷史紀錄保留</p>
          <p>任務指派、成效分析及去識別研究匯出：後續階段建置。</p>
          <p>研究使用：尚未啟用，依院內核定程序辦理。</p>
        </section>
      </div>
      <details className="account-panel">
        <summary
          onClick={() =>
            void run(async () =>
              setAudit(
                (await api<{ entries: typeof audit }>("/admin/audit")).entries,
              ),
            )
          }
        >
          帳號管理稽核（最近 100 筆）
        </summary>
        <ul>
          {audit.map((a) => (
            <li key={a.id}>
              {new Date(a.at).toLocaleString("zh-TW")} · {a.actor || "初始化"} ·{" "}
              {a.action}
              {a.metadata.fields?.length
                ? ` · 欄位：${a.metadata.fields.join("、")}`
                : ""}
            </li>
          ))}
        </ul>
      </details>
      {mode === "create" && (
        <AccountDialog title="建立帳號" close={() => setMode(null)}>
          <form onSubmit={create}>
            <label>
              登入帳號
              <input
                name="username"
                required
                minLength={3}
                maxLength={40}
                autoComplete="off"
              />
            </label>
            <label>
              顯示名稱（可稍後由學員填暱稱）
              <input name="name" maxLength={80} />
            </label>
            <label>
              系統權限
              <select name="role" defaultValue="learner">
                <option value="learner">學員</option>
                <option value="administrator">管理員</option>
              </select>
            </label>
            <label>
              班別
              <select name="cohortId">
                <option value="">未分班</option>
                {cohorts.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <p>伺服器產生臨時密碼，只顯示一次；首次登入須更換。</p>
            <button disabled={busy}>建立並顯示臨時密碼</button>
            {error && (
              <p role="alert" className="account-error">
                {error}
              </p>
            )}
          </form>
        </AccountDialog>
      )}
      {mode === "import" && (
        <AccountDialog title="CSV 批次建立" close={() => setMode(null)}>
          <p>
            UTF-8 CSV，欄位依序為
            username,name,cohort；班別須已存在，可空白。每批最多 200 筆／1
            MB，不接受密碼或權限。
          </p>
          <button
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob(["\uFEFFusername,name,cohort\r\n"], {
                  type: "text/csv;charset=utf-8",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "account-import-template.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            下載空白模板
          </button>
          <label>
            選取 CSV
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => {
                setPreview(false);
                setRows([]);
                const file = e.target.files?.[0];
                if (file)
                  void run(async () => {
                    if (file.size > 1024 * 1024) throw Error("CSV 上限 1 MB。");
                    const data = parseAccountCsv(await file.text());
                    await api("/admin/users/import", {
                      method: "POST",
                      body: { rows: data, dryRun: true },
                    });
                    setRows(data);
                    setPreview(true);
                  });
              }}
            />
          </label>
          {preview && (
            <>
              <p>已驗證 {rows.length} 筆；尚未建立任何帳號。</p>
              <div className="account-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>登入帳號</th>
                      <th>名稱</th>
                      <th>班別</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.username}>
                        <td>{r.username}</td>
                        <td>{r.name}</td>
                        <td>{r.cohort || "未分班"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await api<{ credentials: Credential[] }>(
                      "/admin/users/import",
                      { method: "POST", body: { rows, dryRun: false } },
                    );
                    setCredentials(r.credentials);
                    setMode(null);
                    setRows([]);
                    setPreview(false);
                    await load();
                  })
                }
              >
                確認整批建立
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="account-error">
              {error}
            </p>
          )}
        </AccountDialog>
      )}
      {mode === "profile" && selected && (
        <AccountDialog title="修正學員背景" close={() => setMode(null)}>
          <ProfileForm
            profile={selected.profile}
            user={selected}
            onSave={async (p) => {
              await api(`/admin/users/${selected.id}/profile`, {
                method: "PUT",
                body: p,
              });
              await load();
              setMode(null);
              await refreshAccountSession();
            }}
          />
        </AccountDialog>
      )}
      {mode === "history" && (
        <AccountDialog title="既有學習紀錄" close={() => setMode(null)}>
          {history.length ? (
            <div className="account-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>任務</th>
                    <th>版本</th>
                    <th>狀態</th>
                    <th>得分</th>
                    <th>查看</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((a) => (
                    <tr key={a.id}>
                      <td>{a.kind}</td>
                      <td>{a.version}</td>
                      <td>{a.status}</td>
                      <td>{a.result?.score ?? "—"}</td>
                      <td>
                        <button
                          disabled={a.status === "active"}
                          onClick={() => inspect(a.id)}
                        >
                          查看成績
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>尚無保存的學習紀錄。練習目前尚未跨登入保存。</p>
          )}
        </AccountDialog>
      )}
      {!!credentials.length && (
        <AccountDialog title="臨時密碼，只顯示一次" close={closeCredentials}>
          <p>
            請透過科內核准方式私下交付；本系統不會寄信，也不能查回明碼。關閉後如遺失，須重新重設。
          </p>
          <div className="account-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>登入帳號</th>
                  <th>臨時密碼</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((c) => (
                  <tr key={c.user.id}>
                    <td>{c.user.username}</td>
                    <td>
                      <code>{c.temporaryPassword}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={closeCredentials}>已妥善交付，關閉</button>
        </AccountDialog>
      )}
    </section>
  );
}
