import { useEffect, useRef, useState } from "react";
import { api } from "./examApi";
import { kindNames, type User } from "../shared/exam";
import { errorNames, type ErrorCode } from "../shared/training";
import type {
  AnalyticsReport,
  SessionAnalytics,
  TrainingDetail,
} from "../shared/analytics";
import "./analytics.css";

const duration = (ms: number | null) =>
  ms === null
    ? "未記錄"
    : `${Math.floor(ms / 60000)} 分 ${Math.floor((ms % 60000) / 1000)} 秒`;
const percent = (v: number | null) =>
  v === null ? "未記錄" : `${(v * 100).toFixed(1)}%`;
const quality = (v: string) =>
  ({ complete: "完整紀錄", partial: "部分紀錄", unrecorded: "未記錄" })[v] || v;
const statusName = (v: string) =>
  ({
    active: "未完成／可接續",
    completed: "練習完成",
    restarted: "未完成後重開",
    submitted: "已交卷",
    abandoned: "已放棄",
  })[v] || v;
const date = (at: number) =>
  new Date(at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
export default function LearningAnalytics({
  user,
  onPractice,
}: {
  user: User;
  onPractice?: (kind: "daily" | "troubleshooting") => void;
}) {
  const admin = user.role === "administrator";
  const [filters, setFilters] = useState({
      cohort: "",
      user: "",
      kind: "",
      version: "",
      from: "",
      to: "",
    }),
    [report, setReport] = useState<AnalyticsReport | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [detail, setDetail] = useState<{
      row: SessionAnalytics;
      data: TrainingDetail;
    } | null>(null),
    [stepSearch, setStepSearch] = useState(""),
    [heatMode, setHeatMode] = useState("practice");
  const modal = useRef<HTMLDialogElement>(null),
    serial = useRef(0);
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v),
  ).toString();
  useEffect(() => {
    const n = ++serial.current;
    setLoading(true);
    setError("");
    setPage(0);
    void api<AnalyticsReport>(
      `${admin ? "/admin/analytics" : "/analytics/me"}?${params}`,
    )
      .then((data) => {
        if (n === serial.current) setReport(data);
      })
      .catch((e) => {
        if (n === serial.current) {
          setReport(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (n === serial.current) setLoading(false);
      });
  }, [params, admin]);
  useEffect(() => {
    if (detail) modal.current?.showModal();
    else modal.current?.close();
  }, [detail]);
  async function inspect(row: SessionAnalytics) {
    try {
      setError("");
      const data = await api<{
        session?: TrainingDetail;
        attempt?: TrainingDetail;
      }>(
        `/${row.mode === "practice" ? "practice-sessions" : "attempts"}/${row.id}`,
      );
      setDetail({ row, data: (data.session || data.attempt)! });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function download(table: string) {
    try {
      const r = await fetch(
        `/api/admin/analytics/export?${params}${params ? "&" : ""}table=${table}`,
        { credentials: "same-origin" },
      );
      if (!r.ok) throw Error((await r.json()).message);
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `training-${table}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const change = (key: keyof typeof filters, value: string) =>
    setFilters((f) => ({
      ...f,
      [key]: value,
      ...(key === "kind" ? { version: "" } : {}),
    }));
  const steps =
    report?.steps.filter(
      (s) =>
        !stepSearch ||
        `${s.label} ${s.step}`.toLowerCase().includes(stepSearch.toLowerCase()),
    ) || [];
  const heatSteps = steps.filter((s) => s.mode === heatMode).slice(0, 24);
  return (
    <section className="learning-analytics" aria-label="學習成效分析">
      <h1>{admin ? "班級與個人學習成效" : "我的學習成效"}</h1>
      <p>
        歷次表現趨勢不等同教學造成的因果效果。不同任務及評分版本分開比較；未記錄不代表零。
      </p>
      <form className="analytics-filters" onSubmit={(e) => e.preventDefault()}>
        {admin && (
          <>
            <label>
              班別／課程
              <select
                aria-label="班別／課程"
                value={filters.cohort}
                onChange={(e) => change("cohort", e.target.value)}
              >
                <option value="">全部班別／課程</option>
                {report?.options.cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              學員
              <select
                aria-label="學員"
                value={filters.user}
                onChange={(e) => change("user", e.target.value)}
              >
                <option value="">全部學員</option>
                {report?.learners.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} · {u.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          任務
          <select
            aria-label="任務"
            value={filters.kind}
            onChange={(e) => change("kind", e.target.value)}
          >
            <option value="">全部任務</option>
            <option value="daily">日保養</option>
            <option value="troubleshooting">QC 異常處理</option>
            <option value="weekly">周保養（歷史）</option>
          </select>
        </label>
        <label>
          評分版本
          <select
            aria-label="評分版本"
            value={filters.version}
            onChange={(e) => change("version", e.target.value)}
          >
            <option value="">全部版本（分開呈現）</option>
            {report?.options.versions.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          開始日期
          <input
            type="date"
            value={filters.from}
            onChange={(e) => change("from", e.target.value)}
          />
        </label>
        <label>
          結束日期
          <input
            type="date"
            value={filters.to}
            onChange={(e) => change("to", e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() =>
            setFilters({
              cohort: "",
              user: "",
              kind: "",
              version: "",
              from: "",
              to: "",
            })
          }
        >
          清除篩選
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">正在讀取統計…</p>}
      {report && (
        <>
          <div className="analytics-stats">
            {[
              [
                "學員／已參與",
                `${report.summary.learners}／${report.summary.participants}`,
              ],
              ["有效練習時間", duration(report.summary.practiceMs)],
              ["有效考試時間", duration(report.summary.examMs)],
              [
                "練習輪次／完成",
                `${report.summary.practiceCount}／${report.summary.completedPractice}`,
              ],
              [
                "考試交卷／放棄",
                `${report.summary.submitted}／${report.summary.abandoned}`,
              ],
            ].map(([label, value]) => (
              <article key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <p className="analytics-note">
            時數為入選輪次已記錄的累積時間，包含活動條件內的閱讀與模擬等待。背景頁面或閒置
            2
            分鐘後暫停；為活動估計，不代表真實專注程度。日期依台北時區及輪次開始時間篩選。
          </p>
          {admin && (
            <div className="analytics-downloads" aria-label="成效資料匯出">
              <span>以學員代碼匯出，不含姓名、帳號或背景問卷：</span>
              {[
                ["learners", "學員彙總 CSV"],
                ["sessions", "輪次與考試 CSV"],
                ["steps", "步驟分析 CSV"],
              ].map(([key, label]) => (
                <button key={key} onClick={() => void download(key)}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <h2>學員投入與完成情形</h2>
          <div className="analytics-table">
            <table>
              <thead>
                <tr>
                  {[
                    "學員",
                    "有效練習時間／有效考試時間",
                    "練習／完成／未完成",
                    "考試／交卷／放棄",
                    "時間完整性",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.learners.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {admin ? (
                        <button onClick={() => change("user", u.id)}>
                          {u.name} · {u.code}
                        </button>
                      ) : (
                        u.code
                      )}
                      {!u.enabled && "（停用）"}
                    </td>
                    <td>
                      {duration(u.practiceMs)}／{duration(u.examMs)}
                    </td>
                    <td>
                      {u.practiceCount}／{u.completedPractice}／
                      {u.activePractice}
                    </td>
                    <td>
                      {u.examCount}／{u.submitted}／{u.abandoned}
                    </td>
                    <td>
                      未記錄 {u.unrecorded} · 部分 {u.partial}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>考試成績（依任務與版本分組）</h2>
          {!report.gradeGroups.length ? (
            <p>目前沒有已交卷成績。</p>
          ) : (
            <div className="analytics-table">
              <table>
                <thead>
                  <tr>
                    <th>任務／版本</th>
                    <th>交卷次數／學員數</th>
                    <th>平均完成分</th>
                    <th>中位數</th>
                  </tr>
                </thead>
                <tbody>
                  {report.gradeGroups.map((g) => (
                    <tr key={`${g.kind}:${g.version}`}>
                      <td>
                        {kindNames[g.kind]} · {g.version}
                      </td>
                      <td>
                        {g.count}／{g.learnerCount}
                      </td>
                      <td>{g.mean.toFixed(1)}</td>
                      <td>{g.median.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="analytics-trends">
            {report.comparisons.map((c) => (
              <article key={`${c.userId}:${c.kind}:${c.version}`}>
                <h3>
                  {c.code} · {kindNames[c.kind]}
                </h3>
                <small>{c.version}</small>
                <p>
                  最初 {c.first} → 最新 {c.latest} ·{" "}
                  {c.difference === null
                    ? "只有一次，尚無差距"
                    : `${c.difference >= 0 ? "+" : ""}${c.difference.toFixed(1)} 分`}
                </p>
                <svg
                  viewBox="0 0 400 130"
                  role="img"
                  aria-label={`${c.code}歷次完成分折線圖`}
                >
                  <path
                    d="M20 10 V110 H380"
                    fill="none"
                    stroke="currentColor"
                  />
                  <text x="0" y="12">
                    100
                  </text>
                  <text x="7" y="113">
                    0
                  </text>
                  <polyline
                    points={c.points
                      .map(
                        (p, i) =>
                          `${20 + (i * 360) / Math.max(1, c.points.length - 1)},${110 - p.score}`,
                      )
                      .join(" ")}
                    fill="none"
                    stroke="#6ee2ec"
                    strokeWidth="2"
                  />
                  {c.points.map((p, i) => (
                    <circle
                      key={p.id}
                      cx={20 + (i * 360) / Math.max(1, c.points.length - 1)}
                      cy={110 - p.score}
                      r="4"
                      fill="#6ee2ec"
                    >
                      <title>
                        {date(p.at)}：{p.score} 分
                      </title>
                    </circle>
                  ))}
                </svg>
              </article>
            ))}
          </div>
          <h2>每輪練習與每次考試</h2>
          <div className="analytics-table">
            <table>
              <thead>
                <tr>
                  {[
                    "學員／任務／版本",
                    "開始時間／課程",
                    "狀態",
                    "完成分／關鍵步驟",
                    "有效時間",
                    "總經過／模擬等待／快轉",
                    "錯誤／補正",
                    "明細",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.sessions.slice(page * 25, page * 25 + 25).map((s) => (
                  <tr key={`${s.mode}:${s.id}`}>
                    <td>
                      {s.code} · {s.mode === "practice" ? "練習" : "考試"} ·{" "}
                      {kindNames[s.kind]}
                      <small>{s.version}</small>
                    </td>
                    <td>
                      {date(s.startedAt)}
                      <small>{s.cohortName || "未分班"}</small>
                    </td>
                    <td>{statusName(s.status)}</td>
                    <td>
                      {s.mode === "practice"
                        ? "練習不列正式成績"
                        : s.score === null
                          ? "尚未交卷"
                          : `${s.score}／${s.criticalRatio}%`}
                    </td>
                    <td>
                      {duration(s.timing.activeMs)}
                      <small>{quality(s.timing.quality)}</small>
                    </td>
                    <td>
                      {duration(s.elapsedMs)}／{duration(s.waitingMs)}／
                      {duration(s.skippedMs)}
                    </td>
                    <td>
                      {s.errors ?? "未提供"}／{s.corrections ?? "未記錄"}
                      <small>{quality(s.analysisQuality)}</small>
                    </td>
                    <td>
                      <button
                        disabled={s.mode === "exam" && s.status === "active"}
                        onClick={() => void inspect(s)}
                      >
                        查看明細
                      </button>
                      {s.mode === "practice" &&
                        s.status === "active" &&
                        s.userId === user.id &&
                        s.kind !== "weekly" && (
                          <button
                            onClick={() =>
                              onPractice?.(
                                s.kind as "daily" | "troubleshooting",
                              )
                            }
                          >
                            繼續練習
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
              上一頁
            </button>
            <span>
              第 {page + 1} 頁／
              {Math.max(1, Math.ceil(report.sessions.length / 25))} 頁
            </span>
            <button
              disabled={(page + 1) * 25 >= report.sessions.length}
              onClick={() => setPage((p) => p + 1)}
            >
              下一頁
            </button>
          </div>
          <h2>步驟與錯誤分析</h2>
          <p>
            首次成功率以有實際嘗試的「輪次—步驟」為分母；出錯學員比例以曾嘗試該步驟的學員為分母。未完成另列。舊錯誤尚無標準分類：
            {report.summary.unknownErrors} 次。
          </p>
          <p>
            {Object.entries(report.categories).map(([key, n]) => (
              <span className="analytics-error-tag" key={key}>
                {errorNames[key as ErrorCode] || key} {n}
              </span>
            ))}
          </p>
          <label>
            搜尋步驟
            <input
              value={stepSearch}
              onChange={(e) => setStepSearch(e.target.value)}
              placeholder="輸入步驟名稱或代碼"
            />
          </label>
          <div className="analytics-table">
            <table>
              <thead>
                <tr>
                  {[
                    "模式／任務／版本／步驟",
                    "有嘗試輪次",
                    "首次成功率",
                    "出錯學員比例",
                    "錯誤／補正",
                    "未完成輪次",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.key}>
                    <td>
                      {s.mode === "practice" ? "練習" : "考試"} ·{" "}
                      {kindNames[s.kind]} · {s.label}
                      <small>
                        {s.version} · {s.step}
                      </small>
                    </td>
                    <td>
                      {s.attemptedRounds}
                      <small>
                        未嘗試 {s.unattemptedRounds}／未記錄{" "}
                        {s.unrecordedRounds}
                      </small>
                    </td>
                    <td>{percent(s.firstSuccessRate)}</td>
                    <td>
                      {percent(s.errorLearnerRate)}（{s.errorLearners}／
                      {s.attemptedLearners}）
                    </td>
                    <td>
                      {s.errors ?? "未記錄"}／{s.corrections ?? "未記錄"}
                      {!!s.partialRounds && (
                        <small>含 {s.partialRounds} 輪部分紀錄</small>
                      )}
                    </td>
                    <td>{s.unfinished}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>學員與步驟熱圖</h2>
          <label>
            熱圖模式
            <select
              value={heatMode}
              onChange={(e) => setHeatMode(e.target.value)}
            >
              <option value="practice">練習</option>
              <option value="exam">考試</option>
            </select>
          </label>
          <p>
            每格顯示錯誤次數；灰色表示沒有標準化嘗試紀錄。顯示符合搜尋的前 24
            個步驟，可用上方任務、版本與步驟搜尋縮小範圍。
          </p>
          <div className="analytics-table">
            <table className="analytics-heatmap">
              <thead>
                <tr>
                  <th>學員代碼</th>
                  {heatSteps.map((s) => (
                    <th key={s.key} title={`${s.version} · ${s.label}`}>
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.learners.map((u) => (
                  <tr key={u.id}>
                    <th>{u.code}</th>
                    {heatSteps.map((s) => {
                      const cell = report.heatmap.find(
                        (h) => h.learnerId === u.id && h.stepKey === s.key,
                      );
                      return (
                        <td
                          key={s.key}
                          data-level={
                            !cell?.attempts
                              ? "none"
                              : !cell.errors
                                ? "clear"
                                : cell.errors > 2
                                  ? "high"
                                  : "some"
                          }
                          title={`${s.version} · ${cell?.attempts || 0} 次嘗試 · ${cell?.unfinished || 0} 輪未完成`}
                        >
                          {cell?.attempts ? cell.errors : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!report.sessions.length && (
            <p>目前篩選範圍尚無訓練紀錄，無紀錄學員仍列於名單。</p>
          )}
        </>
      )}
      <dialog
        ref={modal}
        className="analytics-detail"
        aria-label="訓練紀錄明細"
        onCancel={(e) => {
          e.preventDefault();
          setDetail(null);
        }}
      >
        {detail && (
          <>
            <header>
              <h2>
                {detail.row.code} · {kindNames[detail.row.kind]} ·{" "}
                {detail.row.mode === "practice" ? "練習" : "考試"}
              </h2>
              <button onClick={() => setDetail(null)}>關閉明細</button>
            </header>
            <p>
              {detail.row.version} · {statusName(detail.row.status)} ·{" "}
              {date(detail.row.startedAt)}
            </p>
            {(detail.data.result?.groups || detail.data.checks || []).map(
              (g) => (
                <details key={g.id}>
                  <summary>
                    {g.label} · {g.items.filter((i) => i.completed).length}／
                    {g.items.length}
                  </summary>
                  <ul>
                    {g.items.map((i) => (
                      <li key={i.id}>
                        {i.completed ? "✓ 已完成" : "未完成"} · {i.label}
                      </li>
                    ))}
                  </ul>
                </details>
              ),
            )}
            <h3>操作歷程與錯誤原因</h3>
            <div className="analytics-table">
              <table>
                <thead>
                  <tr>
                    <th>時間</th>
                    <th>操作</th>
                    <th>結果／錯誤</th>
                    <th>標準分類</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data.events?.map((e) => (
                    <tr key={e.id}>
                      <td>{date(e.at)}</td>
                      <td>{e.label}</td>
                      <td>{e.error || (e.accepted ? "已執行" : "未執行")}</td>
                      <td>
                        {e.diagnostic?.errorCode
                          ? errorNames[e.diagnostic.errorCode]
                          : e.diagnostic
                            ? "—"
                            : "未記錄"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
