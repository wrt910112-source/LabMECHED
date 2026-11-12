import { useCallback, useEffect, useRef, useState } from "react";
import SimulatorWorkspace from "./SimulatorWorkspace";
import TroubleshootingRoom from "./TroubleshootingRoom";
import { setSessionUser } from "./accountSession";
import { api, ApiError } from "./examApi";
import { useExamDaily } from "./useExamDaily";
import { useTrainingActivity } from "./useTrainingActivity";
import { practiceAttempt, type PracticeSession } from "../shared/training";
import type { ExamCommand } from "../shared/exam";
import type { WorkspacePracticeProps } from "./SimulatorWorkspace";
import type { TroubleAction } from "../shared/troubleshooting";

export default function PracticePortal({
  open,
  kind,
  restart,
  onClose,
  onSceneActive,
}: WorkspacePracticeProps) {
  const dialog = useRef<HTMLDialogElement>(null),
    [session, setSession] = useState<PracticeSession | null>(null),
    [error, setError] = useState(""),
    [autoRestart, setAutoRestart] = useState(false);
  useEffect(() => {
    onSceneActive?.(open);
    return () => onSceneActive?.(false);
  }, [open, onSceneActive]);
  useEffect(() => {
    if (!open) {
      dialog.current?.close();
      setSession(null);
      return;
    }
    dialog.current?.showModal();
    setError("");
    setAutoRestart(restart);
    let canceled = false;
    void api<{ session: PracticeSession }>("/practice-sessions", {
      method: "POST",
      body: { kind },
    })
      .then(({ session: s }) => {
        if (!canceled) setSession(s);
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      });
    return () => {
      canceled = true;
    };
  }, [open, kind]);
  return (
    <dialog
      ref={dialog}
      className="practice-portal"
      aria-label="練習操作中心"
      onCancel={(e) => e.preventDefault()}
    >
      {session ? (
        <PracticeRoom
          key={session.id}
          initial={session}
          restartOnOpen={autoRestart}
          onUpdate={(s) => {
            setAutoRestart(false);
            setSession(s);
          }}
          onClose={onClose}
        />
      ) : (
        <section className="training-loading">
          <p role="status">{error || "正在讀取已保存的練習進度…"}</p>
          <button onClick={onClose}>返回探索</button>
        </section>
      )}
    </dialog>
  );
}
function PracticeRoom({
  initial,
  restartOnOpen,
  onUpdate,
  onClose,
}: {
  initial: PracticeSession;
  restartOnOpen: boolean;
  onUpdate: (s: PracticeSession) => void;
  onClose: () => void;
}) {
  const [instrumentDraft, setInstrumentDraft] = useState<
    Record<string, boolean>
  >({});
  const [calCheckedDraft, setCalCheckedDraft] = useState<boolean | null>(null);
  const [session, setSession] = useState(initial),
    [feedback, setFeedback] = useState(""),
    [failure, setFailure] = useState(""),
    [pending, setPending] = useState(0),
    [hasRetry, setHasRetry] = useState(false),
    [authenticationExpired, setAuthenticationExpired] = useState(false),
    [qcSavedVersion, setQcSavedVersion] = useState(0),
    [place, setPlace] = useState<"model" | "workstation">("model");
  const current = useRef(session);
  current.current = session;
  const queue = useRef(Promise.resolve(true)),
    retryRequest = useRef<{ path: string; body: unknown } | null>(null),
    mounted = useRef(true),
    failed = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const accept = useCallback((s: PracticeSession) => {
    if (
      !mounted.current ||
      s.id !== current.current.id ||
      s.revision < current.current.revision ||
      (current.current.status === "completed" && s.status === "active")
    )
      return;
    current.current = s;
    setSession(s);
    setInstrumentDraft((old) =>
      Object.fromEntries(
        Object.entries(old).filter(
          ([key, value]) =>
            (
              s.sim.instrument as unknown as Record<string, boolean> | undefined
            )?.[key] !== value,
        ),
      ),
    );
    setCalCheckedDraft((old) => (old === s.sim.cal.checked ? null : old));
  }, []);
  const activity = useTrainingActivity(
    "practice",
    session.id,
    session.status === "active",
    accept,
  );
  async function send(request: NonNullable<typeof retryRequest.current>) {
    setFailure("");
    setFeedback("");
    retryRequest.current = request;
    try {
      const r = await api<{
        session: PracticeSession;
        applied?: boolean;
        message?: string;
      }>(request.path, { method: "POST", body: request.body });
      retryRequest.current = null;
      failed.current = false;
      setHasRetry(false);
      if (r.applied === false) {
        setInstrumentDraft({});
        setCalCheckedDraft(null);
      }
      accept(r.session);
      setFeedback(r.message || "操作已保存。");
      if (
        (request.body as { command?: ExamCommand }).command?.type ===
          "rack-qc-entry" &&
        r.applied !== false
      )
        setQcSavedVersion(r.session.revision);
      return r.applied !== false;
    } catch (error) {
      failed.current = true;
      setInstrumentDraft({});
      setCalCheckedDraft(null);
      setFailure((error as Error).message);
      setHasRetry(true);
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 423 || error.status === 401)
      ) {
        retryRequest.current = null;
        failed.current = false;
        setHasRetry(false);
        if (error.status === 401) {
          setAuthenticationExpired(true);
          setSessionUser(null);
          return false;
        }
        try {
          const r = await api<{ session: PracticeSession }>(
            `/practice-sessions/${current.current.id}`,
          );
          accept(r.session);
        } catch {}
      }
      return false;
    }
  }
  const authExpired = authenticationExpired || activity.authenticationExpired;
  useEffect(() => {
    if (activity.authenticationExpired) setSessionUser(null);
  }, [activity.authenticationExpired]);
  const dispatch = (command: ExamCommand, source = place): Promise<boolean> => {
    if (
      failed.current ||
      current.current.status !== "active" ||
      activity.blocked ||
      authExpired
    ) {
      if (current.current.status !== "active")
        setFeedback("本輪已完成，請開始新一輪再操作。");
      return Promise.resolve(false);
    }
    setPending((n) => n + 1);
    if (command.type === "cover" && typeof command.value === "boolean")
      setInstrumentDraft((old) => ({
        ...old,
        [command.target!]: command.value as boolean,
      }));
    if (command.type === "maintenance" && typeof command.value === "boolean")
      setInstrumentDraft((old) => ({
        ...old,
        [command.target === "ise" ? "iseMaintenance" : "analyzerMaintenance"]:
          command.value as boolean,
      }));
    if (command.type === "cal-review") setCalCheckedDraft(true);
    const next = queue.current.then(async () => {
      if (!mounted.current || failed.current) return false;
      const s = current.current;
      if (s.status !== "active") return false;
      return send({
        path: `/practice-sessions/${s.id}/events`,
        body: {
          id: crypto.randomUUID(),
          revision: s.revision,
          source,
          command,
        },
      });
    });
    queue.current = next.catch(() => false);
    return next.finally(() => {
      if (mounted.current) setPending((n) => n - 1);
    });
  };
  async function restartRound() {
    if (pending || hasRetry) return;
    if (
      current.current.status === "active" &&
      !window.confirm("封存本輪進度並開始新一輪？歷史紀錄會保留。")
    )
      return;
    try {
      const r = await api<{ session: PracticeSession }>(
        `/practice-sessions/${session.id}/restart`,
        { method: "POST", body: {} },
      );
      onUpdate(r.session);
    } catch (e) {
      setFailure((e as Error).message);
    }
  }
  const requestedRestart = useRef(false);
  useEffect(() => {
    if (
      restartOnOpen &&
      !requestedRestart.current &&
      (activity.ready || session.status !== "active")
    ) {
      requestedRestart.current = true;
      void restartRound();
    }
  }, [restartOnOpen, activity.ready]);
  useEffect(() => {
    const timer = setInterval(() => {
      const s = current.current;
      if (
        s.status !== "active" ||
        pending ||
        hasRetry ||
        !activity.ready ||
        !(
          s.sim.troubleshooting?.pending ||
          s.sim.batch ||
          s.sim.phase === "w2" ||
          s.sim.phase === "photocal"
        )
      )
        return;
      void api<{ session: PracticeSession }>(
        `/practice-sessions/${s.id}/poll`,
        { method: "POST", body: {} },
      )
        .then((r) => accept(r.session))
        .catch((e) => setFailure(e.message));
    }, 1000);
    return () => clearInterval(timer);
  }, [pending, hasRetry, activity.ready, accept]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending || hasRetry) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending, hasRetry]);
  async function pause() {
    if (pending || hasRetry) return;
    if (activity.blocked || authExpired || session.status !== "active") {
      onClose();
      return;
    }
    try {
      await activity.pause();
      onClose();
    } catch (e) {
      setFailure((e as Error).message);
    }
  }
  const blocked =
    hasRetry || activity.blocked || authExpired || session.status !== "active";
  const projected = {
    ...session,
    sim: {
      ...session.sim,
      cal: {
        ...session.sim.cal,
        checked: calCheckedDraft ?? session.sim.cal.checked,
      },
      ...(session.sim.instrument
        ? { instrument: { ...session.sim.instrument, ...instrumentDraft } }
        : {}),
    },
  };
  const daily = useExamDaily(
    practiceAttempt(projected),
    dispatch,
    blocked,
    () => void restartRound(),
    true,
  );
  const saveStatus = (
    <span>
      {session.progress.completedGroups}／{session.progress.totalGroups} ·{" "}
      {pending
        ? "保存中…"
        : session.status === "completed"
          ? "本輪已完成並封存"
          : feedback || "已保存"}
      {(failure || activity.error) && (
        <span role="alert">{failure || activity.error}</span>
      )}
      {hasRetry && (
        <button
          disabled={pending > 0}
          onClick={() => {
            const r = retryRequest.current;
            if (r) {
              setPending((n) => n + 1);
              void send(r).finally(() => setPending((n) => n - 1));
            }
          }}
        >
          重試保存
        </button>
      )}
      {activity.error && !authExpired && (
        <button
          onClick={() =>
            void activity.reconnect(activity.blocked).catch(() => {})
          }
        >
          {activity.blocked ? "接手操作" : "重新連線"}
        </button>
      )}
    </span>
  );
  const controls = (
    <>
      <button disabled={pending > 0 || hasRetry} onClick={() => void pause()}>
        返回探索（保留練習）
      </button>
      <button
        disabled={pending > 0 || hasRetry}
        onClick={() => void restartRound()}
      >
        {session.status === "completed" ? "開始新一輪" : "重新開始練習"}
      </button>
    </>
  );
  const workstationChanged = useCallback(
    (open: boolean) => setPlace(open ? "workstation" : "model"),
    [],
  );
  return (
    <section className="persistent-practice-room">
      {session.kind === "daily" ? (
        <SimulatorWorkspace
          assessment={{
            mode: "practice",
            daily,
            actions: {
              practice: true,
              dispatch: (c) => dispatch(c, "workstation"),
              disabled: blocked,
              qcSavedVersion,
            },
            disabled: blocked,
            status: saveStatus,
            feedback,
            controls,
            onWorkstationChange: workstationChanged,
            prepare: (a) =>
              dispatch({ type: "preparation", data: { ...a } }, "model"),
            bottle: (id, a) => {
              void dispatch(
                {
                  type: "bottle",
                  target: id,
                  value: a.kind,
                  data: { fluid: "fluid" in a ? a.fluid : "" },
                },
                "model",
              );
            },
          }}
        />
      ) : (
        <>
          <div className="practice-session-bar">
            {saveStatus}
            {controls}
          </div>
          <TroubleshootingRoom
            state={session.sim.troubleshooting!}
            busy={pending > 0}
            locked={blocked}
            networkFailure={hasRetry}
            feedback={feedback}
            onAction={(a: TroubleAction) =>
              dispatch({ type: "troubleshooting", data: { ...a } }, "model")
            }
            onReturn={() => void pause()}
            onReset={() => void restartRound()}
            onRetry={
              hasRetry
                ? () => {
                    if (retryRequest.current) void send(retryRequest.current);
                  }
                : undefined
            }
          />
        </>
      )}
      <p className="training-time-note">
        本輪有效練習時間{" "}
        {Math.floor(
          Math.max(
            activity.timing?.activeMs ?? 0,
            session.timing.activeMs ?? 0,
          ) / 60000,
        )}{" "}
        分{" "}
        {Math.floor(
          (Math.max(
            activity.timing?.activeMs ?? 0,
            session.timing.activeMs ?? 0,
          ) %
            60000) /
            1000,
        )}{" "}
        秒
      </p>
    </section>
  );
}
