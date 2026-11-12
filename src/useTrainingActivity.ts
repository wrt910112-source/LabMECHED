import { useCallback, useEffect, useRef, useState } from "react";
import type { PracticeSession, Timing, TrainingMode } from "../shared/training";
import {
  acquireTraining,
  leaseState,
  pulseTraining,
  registerTraining,
  unregisterTraining,
} from "./trainingClient";

export function useTrainingActivity(
  mode: TrainingMode,
  id: string,
  enabled: boolean,
  onSession?: (session: PracticeSession) => void,
) {
  const [, render] = useState(0),
    [timing, setTiming] = useState<Timing | null>(null);
  const callback = useRef(onSession);
  callback.current = onSession;
  const lastActivity = useRef(Date.now()),
    pending = useRef(0);
  const pulse = useCallback(
    async (release = false, keepalive = false, immediate = false) => {
      if (pending.current > 0 && !release && !immediate) return;
      pending.current++;
      try {
        const data = await pulseTraining(
          mode,
          id,
          !release && document.visibilityState === "visible",
          Date.now() - lastActivity.current,
          release,
          keepalive,
        );
        if (data?.timing) setTiming(data.timing);
        if (data?.session) callback.current?.(data.session);
      } finally {
        pending.current = Math.max(0, pending.current - 1);
      }
    },
    [mode, id],
  );
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    registerTraining(mode, id);
    lastActivity.current = Date.now();
    const changed = () => render((n) => n + 1);
    window.addEventListener("training-lease-changed", changed);
    void acquireTraining(mode, id)
      .then(() => {
        if (active) return pulse();
        // A task can close while its initial lease response is in flight.
        // Never start timing after unmount or release a newer mounted view.
        if (!leaseState(mode, id)?.mounted) return pulse(true, true);
      })
      .catch(() => {});
    const activity = () => {
      const wasIdle = Date.now() - lastActivity.current >= 120000;
      lastActivity.current = Date.now();
      if (wasIdle) void pulse(false, false, true).catch(() => {});
    };
    const visibility = () => {
      if (document.visibilityState === "visible")
        lastActivity.current = Date.now();
      void pulse(false, false, true).catch(() => {});
    };
    const pagehide = () => {
      void pulse(true, true).catch(() => {});
    };
    const timer = window.setInterval(() => {
      void pulse().catch(() => {});
    }, 15000);
    for (const event of [
      "pointerdown",
      "pointermove",
      "keydown",
      "touchstart",
      "wheel",
    ])
      window.addEventListener(event, activity, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    return () => {
      active = false;
      clearInterval(timer);
      for (const event of [
        "pointerdown",
        "pointermove",
        "keydown",
        "touchstart",
        "wheel",
      ])
        window.removeEventListener(event, activity);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("training-lease-changed", changed);
      void pulse(true, true).catch(() => {});
      unregisterTraining(mode, id);
    };
  }, [mode, id, enabled, pulse]);
  const state = leaseState(mode, id);
  return {
    timing,
    error: state?.error || "",
    blocked: !!state?.blocked,
    authenticationExpired: !!state?.authenticationExpired,
    ready: !!state?.token,
    pause: () => pulse(true),
    reconnect: async (takeover = false) => {
      await acquireTraining(mode, id, takeover);
      await pulse();
    },
  };
}
