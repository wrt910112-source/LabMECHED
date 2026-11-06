import { useEffect, useSyncExternalStore } from "react";
import type { User } from "../shared/exam";
import { api } from "./examApi";
let state = {
  user: null as User | null,
  loading: true,
  requiresInitialization: false,
  error: "",
};
let pending: Promise<User | null> | null = null;
const listeners = new Set<() => void>();
function emit() {
  for (const listener of listeners) listener();
}
export function setSessionUser(user: User | null) {
  state = { ...state, user, loading: false, error: "" };
  emit();
}
export function refreshAccountSession(): Promise<User | null> {
  if (pending) return pending;
  pending = api<{ user: User | null; requiresInitialization: boolean }>(
    "/auth/status",
  )
    .then((r) => {
      state = {
        user: r.user,
        loading: false,
        requiresInitialization: r.requiresInitialization,
        error: "",
      };
      emit();
      return r.user;
    })
    .catch((e) => {
      state = { ...state, loading: false, error: (e as Error).message };
      emit();
      return null;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}
export function useAccountSession() {
  const snapshot = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => state,
  );
  useEffect(() => {
    if (state.loading) void refreshAccountSession();
  }, []);
  return snapshot;
}
