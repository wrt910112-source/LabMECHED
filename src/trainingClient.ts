import type { TrainingMode } from "../shared/training";

type Lease = {
  mode: TrainingMode;
  id: string;
  token?: string;
  sequence: number;
  pending?: Promise<string>;
  error?: string;
  blocked?: boolean;
  mounted: number;
  authenticationExpired?: boolean;
};
const leases = new Map<string, Lease>();
const viewId = crypto.randomUUID();
const keyFor = (mode: TrainingMode, id: string) => `${mode}:${id}`;
function notify() {
  window.dispatchEvent(new Event("training-lease-changed"));
}
async function request(
  path: string,
  body: unknown,
  token?: string,
  keepalive = false,
) {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Training-Lease": token } : {}),
      },
      body: JSON.stringify(body),
      keepalive,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw Object.assign(new Error("無法確認保存，請恢復連線後重試。"), {
      status: 0,
    });
  }
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.message || "訓練連線失敗。"), {
      status: response.status,
      reason: data.reason,
    });
  return data;
}
export function registerTraining(mode: TrainingMode, id: string) {
  const key = keyFor(mode, id);
  const l = leases.get(key) || { mode, id, sequence: 0, mounted: 0 };
  l.mounted++;
  leases.set(key, l);
  return l;
}
export function unregisterTraining(mode: TrainingMode, id: string) {
  const l = leases.get(keyFor(mode, id));
  if (l) l.mounted = Math.max(0, l.mounted - 1);
}
export function leaseState(mode: TrainingMode, id: string) {
  return leases.get(keyFor(mode, id));
}
export async function acquireTraining(
  mode: TrainingMode,
  id: string,
  takeover = false,
): Promise<string> {
  const l = leases.get(keyFor(mode, id));
  if (!l) throw new Error("訓練尚未連線。");
  if (l.pending) return l.pending;
  if (l.blocked && !takeover)
    throw Object.assign(new Error(l.error || "請先接手操作。"), {
      status: 423,
    });
  l.pending = request("/training/lease", {
    mode,
    sessionId: id,
    viewId,
    takeover,
  })
    .then((data) => {
      l.authenticationExpired = false;
      l.token = data.token;
      l.sequence = 0;
      l.blocked = false;
      l.error = undefined;
      notify();
      return data.token;
    })
    .catch((error) => {
      l.token = undefined;
      l.authenticationExpired = error.status === 401;
      l.error = error.message;
      l.blocked = error.status === 423 && error.reason !== "lease_expired";
      notify();
      throw error;
    })
    .finally(() => {
      l.pending = undefined;
    });
  return l.pending;
}
export async function trainingHeaders(
  path: string,
): Promise<Record<string, string>> {
  const match = path.match(
    /^\/(attempts|practice-sessions)\/([^/]+)\/(events|submit|abandon|restart|poll)$/,
  );
  if (!match) return {};
  const mode = match[1] === "attempts" ? "exam" : "practice",
    l = leases.get(keyFor(mode, match[2]));
  if (!l || !l.mounted) return {};
  const token = l.token || (await acquireTraining(mode, match[2]));
  return { "X-Training-Lease": token };
}
export function rejectTraining(path: string, message: string, reason?: string) {
  const m = path.match(/^\/(attempts|practice-sessions)\/([^/]+)/);
  if (!m) return;
  const l = leases.get(keyFor(m[1] === "attempts" ? "exam" : "practice", m[2]));
  if (l) {
    l.token = undefined;
    l.blocked = reason !== "lease_expired";
    l.error = message;
    notify();
  }
}
export async function pulseTraining(
  mode: TrainingMode,
  id: string,
  visible: boolean,
  age: number,
  release = false,
  keepalive = false,
) {
  const l = leases.get(keyFor(mode, id));
  if (!l) return null;
  if (!l.token) {
    if (release) return null;
    await acquireTraining(mode, id);
  }
  const sentToken = l.token;
  try {
    const data = await request(
      "/training/activity",
      {
        mode,
        sessionId: id,
        sequence: ++l.sequence,
        visible,
        lastActivityAgeMs: Math.max(0, Math.min(86400000, age)),
        release,
      },
      sentToken,
      keepalive,
    );
    if (l.token !== sentToken) return null;
    l.error = undefined;
    if (release) l.token = undefined;
    notify();
    return data;
  } catch (error) {
    const e = error as Error & { status?: number; reason?: string };
    if (l.token !== sentToken) return null;
    l.authenticationExpired = e.status === 401;
    l.error = e.message;
    l.token = undefined;
    l.blocked = e.status === 423 && e.reason !== "lease_expired";
    notify();
    throw e;
  }
}
