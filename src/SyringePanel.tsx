const names = ["R2-2", "R2-1", "R1-1", "R1-2"];
export default function SyringePanel({
  checks,
  setChecks,
}: {
  checks: Record<string, string>;
  setChecks: (value: Record<string, string>) => void;
}) {
  return (
    <section className="bottle-controls" aria-label="注射器水氣檢查">
      <h3>每次保養：檢查四支 syringe</h3>
      <p className="mode-note">
        觀察水氣後逐支記錄。此處為練習紀錄，模型未模擬水氣故障。
      </p>
      {names.map((name) => (
        <label className="fluid-choice" key={name}>
          {name}
          <select
            aria-label={`${name} 水氣檢查`}
            value={checks[name] ?? ""}
            onChange={(e) => setChecks({ ...checks, [name]: e.target.value })}
          >
            <option value="">尚未檢查</option>
            <option value="dry">未見水氣</option>
            <option value="moisture">發現水氣</option>
          </select>
        </label>
      ))}
      <p role="status">
        已檢查 {Object.values(checks).filter(Boolean).length}／4 支
        {Object.values(checks).includes("moisture")
          ? "；發現水氣，需依科內流程確認處理。"
          : ""}
      </p>
      <button className="reset-bottles" onClick={() => setChecks({})}>
        開始新的保養檢查
      </button>
    </section>
  );
}
