import { useEffect, useRef, useState } from "react";
import TroubleshootingRoom from "./TroubleshootingRoom";
import {
  initialTroubleshooting,
  applyTroubleshooting,
  advanceTroubleshooting,
  type TroubleAction,
} from "../shared/troubleshooting";
import type { Attempt, ExamCommand } from "../shared/exam";
import { api, ApiError } from "./examApi";

export function useTroublePractice() {
  const [state, setState] = useState(initialTroubleshooting),
    [feedback, setFeedback] = useState(""),
    [active, setActive] = useState(false);
  const current = useRef(state);
  current.current = state;
  function act(command: TroubleAction) {
    const out = applyTroubleshooting(current.current, command, Date.now());
    current.current = out.state;
    setState(out.state);
    setFeedback(out.error);
    return out.accepted;
  }
  function reset() {
    const next = initialTroubleshooting();
    current.current = next;
    setState(next);
    setFeedback("");
    setActive(true);
  }
  useEffect(() => {
    if (!state.pending) return;
    const timer = setTimeout(
      () => {
        setState((s) => {
          const next = advanceTroubleshooting(s, Date.now());
          current.current = next;
          return next;
        });
      },
      Math.max(0, state.pending.due - Date.now()) + 5,
    );
    return () => clearTimeout(timer);
  }, [state.pending?.due]);
  return { state, feedback, active, act, reset, start: () => setActive(true) };
}
export function TroubleshootingExam({
  initial,
  onUpdate,
  onFinished,
  onAbandon,
  onSessionExpired,
}: {
  initial: Attempt;
  onUpdate: (a: Attempt) => void;
  onFinished: (a: Attempt) => void;
  onAbandon: () => void;
  onSessionExpired?: () => void;
}) {
  const [attempt, setAttempt] = useState(initial),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [failed, setFailed] = useState(false),
    [confirm, setConfirm] = useState<"submit" | "abandon" | null>(null);
  const current = useRef(initial),
    locked = useRef(false),
    polling = useRef(false),
    retry = useRef<{
      path: string;
      body: unknown;
      finish?: "submit" | "abandon";
    } | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  function accept(a: Attempt) {
    current.current = a;
    setAttempt(a);
    onUpdate(a);
  }
  useEffect(() => {
    if (confirm) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirm]);
  async function send(request: NonNullable<typeof retry.current>) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setFailed(false);
    setFeedback("");
    retry.current = request;
    try {
      const response = await api<{
        attempt: Attempt;
        message?: string;
        applied?: boolean;
      }>(request.path, { method: "POST", body: request.body });
      retry.current = null;
      setConfirm(null);
      accept(response.attempt);
      setFeedback(response.message || "操作已保存。");
      if (request.finish === "submit") onFinished(response.attempt);
      else if (request.finish === "abandon") onAbandon();
      return response.applied !== false;
    } catch (error) {
      setFailed(true);
      setFeedback((error as Error).message);
      if (error instanceof ApiError && error.status === 401)
        onSessionExpired?.();
      if (error instanceof ApiError && error.status === 409) {
        retry.current = null;
        try {
          const latest = await api<{ attempt: Attempt }>(
            `/attempts/${current.current.id}`,
          );
          if (latest.attempt.status === "active") accept(latest.attempt);
          else if (latest.attempt.status === "submitted")
            onFinished(latest.attempt);
          else onAbandon();
        } catch {}
      }
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function act(action: TroubleAction) {
    if (locked.current || retry.current) return false;
    const command: ExamCommand = {
      type: "troubleshooting",
      data: { ...action },
    };
    return send({
      path: `/attempts/${current.current.id}/events`,
      body: {
        id: crypto.randomUUID(),
        revision: current.current.revision,
        source: [
          "preparation",
          "pour",
          "mix",
          "install",
          "remove-old",
          "remove-new",
          "reset-reagent",
          "replace-qc",
        ].includes(action.action)
          ? "model"
          : "workstation",
        command,
      },
    });
  }
  useEffect(() => {
    const timer = setInterval(async () => {
      if (
        !current.current.sim.troubleshooting?.pending ||
        locked.current ||
        retry.current ||
        polling.current
      )
        return;
      polling.current = true;
      try {
        const result = await api<{ attempt: Attempt }>(
          `/attempts/${current.current.id}`,
        );
        if (
          !locked.current &&
          !retry.current &&
          result.attempt.revision >= current.current.revision
        )
          accept(result.attempt);
      } catch (error) {
        if (!locked.current) setFeedback((error as Error).message);
      } finally {
        polling.current = false;
      }
    }, 350);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (locked.current || retry.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  if (!attempt.sim.troubleshooting)
    return <p>此情境狀態無法載入，請重新連線。</p>;
  return (
    <>
      <TroubleshootingRoom
        state={attempt.sim.troubleshooting}
        exam
        busy={busy}
        locked={!!retry.current}
        networkFailure={failed}
        feedback={feedback}
        startedAt={attempt.startedAt}
        onAction={act}
        onReturn={() => setConfirm("abandon")}
        onFinishExam={() => setConfirm("submit")}
        onRetry={
          failed && retry.current
            ? () => {
                if (retry.current) void send(retry.current);
              }
            : undefined
        }
      />
      <dialog
        ref={dialog}
        className="lis-verify-dialog trouble-exam-confirm"
        aria-label={confirm === "submit" ? "確認交卷" : "確認放棄"}
        onCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!busy) setConfirm(null);
        }}
      >
        <h2>{confirm === "submit" ? "完成本次考試？" : "放棄本次考試？"}</h2>
        <p>
          {confirm === "submit"
            ? "依目前保存的操作紀錄交卷；不代表主管已核准或正式結案。"
            : "此考試將標記放棄，其他任務不受影響。"}
        </p>
        <button disabled={busy} onClick={() => setConfirm(null)}>
          取消
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void send({
              path: `/attempts/${current.current.id}/${confirm}`,
              body: { revision: current.current.revision },
              finish: confirm!,
            })
          }
        >
          {confirm === "submit" ? "確認交卷" : "確認放棄"}
        </button>
      </dialog>
    </>
  );
}
