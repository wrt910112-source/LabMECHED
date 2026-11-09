import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  X,
  Crosshair,
  ChevronDown,
  BookOpen,
  Check,
  Lock,
  Play,
  GraduationCap,
  ClipboardList,
} from "lucide-react";
import { asset, parts, type Part } from "./data";
import { referencePhotos, type PhotoSelection } from "./realPhotos";
import { dailySteps } from "../shared/dailyTasks";
import { weeklyStepNames } from "./WeeklyTraining";
import type { Quest } from "./hudTasks";
import { isTaskOpen } from "../shared/availability";
export type TaskKind = "daily" | "weekly";
export type MissionKind = TaskKind | "troubleshooting";
export function TaskCenter({
  open,
  onClose,
  onStart,
  hasDraft,
  initialKind = "daily",
}: {
  open: boolean;
  onClose: () => void;
  onStart: (kind: MissionKind, exam: boolean, restart: boolean) => void;
  hasDraft: (kind: MissionKind) => boolean;
  initialKind?: MissionKind;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<MissionKind>("daily"),
    [exam, setExam] = useState(false),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (open && !ref.current?.open) {
      setKind(isTaskOpen(initialKind) ? initialKind : "daily");
      setConfirm(false);
      ref.current?.showModal();
    }
    if (!open) ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="hud-dialog task-center"
      aria-label="任務中心"
      onCancel={(e) => {
        e.preventDefault();
        setConfirm(false);
        onClose();
      }}
    >
      <header>
        <div>
          <small>AU5800 · QUEST SELECT</small>
          <h2>任務中心</h2>
        </div>
        <button aria-label="關閉任務中心" onClick={onClose}>
          <X />
        </button>
      </header>
      <div className="mission-grid">
        {["日保養", "周保養", "雙周保養", "障礙排除"].map((name, i) => (
          <button
            key={name}
            className="mission-tile"
            disabled={i === 1 || i === 2}
            aria-pressed={
              i !== 2 &&
              kind ===
                (i === 0 ? "daily" : i === 1 ? "weekly" : "troubleshooting")
            }
            onClick={() => {
              setKind(
                i === 0 ? "daily" : i === 1 ? "weekly" : "troubleshooting",
              );
              setConfirm(false);
            }}
          >
            <span>0{i + 1}</span>
            <img
              src={asset(
                ["sample.jpg", "analyzer.jpg", "ise.jpg", "rear.jpg"][i],
              )}
              alt={`${name}模組位置參考`}
            />
            <h3>{name}</h3>
            <p>
              {i === 1
                ? "首波暫未開放，歷史紀錄保留"
                : i < 2
                  ? `${i === 0 ? dailySteps.length : weeklyStepNames.length} 組既有保養任務`
                  : i === 3
                    ? "UIBC 品管異常：從判讀到回溯 · 12步"
                    : "尚未開放"}
            </p>
          </button>
        ))}
      </div>
      <div className="mission-modes">
        <button aria-pressed={!exam} onClick={() => setExam(false)}>
          <GraduationCap />
          練習模式
          <small>提供操作目標；只保留本頁會話，尚未支援跨登入保存</small>
        </button>
        <button aria-pressed={exam} onClick={() => setExam(true)}>
          <ClipboardList />
          考試模式<small>登入後開始，不提供答案提示，保存評量紀錄</small>
        </button>
      </div>
      <p className="mission-summary">
        {kind === "daily"
          ? "日保養：依既有依賴完成溫度、Index、探針、ISE、試劑與補充檢查及 Rack 登記。清單編號不代表固定順序。"
          : kind === "weekly"
            ? "周保養：沿用既有拆洗、孔洞清潔、W2、Photocal 與最後配置復原流程。"
            : "UIBC品管異常：審核判讀、原杯重測、材料與校正、兩濃度QC、回溯及填報呈送。"}
      </p>
      {confirm ? (
        <section
          role="alertdialog"
          aria-label="確認重新開始"
          className="hud-warning"
        >
          <p>重新開始會清除本次練習進度。</p>
          <button onClick={() => setConfirm(false)}>取消</button>
          <button
            onClick={() => {
              setConfirm(false);
              onStart(kind, false, true);
            }}
          >
            確認重新開始
          </button>
        </section>
      ) : (
        <footer>
          <button onClick={onClose}>返回探索</button>
          {!exam && hasDraft(kind) && (
            <button onClick={() => setConfirm(true)}>重新開始練習</button>
          )}
          <button
            className="hud-primary"
            onClick={() => onStart(kind, exam, false)}
          >
            <Play size={16} />
            {exam ? "前往登入／考試" : hasDraft(kind) ? "繼續練習" : "開始練習"}
          </button>
        </footer>
      )}
    </dialog>
  );
}
export function QuestLog({
  guidance = true,
  name,
  quests,
  current,
  onChoose,
  onLocate,
  onComputer,
}: {
  guidance?: boolean;
  name: string;
  quests: Quest[];
  current: string;
  onChoose: (id: string) => void;
  onLocate: (target: string) => void;
  onComputer: (route: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false),
    [toast, setToast] = useState("");
  const previous = useRef(
    new Set(quests.filter((q) => q.done).map((q) => q.id)),
  );
  useEffect(() => {
    const next = quests.filter((q) => q.done && !previous.current.has(q.id));
    previous.current = new Set(quests.filter((q) => q.done).map((q) => q.id));
    if (guidance && next.length)
      setToast(`${next.map((q) => q.label).join("、")} 已完成`);
  }, [quests]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);
  const done = quests.filter((q) => q.done).length,
    target =
      quests.find((q) => q.id === current) ||
      quests.find((q) => !q.done && q.available);
  return (
    <section
      className="hud-card quest-log"
      aria-label={guidance ? "練習任務紀錄" : "考試任務紀錄"}
    >
      <header>
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
        >
          <ClipboardList size={16} />
          {name}{" "}
          <b>
            {done}／{quests.length}
          </b>
          <ChevronDown size={15} />
        </button>
      </header>
      <progress value={done} max={quests.length} />
      {!collapsed && (
        <>
          <ol>
            {quests.map((q) => (
              <li key={q.id}>
                <button
                  aria-current={
                    guidance && target?.id === q.id ? "step" : undefined
                  }
                  disabled={!q.available && !q.done}
                  onClick={() => onChoose(q.id)}
                  title={guidance ? q.reason : undefined}
                >
                  {q.done ? (
                    <Check size={15} />
                  ) : q.available ? (
                    <span className="quest-dot" />
                  ) : (
                    <Lock size={14} />
                  )}
                  <span>{q.label}</span>
                  {q.total !== undefined && (
                    <small>
                      {q.count}／{q.total}
                    </small>
                  )}
                </button>
              </li>
            ))}
          </ol>
          {target && (
            <div className="quest-objective">
              <small>{guidance ? "目前目標" : "選取項目"}</small>
              <strong>{target.label}</strong>
              {guidance && (
                <p>
                  {target.reason ||
                    target.instruction ||
                    "選取部件執行現有保養操作。"}
                </p>
              )}
              <div className="hud-inline">
                {guidance && (
                  <button
                    onClick={() => onLocate(target.targets[0] || "console")}
                  >
                    <Crosshair size={14} />
                    定位目前目標
                  </button>
                )}
                <button onClick={() => onComputer(target.route)}>
                  操作電腦
                </button>
              </div>
            </div>
          )}
          {guidance && done === quests.length && (
            <p className="hud-success">本次練習已完成</p>
          )}
        </>
      )}
      {toast &&
        createPortal(
          <div className="hud-toast" role="status">
            {toast}
          </div>,
          document.body,
        )}
    </section>
  );
}
export function PartInformation({
  part,
  tab,
  detail,
  status,
  photoSelection,
}: {
  detail?: string;
  status?: string;
  photoSelection?: PhotoSelection;
  part: Part;
  tab: "info" | "photo";
}) {
  const [missing, setMissing] = useState(false),
    [photoIndex, setPhotoIndex] = useState(0);
  const photoDialog = useRef<HTMLDialogElement>(null);
  const photos = referencePhotos(part, photoSelection);
  const photoKey = photos.map((p) => p.file).join("|");
  const currentPhoto = photos[photoIndex] || photos[0];
  const exact = !currentPhoto.context;
  const filename = currentPhoto.file.split("/").pop()!;
  useEffect(() => {
    setMissing(false);
    setPhotoIndex(0);
    photoDialog.current?.close();
  }, [part.id, detail, photoKey]);
  return (
    <div className="hud-part-info">
      <small>{parts.find((p) => p.id === part.parent)?.name || "AU5800"}</small>
      <h2>{detail || part.name}</h2>
      {detail && <p>{part.name}</p>}
      {status && <p className="hud-part-status">{status}</p>}
      <p className="hud-part-en">{part.en}</p>
      {tab === "info" ? (
        <>
          <p>{part.description}</p>
          <div className="hud-warning">
            <BookOpen size={17} />
            操作前請確認儀器狀態，並依科內 SOP 執行。
          </div>
        </>
      ) : (
        <>
          {!exact && <p>尚未提供實機照片（此零件特寫）</p>}
          {missing ? (
            <p>尚未提供實機照片</p>
          ) : (
            <figure>
              <button
                className="hud-photo-open"
                aria-label="放大實機照片"
                onClick={() => photoDialog.current?.showModal()}
              >
                <img
                  key={currentPhoto.file}
                  src={asset(currentPhoto.file)}
                  alt={`${detail || part.name} · ${filename}${exact ? "" : "（模組位置參考）"}`}
                  onError={() => setMissing(true)}
                />
              </button>
              <figcaption>
                {exact ? "實機參考照片" : "模組位置參考，非此零件特寫"}
                <span className="hud-photo-filename">{filename}</span>
              </figcaption>
            </figure>
          )}
          {photos.length > 1 && (
            <nav className="hud-inline" aria-label="參考照片切換">
              {photos.map(({ file }, i) => (
                <button
                  key={file}
                  aria-label={`切換參考照片 ${i + 1}`}
                  title={file.split("/").pop()}
                  aria-pressed={photoIndex === i}
                  onClick={() => {
                    setPhotoIndex(i);
                    setMissing(false);
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </nav>
          )}
          <dialog
            ref={photoDialog}
            className="hud-dialog hud-photo-dialog"
            aria-label="實機照片"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="關閉實機照片"
              onClick={() => photoDialog.current?.close()}
            >
              關閉 ×
            </button>
            <p>
              {exact
                ? detail || part.name
                : `${detail || part.name} · 模組位置參考，非此零件特寫`}
              <span className="hud-photo-filename">{filename}</span>
            </p>
            <img
              src={asset(currentPhoto.file)}
              alt={`${detail || part.name} · ${filename}`}
            />
          </dialog>
        </>
      )}
    </div>
  );
}
