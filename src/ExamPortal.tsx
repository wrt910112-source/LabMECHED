import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  LogIn,
  ShieldCheck,
  Trophy,
  Clock,
  ArrowLeft,
  X,
  UserPlus,
  Download,
  Target,
  History,
} from "lucide-react";
import { api, ApiError } from "./examApi";
import {
  kindNames,
  diagnoseCheck,
  type Attempt,
  type User,
  type ExamKind,
} from "../shared/exam";
import ExamRoom from "./ExamRoom";
import "./exam.css";

export const duration = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
};
const stamp = (time: number) => new Date(time).toLocaleString("zh-TW");
type PortalPage = "menu" | "history" | "admin";

export default function ExamPortal({
  open,
  onClose,
  requestedKind,
  onSceneActive,
}: {
  open: boolean;
  onClose: () => void;
  requestedKind?: ExamKind;
  onSceneActive?: (active: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [user, setUser] = useState<User | null>(null),
    [needsSetup, setNeedsSetup] = useState(false),
    [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    [page, setPage] = useState<PortalPage>("menu");
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [history, setHistory] = useState<Attempt[]>([]);
  useEffect(() => {
    onSceneActive?.(open && attempt?.status === "active");
    return () => onSceneActive?.(false);
  }, [open, attempt?.status, onSceneActive]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const status = await api<{ user: User | null; needsSetup: boolean }>(
        "/auth/status",
      );
      setUser(status.user);
      setNeedsSetup(status.needsSetup);
      if (status.user) {
        const [active, past] = await Promise.all([
          api<{ attempt: Attempt | null }>("/attempts/active"),
          api<{ attempts: Attempt[] }>("/attempts"),
        ]);
        setAttempt(active.attempt);
        setHistory(past.attempts);
        setPage("menu");
      } else {
        setAttempt(null);
        setHistory([]);
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (open) {
      if (!dialog.current?.open) dialog.current?.showModal();
      void refresh();
    } else dialog.current?.close();
  }, [open, refresh]);
  async function task(fn: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      await fn();
    } catch (error) {
      setMessage((error as Error).message);
      if (error instanceof ApiError && error.status === 401) setUser(null);
    } finally {
      setPending(false);
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget),
      form = e.currentTarget;
    await task(async () => {
      await api(needsSetup ? "/auth/setup" : "/auth/login", {
        method: "POST",
        body: Object.fromEntries(fields),
      });
      form.reset();
      await refresh();
    });
  }
  const submitted = history.filter(
    (x) => x.status === "submitted" && x.userId === user?.id,
  );
  const badges = [...new Set(submitted.flatMap((x) => x.result?.badges || []))];
  async function start(kind: ExamKind) {
    await task(async () => {
      const res = await api<{ attempt: Attempt }>("/attempts", {
        method: "POST",
        body: { kind },
      });
      setAttempt(res.attempt);
    });
  }
  async function inspect(id: string) {
    await task(async () => {
      const res = await api<{ attempt: Attempt }>(`/attempts/${id}`);
      setAttempt(res.attempt);
    });
  }
  const hasActive = attempt?.status === "active";
  return (
    <dialog
      ref={dialog}
      className="exam-portal"
      aria-label="登入與考試中心"
      onCancel={(e) => {
        e.preventDefault();
        if (!hasActive && !pending) onClose();
      }}
    >
      <header className="exam-header">
        <strong>
          <ShieldCheck size={22} /> AU5800 <span>任務與評量中心</span>
        </strong>
        <div>
          {user && (
            <span>
              {user.name} · {user.role === "administrator" ? "教師" : "學員"}
            </span>
          )}
          {user && !hasActive && (
            <button
              disabled={pending}
              onClick={() =>
                void task(async () => {
                  await api("/auth/logout", { method: "POST", body: {} });
                  setUser(null);
                  setAttempt(null);
                  setHistory([]);
                })
              }
            >
              登出
            </button>
          )}
          {!hasActive && (
            <button
              aria-label="關閉考試中心"
              disabled={pending}
              onClick={onClose}
            >
              <X size={20} />
            </button>
          )}
        </div>
      </header>
      {loading ? (
        <div className="exam-loading" role="status">
          讀取本地紀錄…
        </div>
      ) : !user ? (
        <div className="exam-login-wrap">
          <div className="exam-login-copy">
            <span className="exam-eyebrow">AU5800 LEARNING MISSIONS</span>
            <h1>
              每次操作，
              <br />
              留下成長的軌跡。
            </h1>
            <p>登入後開始保養測驗，交卷後查看成果與個人歷程。</p>
            <div className="exam-feature">
              <History />
              歷次紀錄　
              <Target />
              個人成長
            </div>
          </div>
          <form className="exam-card exam-login" onSubmit={login}>
            <LogIn size={30} />
            <h2>{needsSetup ? "建立第一位教師" : "登入／考試"}</h2>
            {needsSetup && (
              <p>此電腦尚未建立帳號。請設定教師帳號，以管理學員與評量紀錄。</p>
            )}
            <label>
              帳號
              <input
                name="username"
                autoComplete="username"
                required
                maxLength={40}
              />
            </label>
            {needsSetup && (
              <label>
                姓名
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                />
              </label>
            )}
            <label>
              密碼
              <input
                name="password"
                type="password"
                autoComplete={needsSetup ? "new-password" : "current-password"}
                required
                minLength={needsSetup ? 8 : undefined}
                maxLength={128}
              />
            </label>
            <button className="exam-primary" disabled={pending}>
              {pending ? "處理中…" : needsSetup ? "建立教師帳號" : "登入"}
            </button>
            {message && (
              <p className="exam-error" role="alert">
                {message}
              </p>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => void refresh()}
            >
              重新連線
            </button>
          </form>
        </div>
      ) : attempt?.status === "active" ? (
        <ExamRoom
          initial={attempt}
          onUpdate={setAttempt}
          onSessionExpired={() => {
            setUser(null);
            setMessage("登入已失效，重新登入後可繼續本次考試。");
          }}
          onFinished={(done) => {
            setAttempt(done);
            void api<{ attempts: Attempt[] }>("/attempts")
              .then((r) => setHistory(r.attempts))
              .catch((e) => setMessage(e.message));
          }}
          onAbandon={() => {
            setAttempt(null);
            void refresh();
          }}
        />
      ) : attempt?.status === "submitted" ? (
        <div className="exam-scroll">
          <Debrief
            attempt={attempt}
            onBack={() => {
              setAttempt(null);
              setPage("history");
            }}
          />
        </div>
      ) : (
        <>
          <nav className="exam-nav" aria-label="考試中心選單">
            <button
              aria-pressed={page === "menu"}
              onClick={() => setPage("menu")}
            >
              <Target size={18} />
              任務選單
            </button>
            <button
              aria-pressed={page === "history"}
              onClick={() => setPage("history")}
            >
              <History size={18} />
              我的歷程
            </button>
            {user.role === "administrator" && (
              <button
                aria-pressed={page === "admin"}
                onClick={() => setPage("admin")}
              >
                <ShieldCheck size={18} />
                教師管理
              </button>
            )}
          </nav>
          <main className="exam-scroll">
            {message && (
              <p className="exam-error" role="alert">
                {message}
              </p>
            )}
            {page === "menu" && (
              <>
                <div className="exam-page-heading">
                  <span className="exam-eyebrow">YOUR NEXT MISSION</span>
                  <h1>選擇保養任務</h1>
                  <p>
                    考試不顯示操作提示。選取「完成」後，查看本次成果與遺漏項目。
                  </p>
                </div>
                <div className="exam-missions">
                  {(["daily", "weekly", "biweekly"] as const).map((kind, i) => {
                    const past = submitted.filter((x) => x.kind === kind),
                      latest = past[0];
                    return (
                      <article
                        data-requested={kind === requestedKind}
                        className={`exam-card mission-card ${kind === "biweekly" ? "locked" : ""}`}
                        key={kind}
                      >
                        <span className="mission-number">0{i + 1}</span>
                        <h2>
                          {kind === "biweekly" ? "雙周保養" : kindNames[kind]}
                        </h2>
                        <p>
                          {kind === "biweekly"
                            ? "待完整 SOP 建置後開放"
                            : `已完成 ${past.length} 次測驗`}
                        </p>
                        {latest?.result && (
                          <p>
                            最近完成分 <b>{latest.result.score}</b>／100
                          </p>
                        )}
                        <button
                          className="exam-primary"
                          disabled={pending || kind === "biweekly"}
                          onClick={() =>
                            kind !== "biweekly" && void start(kind)
                          }
                        >
                          {kind === "biweekly" ? "尚未開放" : "開始測驗"}
                        </button>
                      </article>
                    );
                  })}
                  <article className="exam-card mission-card locked">
                    <h2>障礙排除</h2>
                    <p>尚未建置完整情境</p>
                    <button disabled>尚未開放</button>
                  </article>
                </div>
                <section className="exam-card exam-achievements">
                  <h2>
                    <Trophy />
                    個人成就
                  </h2>
                  {badges.length ? (
                    badges.map((x) => (
                      <span className="exam-badge" key={x}>
                        <Trophy size={17} />
                        {x}
                      </span>
                    ))
                  ) : (
                    <p>完成測驗後，成就會出現在這裡。</p>
                  )}
                </section>
              </>
            )}
            {page === "history" && (
              <>
                <h1>我的歷程</h1>
                <p>只比較相同保養種類及評分版本。時間不提供加分。</p>
                <ProgressComparisons attempts={submitted} />
                <AttemptTable
                  attempts={history.filter((x) => x.userId === user.id)}
                  inspect={inspect}
                  pending={pending}
                />
              </>
            )}
            {page === "admin" && <AdminDashboard inspect={inspect} />}
          </main>
        </>
      )}
    </dialog>
  );
}

export function Debrief({
  attempt,
  onBack,
}: {
  attempt: Attempt;
  onBack: () => void;
}) {
  const r = attempt.result!;
  return (
    <section className="exam-debrief">
      <button onClick={onBack}>
        <ArrowLeft size={16} />
        返回歷程
      </button>
      <div className="exam-page-heading">
        <span className="exam-eyebrow">MISSION DEBRIEF</span>
        <h1>{kindNames[attempt.kind]} · 本次成果</h1>
        <p>
          {attempt.user?.name || ""}　{stamp(attempt.startedAt)} · 評分版本{" "}
          {attempt.version}
        </p>
      </div>
      <div className="exam-stats">
        <Stat label="任務完成分" value={`${r.score} / 100`} />
        <Stat label="關鍵步驟完成比例" value={`${r.criticalRatio}%`} />
        <Stat label="操作錯誤" value={String(r.errors.length)} />
        <Stat label="總考試時間" value={duration(r.totalMs)} />
      </div>
      <div className="exam-badges">
        {r.badges.map((x) => (
          <span className="exam-badge" key={x}>
            <Trophy size={18} />
            {x}
          </span>
        ))}
      </div>
      <div className="exam-card">
        <p>
          完成 {r.completedCount}／{r.totalCount} 項 · 補正 {r.corrections} 次 ·
          重複操作 {r.repeatedActions} 次
        </p>
        <p>
          <Clock size={16} /> 操作期間 {duration(r.operationMs)} · 模擬等待{" "}
          {duration(r.waitingMs)} · 快轉跳過 {duration(r.skippedMs)}
        </p>
        <small>
          操作期間為總經過時間扣除 W2／Photocal
          等待；包含閱讀與思考時間。各流程分組等權，錯誤保留但不額外扣分。本頁暫不判定合格。
        </small>
      </div>
      <h2>完成與遺漏項目</h2>
      <div className="debrief-groups">
        {r.groups.map((g) => (
          <details className="exam-card" key={g.id} open={g.proportion < 1}>
            <summary>
              {g.label}
              <b>{Math.round(g.proportion * 100)}%</b>
            </summary>
            <ul>
              {g.items.map((x) => {
                const diagnosis =
                  x.diagnosis ||
                  diagnoseCheck(x, attempt.events || [], attempt.sim.reagents);
                return (
                  <li
                    key={x.id}
                    className={x.completed ? "complete" : "omitted"}
                  >
                    <span>{diagnosis.status}</span>
                    {x.label}
                    {x.critical && <em>關鍵</em>}
                    {!x.completed && (
                      <small className="exam-check-reason">
                        {diagnosis.reason}
                      </small>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
      <h2>錯誤與補正</h2>
      {r.errors.length ? (
        <div className="exam-table-scroll">
          <table>
            <thead>
              <tr>
                <th>時間</th>
                <th>操作</th>
                <th>紀錄</th>
              </tr>
            </thead>
            <tbody>
              {r.errors.map((e) => (
                <tr key={e.id}>
                  <td>{stamp(e.at)}</td>
                  <td>{e.label}</td>
                  <td>{e.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>本次沒有記錄到操作錯誤；遺漏項目另列於上方。</p>
      )}
      <h2>下次練習建議</h2>
      {r.suggestions.length ? (
        <>
          <ul className="exam-suggestions">
            {r.suggestions.slice(0, 8).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          {r.suggestions.length > 8 && (
            <details className="exam-card">
              <summary>展開其餘 {r.suggestions.length - 8} 項建議</summary>
              <ul className="exam-suggestions">
                {r.suggestions.slice(8).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <p>本次所有檢核項目已完成，可再次練習以確認穩定表現。</p>
      )}
      <details className="exam-card">
        <summary>查看完整操作紀錄</summary>
        <div className="exam-table-scroll">
          <table>
            <thead>
              <tr>
                <th>時間</th>
                <th>入口</th>
                <th>操作</th>
                <th>結果</th>
              </tr>
            </thead>
            <tbody>
              {attempt.events?.map((e) => (
                <tr key={e.id}>
                  <td>{stamp(e.at)}</td>
                  <td>{e.source === "model" ? "模型" : "工作站"}</td>
                  <td>{e.label}</td>
                  <td>{e.error || (e.accepted ? "已執行" : "未執行")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="exam-card exam-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function AttemptTable({
  attempts,
  inspect,
  pending = false,
}: {
  attempts: Attempt[];
  inspect: (id: string) => void;
  pending?: boolean;
}) {
  if (!attempts.length) return <div className="exam-card">尚無考試紀錄。</div>;
  return (
    <div className="exam-table-scroll">
      <table>
        <thead>
          <tr>
            <th>學員</th>
            <th>保養</th>
            <th>開始時間</th>
            <th>完成分</th>
            <th>關鍵步驟</th>
            <th>時間</th>
            <th>錯誤／補正／重複</th>
            <th>紀錄</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id}>
              <td>{a.user?.name}</td>
              <td>{kindNames[a.kind]}</td>
              <td>{stamp(a.startedAt)}</td>
              <td>{a.result?.score ?? "—"}</td>
              <td>{a.result ? `${a.result.criticalRatio}%` : "—"}</td>
              <td>{a.result ? duration(a.result.totalMs) : "—"}</td>
              <td>
                {a.result
                  ? `${a.result.errors.length}／${a.result.corrections}／${a.result.repeatedActions}`
                  : "—"}
              </td>
              <td>
                {a.status === "submitted" ? (
                  <button disabled={pending} onClick={() => inspect(a.id)}>
                    查看結算
                  </button>
                ) : a.status === "abandoned" ? (
                  "已放棄"
                ) : (
                  "未交卷"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ProgressComparisons({ attempts }: { attempts: Attempt[] }) {
  const groups = new Map<string, Attempt[]>();
  attempts
    .filter((a) => a.status === "submitted")
    .forEach((a) => {
      const key = `${a.userId}:${a.kind}:${a.version}`;
      groups.set(key, [...(groups.get(key) || []), a]);
    });
  return (
    <div className="exam-comparisons">
      {[...groups.entries()].map(([key, values]) => {
        const sorted = [...values].sort((a, b) => a.startedAt - b.startedAt),
          first = sorted[0],
          latest = sorted[sorted.length - 1],
          x = first.result!,
          y = latest.result!;
        return (
          <article className="exam-card" key={key}>
            <h3>
              {latest.user?.name} · {kindNames[latest.kind]}
            </h3>
            <small>
              {latest.version} · {values.length} 次交卷
            </small>
            <p>
              最新完成分 {y.score} · 關鍵步驟 {y.criticalRatio}% · 錯誤{" "}
              {y.errors.length} 次
            </p>
            {values.length < 2 ? (
              <p>只有一次紀錄，尚無前後差距。</p>
            ) : (
              <>
                <p>
                  最初 → 最新：
                  <b>
                    {x.score} → {y.score}
                  </b>
                  （{y.score - x.score >= 0 ? "+" : ""}
                  {Math.round((y.score - x.score) * 10) / 10} 分）
                </p>
                <p>
                  關鍵步驟 {x.criticalRatio}% → {y.criticalRatio}% · 錯誤{" "}
                  {x.errors.length} → {y.errors.length}
                </p>
                <p>
                  時間 {duration(x.totalMs)} → {duration(y.totalMs)}
                </p>
                <div className="exam-trend" aria-label="历次完成分">
                  {sorted.map((a) => (
                    <div
                      key={a.id}
                      title={`${stamp(a.startedAt)}：${a.result!.score} 分`}
                    >
                      <i
                        style={{ height: `${Math.max(2, a.result!.score)}%` }}
                      />
                      <span>{a.result!.score}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
function AdminDashboard({ inspect }: { inspect: (id: string) => void }) {
  const [users, setUsers] = useState<User[]>([]),
    [attempts, setAttempts] = useState<Attempt[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState({
      user: "",
      kind: "",
      from: "",
      to: "",
    }),
    [resetUser, setResetUser] = useState<User | null>(null);
  const query = new URLSearchParams(
    Object.entries(filter).filter(([, v]) => v),
  ).toString();
  const load = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const [u, a] = await Promise.all([
        api<{ users: User[] }>("/admin/users"),
        api<{ attempts: Attempt[] }>(`/attempts?${query}`),
      ]);
      setUsers(u.users);
      setAttempts(a.attempts);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [query]);
  useEffect(() => {
    void load();
  }, [load]);
  async function mutate(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const submitted = attempts.filter(
    (x) => x.status === "submitted" && x.user?.role === "learner",
  );
  const mistakes = new Map<string, { count: number; attempts: Set<string> }>();
  submitted.forEach((a) =>
    a.result!.errors.forEach((e) => {
      const x = mistakes.get(e.error) || {
        count: 0,
        attempts: new Set<string>(),
      };
      x.count++;
      x.attempts.add(a.id);
      mistakes.set(e.error, x);
    }),
  );
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      data = Object.fromEntries(new FormData(form));
    await mutate(async () => {
      await api("/admin/users", { method: "POST", body: data });
      form.reset();
    });
  }
  async function reset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      password = new FormData(form).get("password");
    await mutate(async () => {
      await api(`/admin/users/${resetUser!.id}`, {
        method: "PATCH",
        body: { password },
      });
      form.reset();
      setResetUser(null);
    });
  }
  return (
    <section>
      <h1>教師管理與評量成效</h1>
      {message && (
        <p role="alert" className="exam-error">
          {message}
        </p>
      )}
      <div className="admin-account-grid">
        <form onSubmit={create} className="exam-card">
          <h2>
            <UserPlus size={22} />
            建立學員
          </h2>
          <label>
            帳號
            <input
              name="username"
              required
              minLength={3}
              maxLength={40}
              autoComplete="off"
            />
          </label>
          <label>
            姓名
            <input name="name" required maxLength={80} />
          </label>
          <label>
            設定密碼
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <button className="exam-primary" disabled={busy}>
            建立學員帳號
          </button>
        </form>
        <div className="exam-card admin-user-list">
          <h2>學員帳號</h2>
          {users
            .filter((u) => u.role === "learner")
            .map((u) => (
              <div key={u.id}>
                <span>
                  <b>{u.name}</b> · {u.username} · {u.enabled ? "啟用" : "停用"}
                </span>
                <button disabled={busy} onClick={() => setResetUser(u)}>
                  重設密碼
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void mutate(async () => {
                      await api(`/admin/users/${u.id}`, {
                        method: "PATCH",
                        body: { enabled: !u.enabled },
                      });
                    })
                  }
                >
                  {u.enabled ? "停用" : "啟用"}
                </button>
              </div>
            ))}
          {!users.some((u) => u.role === "learner") && <p>尚未建立學員。</p>}
          {resetUser && (
            <form onSubmit={reset}>
              <h3>重設 {resetUser.name} 密碼</h3>
              <label>
                新密碼
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <button disabled={busy}>儲存新密碼</button>
              <button type="button" onClick={() => setResetUser(null)}>
                取消
              </button>
            </form>
          )}
        </div>
      </div>
      <div className="exam-filter">
        <label>
          學員
          <select
            aria-label="篩選學員"
            value={filter.user}
            onChange={(e) => setFilter({ ...filter, user: e.target.value })}
          >
            <option value="">全部學員</option>
            {users
              .filter((u) => u.role === "learner")
              .map((u) => (
                <option value={u.id} key={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          測驗
          <select
            aria-label="篩選測驗"
            value={filter.kind}
            onChange={(e) => setFilter({ ...filter, kind: e.target.value })}
          >
            <option value="">全部種類</option>
            <option value="daily">日保養</option>
            <option value="weekly">周保養</option>
          </select>
        </label>
        {(["from", "to"] as const).map((key) => (
          <label key={key}>
            {key === "from" ? "起日" : "迄日"}
            <input
              type="date"
              value={filter[key]}
              onChange={(e) => setFilter({ ...filter, [key]: e.target.value })}
            />
          </label>
        ))}
        <button disabled={busy} onClick={() => void load()}>
          更新統計
        </button>
        <a className="exam-link-button" href={`/api/admin/export?${query}`}>
          <Download size={16} />
          匯出 CSV
        </a>
      </div>
      <div className="exam-stats">
        <Stat label="交卷次數" value={String(submitted.length)} />
        <Stat
          label="平均完成分"
          value={
            submitted.length
              ? (
                  submitted.reduce((n, a) => n + a.result!.score, 0) /
                  submitted.length
                ).toFixed(1)
              : "—"
          }
        />
        <Stat
          label="平均關鍵步驟比例"
          value={
            submitted.length
              ? `${(submitted.reduce((n, a) => n + a.result!.criticalRatio, 0) / submitted.length).toFixed(1)}%`
              : "—"
          }
        />
        <Stat
          label="平均考試時間"
          value={
            submitted.length
              ? duration(
                  submitted.reduce((n, a) => n + a.result!.totalMs, 0) /
                    submitted.length,
                )
              : "—"
          }
        />
      </div>
      <h2>操作成績與熟練度趨勢</h2>
      <p>
        以完成度、關鍵步驟、錯誤、補正／重複及時間觀察成長。最初與最新比較只使用篩選範圍內、同種類與版本的交卷紀錄。
      </p>
      <ProgressComparisons attempts={submitted} />
      <h2>最常出現的錯誤</h2>
      {mistakes.size ? (
        <div className="exam-table-scroll">
          <table>
            <thead>
              <tr>
                <th>錯誤</th>
                <th>發生次數</th>
                <th>涉及考試次數</th>
              </tr>
            </thead>
            <tbody>
              {[...mistakes]
                .sort((a, b) => b[1].count - a[1].count)
                .map(([error, x]) => (
                  <tr key={error}>
                    <td>{error}</td>
                    <td>{x.count}</td>
                    <td>{x.attempts.size}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>目前範圍內沒有操作錯誤紀錄。</p>
      )}
      <h2>考試紀錄</h2>
      <AttemptTable
        attempts={attempts.filter((a) => a.user?.role === "learner")}
        inspect={inspect}
        pending={busy}
      />
    </section>
  );
}
