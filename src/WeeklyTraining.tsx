import { useEffect, useState } from "react";
import {
  initialBottles,
  operateBottle,
  slotById,
  washBanks,
  type BottleStates,
  type BottleAction,
} from "./detergents";
import "./weekly.css";
import { detailedProbes, mixerIds, mixerGroupIds, wellIds, w2Positions, probeOperationNames } from "../shared/maintenance";

export const weeklyProbes = detailedProbes;
export const weeklyRods = mixerIds;
export const mixerGroups = mixerGroupIds;
export const weeklyWells = wellIds;
export const w2Slots = w2Positions;
const probeSteps = Object.values(probeOperationNames).map(name => name === "擦拭 tip" ? "酒精棉擦拭 tip" : name);
type Result = "" | "正常" | "異常";
export function useWeeklyTraining(
  bottles: BottleStates,
  setBottles: (b: BottleStates) => void,
) {
  const [active, setActive] = useState(false),
    [view, setView] = useState("準備"),
    [target, setTarget] = useState("syringes");
  const [prepared, setPrepared] = useState(false),
    [lid, setLid] = useState(false),
    [maintenance, setMaintenance] = useState(false);
  const [iseTop, setIseTop] = useState(false), [iseModule, setIseModule] = useState(false), [iseMaintenance, setIseMaintenance] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({}),
    [damage, setDamage] = useState<Record<string, Result>>({});
  const [syringes, setSyringes] = useState<Record<string, Result>>({}),
    [drains, setDrains] = useState<Record<string, Result>>({});
  const [mix, setMix] = useState<Result>(""),
    [batch, setBatch] = useState(0),
    [chemistry, setChemistry] = useState<"hcl" | "bleach">("hcl");
  const [batchGroup,setBatchGroup]=useState('R1S'), [wells,setWells]=useState<string[]>([]), [swabReady,setSwabReady]=useState(false), [lastWell,setLastWell]=useState('');
  const [pendingDiag,setPendingDiag]=useState('');
  const [cup, setCup] = useState(false),
    [photo, setPhoto] = useState(false),
    [enhanced, setEnhanced] = useState(false);
  const [phase, setPhase] = useState<"idle" | "w2" | "photocal" | "done">(
      "idle",
    ),
    [remaining, setRemaining] = useState(1800);
  const [reviewed, setReviewed] = useState(false),
    [diluent, setDiluent] = useState<string[]>([]),
    [message, setMessage] = useState("");
  const [diag, setDiag] = useState(""),
    [count, setCount] = useState(3),
    [cuvette, setCuvette] = useState("內部"),
    [unit, setUnit] = useState(true);
  const busy = batch > 0 || phase === "w2" || phase === "photocal";
  const ready =
    prepared &&
    ["R2-2", "R2-1", "R1-1", "R1-2"].every((id) => syringes[id] === "正常");
  const probesDone = weeklyProbes.every(
    (id) => progress[id] === 7 && drains[id] === "正常",
  );
  const rodsDone =
    weeklyRods.every((id) => progress[id] === 3) && mixerGroups.every(id=>damage[id]==='正常') &&
    mix === "正常";
  const wellsDone=weeklyWells.every(id=>wells.includes(id));
  const w2Ready =
    w2Slots.every(
      (id) =>
        bottles[id]?.fluid === "w2" &&
        bottles[id].level === 1 &&
        bottles[id].chemistry === chemistry,
    ) &&
    !bottles["sample-left-2"].fluid &&
    !bottles["sample-right-2"].fluid &&
    bottles["ise-wash-2"].fluid === "det2";
  const restored = Object.entries(initialBottles()).every(
    ([id, b]) => bottles[id]?.fluid === b.fluid,
  );
  const complete =
    phase === "done" &&
    reviewed &&
    restored &&
    !cup &&
    diluent.length === 2 &&
    !lid && !iseTop && !iseModule &&
    !maintenance && !iseMaintenance &&
    probesDone &&
    rodsDone && wellsDone;
  useEffect(() => {
    if (!batch) return;
    const timer = setTimeout(() => {
      setProgress((p) => ({
        ...p,
        ...Object.fromEntries(weeklyRods.filter(id=>id.startsWith(`${batchGroup}-`)).map((id) => [id, 3])),
      }));
      setBatch(0);
      setMessage(`${batchGroup==='R1S'?'右側 12 支':'左側 6 支'}已取下清潔並裝回；請確認整組狀況。`);
    }, 2400);
    return () => clearTimeout(timer);
  }, [batch,batchGroup]);
  function cleanGroup(group:string){if(!ready||!lid||!maintenance||busy||!mixerGroups.includes(group as 'R1S'|'R2'))return;setBatchGroup(group);setBatch(Date.now());setMix(v=>v==='異常'?v:'');setDiag('');setPendingDiag('');}
  function cleanWell(id:string){if(!weeklyWells.includes(id))return;setTarget(id);if(!ready||!lid||!maintenance||busy||!swabReady||!weeklyRods.every(id=>progress[id]===3)){setMessage('請先完成左右兩組攪拌棒清潔、開蓋並讓棉棒沾取 Cleaning Solution。');return;}setWells(p=>p.includes(id)?p:[...p,id]);setLastWell(id);setMessage(`已清潔 ${id.replace('well-','')} 孔洞`);}
  function runDiag(region:string){const expected=pendingDiag==='ISE'?'ise':pendingDiag==='mix'?'front':'sample';if((pendingDiag==='ISE'?!iseMaintenance:!maintenance)||busy||!pendingDiag||region!==expected){setMessage('請先在對應 Maintenance 設定並確認程序，再按正確位置的 DIAG。');return;}setDiag(pendingDiag);setPendingDiag('');setMessage('DIAG 已啟動示意，請記錄檢查結果。');}
  useEffect(() => {
    if (phase !== "w2" && phase !== "photocal") return;
    const timer = setInterval(
      () => setRemaining((n) => Math.max(0, n - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (remaining !== 0) return;
    if (phase === "w2") {
      setPhase("photocal");
      setRemaining(10);
      setMessage("W2 完成，自動執行 Photocal；完成後取出 W2。");
    } else if (phase === "photocal") {
      setPhase("done");
      setMessage("Photocal 完成，請檢視結果並恢復瓶槽配置。");
    }
  }, [remaining, phase]);
  function step(id: string) {
    if (!ready || (id === "ISE" ? !iseTop || !iseMaintenance : !lid || !maintenance) || busy) return;
    setProgress((p) => ({
      ...p,
      [id]: Math.min((p[id] || 0) + 1, weeklyProbes.includes(id) ? 7 : 3),
    }));
    setDiag("");
  }
  function bottle(id: string, action: BottleAction) {
    if ((slotById[id].module === "ise" ? !iseMaintenance || !iseTop : !maintenance || !lid) || busy) {
      setMessage("請進入保養模式並開蓋，運轉中不能更換瓶子。");
      return;
    }
    if (id === "ise-wash-2") {
      setMessage("ISE DET-2 必須保留。");
      return;
    }
    try {
      const next = operateBottle(bottles, id, "weekly", action);
      if (next[id].fluid === "w2") next[id].chemistry = chemistry;
      setBottles(next);
      setMessage(`${slotById[id].label} 已更新`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function start() {
    if (
      !ready ||
      !probesDone ||
      !rodsDone ||
      !wellsDone ||
      !w2Ready ||
      !cup ||
      !photo ||
      !enhanced ||
      lid || iseModule ||
      !maintenance || !iseMaintenance ||
      busy
    ) {
      setMessage(
        '尚未符合：'+[!ready&&'準備及四支 syringe 檢查',!probesDone&&'三支探針裝回鎖緊與排水檢查',!rodsDone&&'兩組攪拌棒及 DIAG 檢查',!wellsDone&&'18 孔清潔',!w2Ready&&'七瓶同種滿瓶 W2、Sample DET-2 空槽與 ISE DET-2 保留',!cup&&'CLEAN 滿杯',!photo&&'勾選 Photocal',!enhanced&&'勾選 ISE Cleaning (Enhanced)',lid&&'關閉主蓋',iseModule&&'關閉 ISE module 鐵蓋',(!maintenance||!iseMaintenance)&&'進入 Analyzer 與 ISE 保養模式',busy&&'等待目前程序結束'].filter(Boolean).join('、')+'。',
      );
      return;
    }
    setPhase("w2");
    setRemaining(1800);
    setMessage("W2 與 ISE Enhanced Cleaning 執行中。");
  }
  function reset() {
    setActive(true);
    setView("準備");
    setTarget("syringes");
    setPrepared(false);
    setLid(false);
    setIseTop(false); setIseModule(false); setIseMaintenance(false);
    setMaintenance(false);
    setProgress({});
    setDamage({});
    setSyringes({});
    setDrains({});
    setMix("");
    setBatch(0);
    setBatchGroup('R1S');setWells([]);setSwabReady(false);setLastWell('');setPendingDiag('');
    setCup(false);
    setPhoto(false);
    setEnhanced(false);
    setPhase("idle");
    setRemaining(1800);
    setReviewed(false);
    setDiluent([]);
    setDiag("");
    setMessage("");
    setBottles(initialBottles());
  }
  return {
    active,
    setActive,
    view,
    setView,
    target,
    setTarget,
    prepared,
    setPrepared,
    lid,
    setLid,
    iseTop, setIseTop, iseModule, setIseModule, iseMaintenance, setIseMaintenance,
    maintenance,
    setMaintenance,
    progress,
    damage,
    setDamage,
    syringes,
    setSyringes,
    drains,
    setDrains,
    mix,
    setMix,
    batch,
    setBatch,
    chemistry,
    setChemistry,
    cup,
    setCup,
    photo,
    setPhoto,
    enhanced,
    setEnhanced,
    phase,
    remaining,
    setRemaining,
    reviewed,
    setReviewed,
    diluent,
    setDiluent,
    message,
    setMessage,
    diag,
    setDiag,
    count,
    setCount,
    cuvette,
    setCuvette,
    unit,
    setUnit,
    busy,
    ready,
    probesDone,
    rodsDone,
    w2Ready,
    complete,
    step,
    bottle,
    start,
    reset,
    batchGroup,cleanGroup,wells,wellsDone,swabReady,setSwabReady,lastWell,cleanWell,pendingDiag,setPendingDiag,runDiag,
  };
}
export type Weekly = ReturnType<typeof useWeeklyTraining>;
export function weeklyCompletion(w:Weekly){return [w.ready,w.probesDone,weeklyRods.every(id=>w.progress[id]===3),w.wellsDone,w.rodsDone,w.phase!=='idle'||w.w2Ready&&w.cup,w.phase==='done',w.reviewed,w.complete];}
export function WeeklyOverview({w,go,onModel}:{w:Weekly;go:(p:string)=>void;onModel:(id:string)=>void}){
 const names=['準備與櫃內四支 syringe 水氣檢查','Sample／ISE 三支探針拆洗、裝回及排水檢查','左右两組 mixer bar 取下清潔並裝回','棉棒沾 Cleaning Solution，逐孔清潔 18 個孔','Replace Mix Bar 與 DIAG 運轉檢查','準備七瓶 W2 與 ISE CLEAN 杯','Analyzer Maintenance → W2','Analyzer Maintenance → Photocal Monitor','Diluent 清潔、瓶槽復原與結束保養'];
 const done=weeklyCompletion(w),first=done.findIndex(v=>!v);
 return <section className="daily-page"><h2>周保養練習</h2><p>清單記錄進度；實體清潔請到模型操作。W2 與 Photocal Monitor 由 Analyzer Maintenance 進入。</p><button disabled={w.busy} onClick={w.reset}>重設並開始新一輪周保養</button><button onClick={()=>onModel(w.target)}>到模型操作</button><ol className="daily-steps">{names.map((s,i)=><li key={s}><span>{done[i]?'✓ 已完成':first===i?'目前步驟':'待完成'}</span><button onClick={()=>{if([4,6,7].includes(i)){go('Analyzer Maintenance');return;}w.setView(['準備','探針','攪拌棒','孔洞清潔','','W2 準備','','','復原'][i]);onModel(i===0?'syringes':i===1?'Sample-1':i===2||i===3?'group-R1S':i===5?'ise-wash-1':w.target);}}>{i+1}. {s}</button></li>)}</ol></section>;
}
export function WeeklyPanel({
  w,
  bottles,
  onFocus,
  onComputer,
  screen=false,
}: {
  w: Weekly;
  bottles: BottleStates;
  onFocus: (id: string) => void;
  onComputer?: () => void;
  screen?: boolean;
}) {
  const choose = (id: string) => {
    w.setTarget(id);
    onFocus(id);
  };
  const result = (
    value: Result,
    change: (v: Result) => void,
    label: string,
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        disabled={w.busy}
        onChange={(e) => change(e.target.value as Result)}
      >
        <option value="">待檢查</option>
        <option>正常</option>
        <option>異常</option>
      </select>
    </label>
  );
  return (
    <section className="weekly-panel" aria-label="周保養教學">
      {!screen && <><h2>周保養 · {w.complete ? "已完成" : "模型操作"}</h2>
      <button disabled={w.busy} onClick={w.reset}>
        開始／重新開始周保養
      </button>
      {onComputer && <button onClick={onComputer}>到工作站操作</button>}
      <p role="status">{w.message}</p>
      <nav>
        {[
          "準備",
          "探針",
          "攪拌棒",
          "孔洞清潔",
          "W2 準備",
          "復原",
        ].map((v) => (
          <button
            key={v}
            aria-pressed={w.view === v}
            onClick={() => w.setView(v)}
          >
            {v}
          </button>
        ))}
      </nav>
      </>}
      {screen && <p role="status">{w.message}</p>}
      <fieldset disabled={!w.active || w.busy}>
        <label><input type="checkbox" checked={w.iseMaintenance} onChange={e => w.setIseMaintenance(e.target.checked)} />ISE Maintenance 保養模式</label>
        <label><input type="checkbox" checked={w.iseTop} onChange={e => w.setIseTop(e.target.checked)} />ISE 上蓋開啟</label>
        <label><input type="checkbox" checked={w.iseModule} onChange={e => w.setIseModule(e.target.checked)} />ISE module 蓋開啟</label>
        <label>
          <input
            type="checkbox"
            checked={w.maintenance}
            onChange={(e) => w.setMaintenance(e.target.checked)}
          />
          Analyzer Maintenance 保養模式
        </label>
        <label>
          <input
            type="checkbox"
            checked={w.lid}
            onChange={(e) => w.setLid(e.target.checked)}
          />
          主蓋開啟
        </label>
      </fieldset>
      {w.view === "準備" && (
        <>
          <label>
            <input
              type="checkbox"
              disabled={!w.active || w.busy}
              checked={w.prepared}
              onChange={(e) => w.setPrepared(e.target.checked)}
            />
            確認預熱／待機，備妥 70% 異丙醇、無絨軟布、通針鐵絲
          </label>
          <h3>四支 syringe 水氣檢查（不可拆卸）</h3>
          {["R2-2", "R2-1", "R1-1", "R1-2"].map((id) => (
            <div key={id}>
              <button onClick={() => onFocus("syringes")}>{id}</button>
              {result(
                w.syringes[id] || "",
                (v) => w.setSyringes((p) => ({ ...p, [id]: v })),
                `${id} 水氣檢查`,
              )}
            </div>
          ))}
        </>
      )}
      {w.view === "探針" && (
        <>
          {weeklyProbes.map((id) => (
            <button
              key={id}
              onClick={() => choose(id)}
              aria-pressed={w.target === id}
            >
              {id} {w.progress[id] || 0}/7
            </button>
          ))}
          {weeklyProbes.includes(w.target) && (
            <>
              <h3>{w.target}</h3>
              <ol>
                {probeSteps.map((s, i) => (
                  <li key={s}>
                    {(w.progress[w.target] || 0) > i ? "✓ " : ""}
                    {s}
                  </li>
                ))}
              </ol>
              <button
                disabled={
                  !w.ready ||
                  (w.target === "ISE" ? !w.iseTop || !w.iseMaintenance : !w.lid || !w.maintenance) ||
                  w.busy ||
                  w.progress[w.target] === 7
                }
                onClick={() => w.step(w.target)}
              >
                {probeSteps[w.progress[w.target] || 0] || "已裝回鎖緊"}
              </button>
              <h3>
                {w.target === "ISE" ? "ISE" : "Analyzer"} Maintenance · Replace
                Sample Probe
              </h3>
              <label>
                比色杯
                <select
                  aria-label="比色杯"
                  value={w.cuvette}
                  onChange={(e) => w.setCuvette(e.target.value)}
                >
                  <option>內部</option>
                  <option>外部</option>
                </select>
              </label>
              <label>
                次數
                <input
                  type="number"
                  min="3"
                  value={w.count}
                  onChange={(e) => w.setCount(Number(e.target.value))}
                />
              </label>
              <button
                disabled={
                  (w.target === "ISE" ? !w.iseMaintenance : !w.maintenance) ||
                  w.busy ||
                  w.progress[w.target] !== 7 ||
                  w.count < 3 ||
                  !Number.isFinite(w.count) ||
                  w.cuvette !== (w.target === "Sample-1" ? "內部" : "外部")
                }
                onClick={() => w.setPendingDiag(w.target)}
              >
                確定排水設定，準備按模型 DIAG
              </button>
              {w.diag === w.target &&
                result(
                  w.drains[w.target] || "",
                  (v) => w.setDrains((p) => ({ ...p, [w.target]: v })),
                  `${w.target} 直線排水檢查`,
                )}
            </>
          )}
        </>
      )}
      {w.view === "攪拌棒" && (
        <>
          <p>藍色螺旋 R1／S：4 × 3；黃色 L 型 R2：2 × 3。</p>
          {mixerGroups.map(group=><div key={group}><h3>{group==='R1S'?'右側 R1/S · 12 支':'左側 R2 · 6 支'}</h3><button onClick={()=>choose(`group-${group}`)}>聚焦{group==='R1S'?'右':'左'}側攪拌單元</button><button disabled={!w.ready||!w.lid||!w.maintenance||w.busy} onClick={()=>{choose(`group-${group}`);w.cleanGroup(group);}}>取下清潔 mixer bar 並裝回（{group==='R1S'?'右':'左'}側）</button><p>{weeklyRods.filter(id=>id.startsWith(`${group}-`)).every(id=>w.progress[id]===3)?'✓ 整組已清潔並裝回':w.batch&&w.batchGroup===group?'提起 → 清潔 → 插回':'待清潔'}</p>{result(w.damage[group]||'',v=>w.setDamage(p=>({...p,[group]:v})),`${group} 整組彎曲／損傷檢查`)}</div>)}
          <h3>Replace Mix Bar</h3>
          <label>
            <input
              type="checkbox"
              checked={w.unit}
              onChange={(e) => w.setUnit(e.target.checked)}
            />
            Unit 1 · 次數 1
          </label>
          <button
            disabled={
              w.busy ||
              !w.maintenance ||
              !w.unit ||
              !weeklyRods.every(id=>w.progress[id]===3) || !mixerGroups.every(id=>w.damage[id]==='正常') || !w.wellsDone
            }
            onClick={() => w.setPendingDiag("mix")}
          >
            確定攪拌設定，準備按模型 DIAG
          </button>
          {w.diag === "mix" && result(w.mix, w.setMix, "攪拌運轉／異音")}
        </>
      )}
      {w.view==='孔洞清潔'&&<><h3>逐孔清潔 · {w.wells.length}/18</h3><p>先將綠柄棉棒沾取 Cleaning Solution，再點選模型上的每個孔洞。右側 12 孔、左側 6 孔。</p><button disabled={!w.ready||!w.lid||!w.maintenance||w.busy||!weeklyRods.every(id=>w.progress[id]===3)} onClick={()=>w.setSwabReady(true)}>{w.swabReady?'✓ 棉棒已沾 Cleaning Solution':'棉棒沾取 Cleaning Solution'}</button>{mixerGroups.map(g=><button key={g} onClick={()=>onFocus(`group-${g}`)}>查看{g==='R1S'?'右側 12':'左側 6'}孔</button>)}<p>已完成：{w.wells.map(id=>id.replace('well-','')).join('、')||'尚無'}</p></>}
      {!screen&&w.pendingDiag&&<p>程序已就緒：請點模型上的 {w.pendingDiag==='ISE'?'ISE':w.pendingDiag==='mix'?'前方 R1/R2':'後方 Sample'} DIAG。<button onClick={()=>onFocus(`diag-${w.pendingDiag==='ISE'?'ise':w.pendingDiag==='mix'?'front':'sample'}`)}>查看對應 DIAG 位置</button></p>}
      {(w.view === "W2 準備" || w.view === "復原") && (
        <>
          <label>
            本周清洗液
            <select
              disabled={w.busy || w.phase !== "idle"}
              value={w.chemistry}
              onChange={(e) =>
                w.setChemistry(e.target.value as "hcl" | "bleach")
              }
            >
              <option value="hcl">1N HCl</option>
              <option value="bleach">0.5% 漂白水</option>
            </select>
          </label>
          <p>每周交替；每次分析單元 6 瓶＋ISE 1 瓶。ISE DET-2 保留。</p>
          {[...w2Slots, "sample-left-2", "sample-right-2"].map((id) => (
              <div className="weekly-bottle" key={id} data-slot={id}>
              <button onClick={() => choose(id)}>
                  {washBanks.find(b=>b.id===slotById[id].bankId)?.name} · {slotById[id].label}
              </button>
              <span>
                {bottles[id].fluid || "空槽"} ·{" "}
                {Math.round(bottles[id].level * 100)}%{" "}
                {bottles[id].chemistry || ""}
              </span>
              <button
                disabled={w.busy || !bottles[id].fluid}
                onClick={() => w.bottle(id, { kind: "remove" })}
              >
                取出
              </button>
              {w.view === "W2 準備" && w2Slots.includes(id) && (
                <button
                  disabled={w.busy || !!bottles[id].fluid}
                  onClick={() => w.bottle(id, { kind: "replace", fluid: "w2" })}
                >
                  放入滿瓶 W2
                </button>
              )}
              {w.view === "復原" && initialBottles()[id].fluid && (
                <button
                  disabled={
                    w.phase !== "done" ||
                    w.busy ||
                    !!bottles[id].fluid ||
                    (id.startsWith("r1") && !w.diluent.includes(id))
                  }
                  onClick={() =>
                    w.bottle(id, {
                      kind: "replace",
                      fluid: initialBottles()[id].fluid!,
                    })
                  }
                >
                  裝回 {initialBottles()[id].fluid}
                </button>
              )}
            </div>
          ))}
          <button
            disabled={w.busy || !w.iseTop}
            onClick={() => {
              onFocus("U-L");
              w.setCup(!w.cup);
            }}
          >
            {w.cup
              ? "取出用過的 CLEAN 杯"
              : "U-L／CLEAN 放入滿杯 Cleaning Solution"}
          </button>
          {w.view === "復原" &&
            ["r1-inner-3", "r1-outer-3"].map((id) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={w.diluent.includes(id)}
                  disabled={w.busy || !!bottles[id].fluid}
                  onChange={(e) =>
                    w.setDiluent((p) =>
                      e.target.checked
                        ? [...p.filter((x) => x !== id), id]
                        : p.filter((x) => x !== id),
                    )
                  }
                />
                {slotById[id].label} 依科內 SOP 完成清潔
              </label>
            ))}
        </>
      )}
      {w.view === "Analyzer Maintenance" && (
        <div className="weekly-w2-window">
          <h3>W2（F6）</h3>
          <p>Please set detergent for W2. Start W2?</p>
          <label>
            <input
              type="checkbox"
              disabled={w.busy}
              checked={w.photo}
              onChange={(e) => w.setPhoto(e.target.checked)}
            />
            After W2 ends, perform the photocal
          </label>
          <label>
            <input
              type="checkbox"
              disabled={w.busy}
              checked={w.enhanced}
              onChange={(e) => w.setEnhanced(e.target.checked)}
            />
            ISE Cleaning (Enhanced)
          </label>
          <p>
            Unit 1 · {w.w2Ready ? "7 瓶已就緒" : "7 瓶尚未就緒"} · CLEAN{" "}
            {w.cup ? "滿杯" : "未放置"}
          </p>
          <table className="weekly-w2-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>W2</th>
              </tr>
            </thead>
            <tbody>
              {w2Slots.map((id) => (
                <tr key={id}>
                  <td>
                    {slotById[id].module.toUpperCase()} · {slotById[id].label}
                  </td>
                  <td>
                    {bottles[id].fluid === "w2"
                      ? `${bottles[id].chemistry === "hcl" ? "1N HCl" : bottles[id].chemistry === "bleach" ? "0.5% 漂白水" : "種類待確認"} · ${Math.round(bottles[id].level * 100)}%`
                      : "未放置"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button disabled={w.busy || w.phase !== "idle"} onClick={w.start}>
            OK · Start W2
          </button>
          <button disabled={w.busy} onClick={() => w.setView("W2 準備")}>
            Cancel
          </button>
        </div>
      )}
      {(w.phase === "w2" || w.phase === "photocal") && (
        <p>
          {w.phase === "w2" ? "W2（實機約 30 分鐘）" : "Photocal（教學示意）"}{" "}
          {Math.floor(w.remaining / 60)}:
          {String(w.remaining % 60).padStart(2, "0")}{" "}
          <button onClick={() => w.setRemaining(0)}>教學快轉</button>
        </p>
      )}
      {w.view === "Photocal Monitor" && <Photocal w={w} />}
      <p>
        探針 {w.probesDone ? "✓" : "待完成"} · 攪拌棒{" "}
        {w.rodsDone ? "✓" : "待完成"} · W2／Photocal{" "}
        {w.phase === "done" ? "✓" : "待完成"} · 復原{" "}
        {w.complete ? "✓" : "待完成"}
      </p>
    </section>
  );
}
export function Photocal({ w }: { w: Weekly }) {
  const [example, setExample] = useState("正常");
  return (
    <>
      <h3>Photocal Monitor · Unit 1</h3>
      <div className="photocal-legend"><span style={{background:'#7ac77a'}}>Cuvette Check Error · 比色杯檢查</span><span style={{background:'#f18b8b'}}>Mean Check Error · 平均檢查</span><span style={{background:'#ffbf65'}}>Lamp Check Error · 燈檢查</span></div>
      <p>
        教學模擬資料，未連接實機 · {w.phase === "done" ? "已完成" : "尚未完成"}
      </p>
      <select
        aria-label="Photocal 情境"
        value={example}
        onChange={(e) => setExample(e.target.value)}
      >
        {["正常", "平均檢查失敗", "比色杯檢查失敗", "燈檢查失敗"].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <div className="photocal-grid">
        {Array.from({ length: 204 }, (_, i) => (
          <span
            key={i}
            style={{
              background:
                w.phase !== "done"
                  ? "#ddd"
                  : i === 20 && example !== "正常"
                    ? {
                        平均檢查失敗: "#f18b8b",
                        比色杯檢查失敗: "#7ac77a",
                        燈檢查失敗: "#ffbf65",
                      }[example]
                    : "#edf4ed",
            }}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <p>
        紅：平均檢查失敗（髒污，清潔／更換）｜綠：比色杯檢查失敗（可能刮痕，依
        SOP 處理）｜橙：燈檢查失敗（依 SOP 處理光度計燈）。
      </p>
      <button
        disabled={w.phase !== "done" || example !== "正常"}
        onClick={() => w.setReviewed(true)}
      >
        確認本次正常結果
      </button>
    </>
  );
}
