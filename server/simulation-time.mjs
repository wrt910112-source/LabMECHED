// Separate observation metadata: this never changes an existing grading result.
export function startSimulationTiming(state, now, partial = false) {
  if (!state.sim.troubleshooting || state.trainingWait) return state;
  state.trainingWait = {
    totalMs: 0,
    startedAt: null,
    due: null,
    closedAt: null,
    partial,
  };
  return observeSimulationTiming(state, now);
}

export function simulationWaiting(state, now) {
  const wait = state.trainingWait;
  if (!wait || !Number.isFinite(wait.totalMs)) return null;
  const tail =
    wait.startedAt !== null && wait.due !== null
      ? Math.max(
          0,
          Math.min(now, wait.due, wait.closedAt ?? Infinity) - wait.startedAt,
        )
      : 0;
  return wait.totalMs + tail;
}

export function observeSimulationTiming(state, now, finish = false) {
  const wait = state.trainingWait;
  if (!wait || wait.closedAt !== null) return state;
  wait.totalMs = simulationWaiting(state, now);
  const pending = !finish && state.sim.troubleshooting?.pending;
  const sameWait = pending && pending.due === wait.due;
  if (pending && pending.due > now) {
    wait.startedAt = sameWait ? Math.max(wait.startedAt ?? now, now) : now;
    wait.due = pending.due;
  } else {
    wait.startedAt = null;
    wait.due = null;
  }
  if (finish) wait.closedAt = now;
  return state;
}
