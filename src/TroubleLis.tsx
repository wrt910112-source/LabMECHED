import { useEffect, useRef, useState } from "react";
import {
  chartRows,
  levels,
  sdi,
  phraseLists,
  phraseText,
  traceRows,
  differencePercent,
  traceAcceptable,
  troubleIdentity,
  readyToSend,
  isTroubleV2,
  expectedPhrases,
  formTextMatches,
  type TroubleState,
  type TroubleAction,
  type FormField,
  type Level,
  type TroubleResult,
} from "../shared/troubleshooting";
export type TroubleDispatch = (
  action: TroubleAction,
) => boolean | Promise<boolean>;
const number = (value: number) => Number(value.toFixed(3)).toString();
export function ResultTable({
  s,
  act,
  busy,
}: {
  s: TroubleState;
  act: TroubleDispatch;
  busy: boolean;
}) {
  const [selected, setSelected] = useState("initial");
  return (
    <div className="lis-split">
      <table aria-label="品管標本清單">
        <thead>
          <tr>
            {["品管液", "品管標本號", "濃度", "品管液批號"].map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr
            className={selected !== "second" ? "selected" : ""}
            onClick={() => setSelected("initial")}
          >
            <td>
              <button onClick={() => setSelected("initial")}>
                MAS chem-TRAK-H
              </button>
            </td>
            <td>MAS27091</td>
            <td>異常濃度</td>
            <td>27091</td>
          </tr>
          {(!isTroubleV2(s) || s.runs.final) && (
            <tr
              className={selected === "second" ? "selected" : ""}
              onClick={() => setSelected("second")}
            >
              <td>
                <button onClick={() => setSelected("second")}>
                  {isTroubleV2(s) ? "MAS-3" : "第二濃度"}
                </button>
              </td>
              <td>待設定</td>
              <td>第二濃度</td>
              <td>待設定</td>
            </tr>
          )}
        </tbody>
      </table>
      <table aria-label="UIBC 品管結果">
        <thead>
          <tr>
            {[
              "項目",
              "執行序",
              "結果",
              "SDI",
              "違反 Rule",
              "審批狀態",
              "操作",
            ].map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.results
            .filter((r) =>
              selected === "second"
                ? r.level === "second"
                : r.level === "primary",
            )
            .map((r) => (
              <tr key={r.id} className={selected === r.id ? "selected" : ""}>
                <td>UIBC</td>
                <td>T{r.order}</td>
                <td>{r.value ?? "仍異常／數值待設定"}</td>
                <td>
                  {r.value === null ? "—" : number(sdi(r.level, r.value))}
                </td>
                <td className={r.rule ? "lis-abnormal" : ""}>
                  {r.rule || "本情境允收"}
                </td>
                <td>
                  {r.rule
                    ? "待處理"
                    : s.reviewed.includes(r.id)
                      ? "已核對／本情境允收"
                      : "待核對"}
                </td>
                <td>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setSelected(r.level === "second" ? "second" : r.id);
                      void act({ action: "review-result", target: r.id });
                    }}
                    data-guide={`review-${r.id}`}
                    aria-label={`查看結果 ${r.id}`}
                  >
                    查看／核對
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
export function LjCharts({
  s,
  act,
}: {
  s: TroubleState;
  act?: TroubleDispatch;
}) {
  const [selected, setSelected] = useState<TroubleResult | null>(null);
  return (
    <section className="lis-charts" aria-label="QC L-J Chart">
      {(["primary", "second"] as const).map((level) => {
        const rows = chartRows(s, level),
          config = levels[level];
        const x = (i: number) => 50 + i * (740 / Math.max(rows.length - 1, 12)),
          y = (value: number) =>
            178 -
            ((value - config.mean + 4 * config.sd) / (8 * config.sd)) * 154;
        return (
          <div
            key={level}
            className="lis-chart"
            data-level={level}
            data-values={JSON.stringify(rows.map((r) => r.value))}
          >
            <h3>
              {config.label} ·{" "}
              {level === "primary" ? "批號27091" : "正式批號待設定"} · UIBC
            </h3>
            <div className="lis-chart-row">
              <svg
                viewBox="0 0 825 220"
                role="img"
                aria-label={`${config.label} L-J 圖`}
              >
                <rect
                  x="48"
                  y="20"
                  width="748"
                  height="161"
                  fill="white"
                  stroke="#aaa"
                />
                {[-3, -2, -1, 0, 1, 2, 3].map((n) => (
                  <g key={n}>
                    <line
                      x1="48"
                      x2="796"
                      y1={y(config.mean + n * config.sd)}
                      y2={y(config.mean + n * config.sd)}
                      stroke={
                        Math.abs(n) === 3
                          ? "#ff2020"
                          : Math.abs(n) === 2
                            ? "#ddc800"
                            : n === 0
                              ? "#149451"
                              : "#d4d8e3"
                      }
                      strokeWidth={Math.abs(n) >= 2 ? 1.8 : 1}
                    />
                    <text
                      x="43"
                      y={y(config.mean + n * config.sd) + 4}
                      textAnchor="end"
                      fill="#2020cc"
                      fontSize="10"
                    >
                      {number(config.mean + n * config.sd)}
                    </text>
                  </g>
                ))}
                <polyline
                  points={rows
                    .map((r, i) => `${x(i)},${y(r.value!)}`)
                    .join(" ")}
                  fill="none"
                  stroke="#2929ff"
                  strokeWidth="1.5"
                />
                {rows.map((r, i) => (
                  <g key={r.id}>
                    <g
                      role="button"
                      tabIndex={0}
                      aria-label={`資料點 ${config.label} T${r.order} ${r.value}`}
                      data-guide={`point-${r.id}`}
                      onClick={() => {
                        setSelected(r);
                        if (isTroubleV2(s))
                          void act?.({ action: "select-result", target: r.id });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setSelected(r);
                          if (isTroubleV2(s))
                            void act?.({
                              action: "select-result",
                              target: r.id,
                            });
                        }
                      }}
                    >
                      <rect
                        x={x(i) - 10}
                        y={y(r.value!) - 10}
                        width="20"
                        height="20"
                        fill="transparent"
                      />
                      {r.rule ? (
                        <rect
                          x={x(i) - 5}
                          y={y(r.value!) - 5}
                          width="10"
                          height="10"
                          fill="#e03ce4"
                        />
                      ) : (
                        <circle
                          cx={x(i)}
                          cy={y(r.value!)}
                          r="4.7"
                          fill="#2727ff"
                        />
                      )}
                    </g>
                    <text
                      x={x(i)}
                      y="200"
                      fill="#2525ce"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      T{r.order}
                    </text>
                  </g>
                ))}
              </svg>
              <dl>
                <dt>Mean</dt>
                <dd>{config.mean}</dd>
                <dt>SD</dt>
                <dd>{config.sd}</dd>
                <dt>±2 SD</dt>
                <dd>
                  {number(config.mean - 2 * config.sd)}–
                  {number(config.mean + 2 * config.sd)}
                </dd>
                <dt>N</dt>
                <dd>{rows.length}</dd>
                <dt>TEa／Sigma</dt>
                <dd>待設定</dd>
              </dl>
            </div>
          </div>
        );
      })}
      <p className="lis-note">
        {isTroubleV2(s)
          ? "相對時序T為模擬執行序；僅顯示實際執行後的結果。"
          : "相對時序T為模擬執行序。更換品管液後的中間重測未提供數值，保留於表格及操作紀錄，不繪製虛構圖點。"}
      </p>
      {selected && (
        <div className="lis-point-detail" role="status">
          <b>
            {levels[selected.level].label}／T{selected.order}
          </b>
          　結果 {selected.value}　SDI{" "}
          {number(sdi(selected.level, selected.value!))}　
          {selected.rule || "本情境允收"}
          <br />
          {selected.context}
        </div>
      )}
    </section>
  );
}
export function PhraseEditor({
  field,
  s,
  busy,
  act,
  onClose,
  onGuide,
  practice = false,
}: {
  field: FormField;
  s: TroubleState;
  busy: boolean;
  act: TroubleDispatch;
  onClose: () => void;
  onGuide?: (hint: { target: string; text: string } | null) => void;
  practice?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [ids, setIds] = useState([...s.form[field].ids]),
    [text, setText] = useState(s.form[field].text),
    [choice, setChoice] = useState("");
  const title = {
    cause: "原因探討",
    actions: "矯正措施",
    results: "矯正結果",
    prevention: "預防措施",
  }[field];
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    if (!onGuide || field === "prevention") return;
    const expected = expectedPhrases[field];
    const wrong = ids.find((id) => !expected.includes(id));
    const missing = expected.find((id) => !ids.includes(id));
    const targetId = wrong || missing;
    const hint = targetId
      ? choice !== targetId
        ? { target: "phrase-choice", text: `選取片語 ${targetId}` }
        : {
            target: wrong ? "phrase-remove" : "phrase-add",
            text: wrong ? "移出不符的片語" : "按 << 移入片語",
          }
      : !formTextMatches(s, field, text, [...expected])
        ? { target: "phrase-text", text: "核對編輯文字，與所選片語一致" }
        : { target: "phrase-confirm", text: "按確定保存片語" };
    onGuide(hint);
  }, [field, ids, text, choice, onGuide]);
  useEffect(() => () => onGuide?.(null), [onGuide]);
  function add() {
    if (!choice) return;
    const next = [...new Set([...ids, choice])];
    setIds(next);
    setText(phraseText(field, next));
  }
  function remove() {
    const next = ids.filter((id) => id !== choice);
    setIds(next);
    setText(phraseText(field, next));
  }
  return (
    <dialog
      ref={ref}
      className="lis-phrase-dialog"
      aria-label={`${title}片語`}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <header>
        {title}片語{" "}
        <button aria-label="關閉片語視窗" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="lis-phrase-columns">
        <section>
          <h3>編輯區</h3>
          <textarea
            data-guide="phrase-text"
            aria-label={`${title}編輯區`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
          />
          <p>已選：{ids.join("、") || "尚未加入"}</p>
        </section>
        <nav>
          <button data-guide="phrase-add" onClick={add} aria-label="加入片語">
            &lt;&lt;
          </button>
          <button
            data-guide="phrase-remove"
            onClick={remove}
            aria-label="移除片語"
          >
            &gt;&gt;
          </button>
        </nav>
        <section>
          <h3>輔助片語</h3>
          <select
            size={9}
            data-guide="phrase-choice"
            aria-label={`${title}輔助片語`}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            onDoubleClick={add}
          >
            {phraseLists[field].map(([id, label]) => (
              <option key={id} value={id}>
                {id}　{label}
              </option>
            ))}
          </select>
        </section>
      </div>
      {practice && field !== "prevention" && (
        <p className="lis-phrase-help" role="note">
          請選取正確的片語以及操作順序，選取正確者會亮燈提示輸入
        </p>
      )}
      <footer>
        <button onClick={onClose}>取消</button>
        <button
          data-guide="phrase-confirm"
          disabled={busy}
          onClick={async () => {
            if (
              await act({
                action: "save-phrases",
                target: field,
                data: { ids, text },
              })
            )
              onClose();
          }}
        >
          確定
        </button>
      </footer>
    </dialog>
  );
}
export function IncidentForm({
  s,
  busy,
  exam,
  act,
  onGuide,
}: {
  s: TroubleState;
  busy: boolean;
  exam: boolean;
  act: TroubleDispatch;
  onGuide?: (hint: { target: string; text: string } | null) => void;
}) {
  const [field, setField] = useState<FormField | null>(null),
    locked = busy || s.submission === "sent-awaiting-review";
  const titles: Record<FormField, string> = {
    cause: "原因探討",
    actions: "矯正措施",
    results: "矯正結果",
    prevention: "預防措施",
  };
  return (
    <section className="lis-incident" aria-label="品管異常處理表">
      <div className="lis-form-identity">
        <span>品管液名稱：{troubleIdentity.name}</span>
        <span>標本號：MAS27091</span>
        <span>品管液批號：27091</span>
        <span>濃度代碼：待確認</span>
        <span>儀器：M229／AU5800</span>
        <span>效期：待設定</span>
      </div>
      <div className="lis-rule-history">
        異常項目：UIBC　違反規則：
        {s.results.some((r) => r.id === "original") ? "1.3S → 2.2S" : "1.3S"}
        　狀態：
        <b>
          {s.submission === "sent-awaiting-review"
            ? "已呈送，待審核"
            : s.submission === "sending"
              ? "模擬呈送中…"
              : "未呈送"}
        </b>
      </div>
      <div className="lis-form-columns">
        <div>
          {(Object.keys(titles) as FormField[]).map((f) => (
            <section className="lis-form-field" key={f}>
              <h3>
                {titles[f]}{" "}
                <button
                  data-guide={`form-${f}`}
                  aria-label={`開啟${titles[f]}片語`}
                  disabled={locked}
                  onClick={() => setField(f)}
                >
                  ▣ 片語
                </button>
              </h3>
              <textarea
                readOnly
                aria-label={titles[f]}
                value={s.form[f].text}
              />
            </section>
          ))}
        </div>
        <article className="lis-paper">
          <h2>品管異常處理表</h2>
          <p>教學模擬 · M229／AU5800 · UIBC</p>
          <p>MAS chem-TRAK-H／MAS27091／批號27091</p>
          <p>正式濃度、瓶身效期：待設定</p>
          {(Object.keys(titles) as FormField[]).map((f) => (
            <section key={f}>
              <h3>{titles[f]}</h3>
              <pre>{s.form[f].text || "　"}</pre>
            </section>
          ))}
          <h3>回溯結果</h3>
          <p>
            {traceRows
              .map(
                (r) =>
                  `${r.id} ${r.original}→${r.current}（${differencePercent(r.original, r.current).toFixed(2)}%）`,
              )
              .join("；")}
          </p>
          <p>
            附件：{s.report.file || "待選取"}／
            {s.report.status === "success" ? "已上傳（模擬）" : "尚未上傳成功"}
          </p>
          <b>待主管審核／允收，常規病患檢體測試未恢復。</b>
        </article>
      </div>
      {!exam && (
        <div className="lis-send-checks" aria-label="呈送前核對">
          {[
            ["兩濃度 QC 合格", s.qcRecovered],
            ["P01、P02 回溯合格", s.trace.length === 2],
            ["回溯報告上傳成功", s.report.status === "success"],
            ["原因探討已填", !!s.form.cause.text],
            ["矯正措施已填", !!s.form.actions.text],
            ["矯正結果已填", !!s.form.results.text],
          ].map(([name, ok]) => (
            <span key={String(name)}>
              {ok ? "✓" : "○"} {name}
            </span>
          ))}
        </div>
      )}
      <footer>
        <button
          disabled={locked}
          onClick={() => void act({ action: "view", target: "form-saved" })}
        >
          暫存
        </button>
        <button
          disabled={locked}
          data-guide="form-submit"
          onClick={() => void act({ action: "submit" })}
        >
          呈送
        </button>
        <span>
          {!exam && !readyToSend(s) && "尚未完成必要處置與核對；可先暫存。"}
        </span>
      </footer>
      {field && (
        <PhraseEditor
          key={field}
          field={field}
          s={s}
          busy={busy}
          act={act}
          onGuide={onGuide}
          practice={!exam}
          onClose={() => setField(null)}
        />
      )}
    </section>
  );
}
export function TraceForm({
  s,
  busy,
  act,
  networkFailure,
  onBrowse,
}: {
  s: TroubleState;
  busy: boolean;
  act: TroubleDispatch;
  networkFailure: boolean;
  onBrowse?: (open: boolean) => void;
}) {
  const [browse, setBrowse] = useState(false),
    status =
      networkFailure && s.report.status !== "success"
        ? "failed"
        : s.report.status;
  useEffect(() => {
    onBrowse?.(browse);
    return () => onBrowse?.(false);
  }, [browse, onBrowse]);
  return (
    <section className="lis-trace" aria-label="檢體回溯填報">
      <h2>檢體回溯填報｜教學模擬</h2>
      <div className="lis-filter">
        <label>
          項目名稱 <input readOnly value="UIBC" />
        </label>
        <label>
          儀器型號 <input readOnly value="AU5800" />
        </label>
        <label>
          檢體號 <input readOnly value="P01／P02" />
        </label>
        <span>回溯允收：絕對差異百分比小於10.20%</span>
      </div>
      <h3>以病患檢體測試結果　2</h3>
      <p>差異％＝|新測值－原測值|／原測值 × 100%。以未四捨五入值判定。</p>
      <table aria-label="回溯兩支檢體">
        <thead>
          <tr>
            {[
              "檢體",
              "項目",
              "原測值",
              "新測值",
              "差異%",
              "判讀標準",
              "判讀",
              "個別核對",
            ].map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {traceRows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>UIBC</td>
              <td>{r.original}</td>
              <td>{s.qcRecovered ? r.current : "待啟動回溯"}</td>
              <td>
                {s.qcRecovered
                  ? differencePercent(r.original, r.current).toFixed(2) + "%"
                  : "—"}
              </td>
              <td>&lt;10.20%</td>
              <td>
                {s.qcRecovered
                  ? traceAcceptable(r.original, r.current)
                    ? "合格"
                    : "不合格"
                  : "待核對"}
              </td>
              <td>
                <button
                  data-guide={`trace-${r.id}`}
                  aria-label={`核對 ${r.id}`}
                  disabled={busy}
                  onClick={() =>
                    void act({ action: "trace-check", target: r.id })
                  }
                >
                  {s.trace.includes(r.id) ? "已核對" : "核對"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <fieldset>
        <legend>回溯報告上傳（本機模擬）</legend>
        <input aria-label="回溯報告檔案" readOnly value={s.report.file || ""} />
        <button
          data-guide="report-browse"
          disabled={busy}
          onClick={() => setBrowse(!browse)}
        >
          瀏覽…
        </button>
        {browse && (
          <div className="lis-file-picker">
            <p>本機教學附件，不含真實病患資料。</p>
            <button
              data-guide="report-file"
              onClick={async () => {
                if (
                  await act({
                    action: "select-report",
                    target: "UIBC_回溯報告.pdf",
                  })
                )
                  setBrowse(false);
              }}
            >
              選取 UIBC_回溯報告.pdf
            </button>
            <a
              href="/references/UIBC_回溯報告.pdf"
              target="_blank"
              rel="noreferrer"
            >
              預覽模擬PDF
            </a>
          </div>
        )}
        <p role="status">
          狀態：
          {
            {
              pending: "待上傳",
              uploading: "上傳中",
              success: "上傳成功（模擬）",
              failed: "上傳失敗，請重試保存或上傳",
            }[status]
          }
        </p>
        <button
          disabled={busy || s.report.status === "success"}
          data-guide="report-upload"
          onClick={() => void act({ action: "upload" })}
        >
          回溯報告上傳
        </button>
      </fieldset>
    </section>
  );
}
