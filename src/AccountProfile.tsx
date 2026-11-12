import { useState, type FormEvent } from "react";
import {
  departments,
  identities,
  experiences,
  frequencies,
  maintenanceKinds,
  tenureDefinition,
  validateProfile,
  type LearnerProfile,
} from "../shared/accounts";
import type { User } from "../shared/exam";
import { api } from "./examApi";
import { setSessionUser } from "./accountSession";

export function PasswordChange({
  user,
  onSaved,
  onCancel,
}: {
  user: User;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    if (fields.get("newPassword") !== fields.get("confirmation")) {
      setError("兩次新密碼不一致。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api<{ user: User }>("/auth/change-password", {
        method: "POST",
        body: {
          currentPassword: fields.get("currentPassword"),
          newPassword: fields.get("newPassword"),
        },
      });
      setSessionUser(r.user);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="account-password account-panel" onSubmit={submit}>
      <h1>{user.mustChangePassword ? "首次登入，請更換密碼" : "變更密碼"}</h1>
      <p>帳號：{user.username}。更換後其他登入工作階段會失效，教學紀錄保留。</p>
      <label>
        目前／臨時密碼
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </label>
      <label>
        新密碼
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </label>
      <label>
        再次輸入新密碼
        <input
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </label>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      <button className="exam-primary" disabled={busy}>
        {busy ? "保存中…" : "儲存新密碼"}
      </button>
      {!user.mustChangePassword && onCancel && (
        <button type="button" onClick={onCancel} disabled={busy}>
          返回任務選單
        </button>
      )}
    </form>
  );
}
export function ProfileForm({
  profile,
  user,
  onSave,
  onCancel,
}: {
  profile: LearnerProfile | null;
  user: User;
  onSave: (p: LearnerProfile) => Promise<void>;
  onCancel?: () => void;
}) {
  const [p, setP] = useState<LearnerProfile>(
    profile || {
      nickname: "",
      department: "",
      identity: "",
      clinicalMonths: 0,
      experience: "",
      usageFrequency: "",
      maintenanceKinds: [],
      maintenanceFrequency: "",
    },
  );
  const [years, setYears] = useState(String(Math.floor(p.clinicalMonths / 12))),
    [months, setMonths] = useState(String(p.clinicalMonths % 12));
  const [maintenanceAnswered, setAnswered] = useState(!!profile),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = (key: keyof LearnerProfile, value: string) =>
    setP({ ...p, [key]: value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (!maintenanceAnswered)
        throw Error("請選擇曾親自執行的保養，或勾選無親自保養經驗。");
      const y = Number(years),
        m = Number(months);
      if (
        !years ||
        !months ||
        !Number.isInteger(y) ||
        !Number.isInteger(m) ||
        y < 0 ||
        m < 0 ||
        m > 11
      )
        throw Error("年資請填非負整數年與 0–11 月。");
      const normalized = validateProfile({ ...p, clinicalMonths: y * 12 + m });
      setBusy(true);
      await onSave(normalized);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const select = (
    key:
      | "department"
      | "identity"
      | "experience"
      | "usageFrequency"
      | "maintenanceFrequency",
    label: string,
    options: readonly string[],
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        required
        value={p[key]}
        onChange={(e) => set(key, e.target.value)}
      >
        <option value="">請選擇</option>
        {options.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </label>
  );
  return (
    <form
      className="account-profile account-panel"
      onSubmit={submit}
      aria-label="學員背景資料"
    >
      <h1>{profile ? "更新學員資料" : "完成學員資料"}</h1>
      <p>首次填寫後可更新；新考試會保存當次背景快照，更新不改寫歷史資料。</p>
      <div className="account-profile-grid">
        <section>
          <h2>帳號與個人背景</h2>
          <div className="account-identity">
            <p>學員代碼：{user.learnerCode}</p>
            <p>登入帳號：{user.username}</p>
            <p>
              系統權限：{user.role === "administrator" ? "管理員" : "學員"}
              （與下列身分分開）
            </p>
          </div>
          <label>
            暱稱
            <input
              value={p.nickname}
              onChange={(e) => set("nickname", e.target.value)}
              required
              maxLength={80}
              autoComplete="nickname"
            />
          </label>
          {select("department", "所屬組別", departments)}
          {select("identity", "主要身分（單選）", identities)}
          <fieldset>
            <legend>臨床年資</legend>
            <div className="account-tenure">
              <label>
                年
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  required
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                />
              </label>
              <label>
                月
                <input
                  type="number"
                  min={0}
                  max={11}
                  step={1}
                  required
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                />
              </label>
            </div>
            <p>{tenureDefinition}</p>
          </fieldset>
        </section>
        <section>
          <h2>AU5800 經驗</h2>
          {select("experience", "AU5800 使用經驗", experiences)}
          {select("usageFrequency", "最近一年使用頻率", frequencies)}
          <fieldset>
            <legend>曾親自執行的保養（可複選）</legend>
            <label className="account-check">
              <input
                type="checkbox"
                checked={maintenanceAnswered && !p.maintenanceKinds.length}
                onChange={(e) => {
                  setAnswered(e.target.checked);
                  setP({ ...p, maintenanceKinds: [] });
                }}
              />
              <span>無親自保養經驗</span>
            </label>
            {maintenanceKinds.map((k) => (
              <label className="account-check" key={k}>
                <input
                  type="checkbox"
                  checked={p.maintenanceKinds.includes(k)}
                  onChange={(e) => {
                    const kinds = e.target.checked
                      ? [...p.maintenanceKinds, k]
                      : p.maintenanceKinds.filter((x) => x !== k);
                    setP({ ...p, maintenanceKinds: kinds });
                    setAnswered(kinds.length > 0);
                  }}
                />
                <span>{k}</span>
              </label>
            ))}
          </fieldset>
          {select("maintenanceFrequency", "最近一年保養操作頻率", frequencies)}
          <div className="account-research">
            <h3>研究使用</h3>
            <p>
              尚未啟用，依院內核定程序辦理。研究使用與教學登入分開，本頁沒有研究同意勾選。
            </p>
          </div>
          <p>
            目前可新開：日保養、QC
            異常處理。練習進度會保存，可跨重新整理與登入接續；返回探索會暫停有效計時。
          </p>
        </section>
      </div>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      <footer>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy}>
            取消
          </button>
        )}
        <button className="exam-primary" disabled={busy}>
          {busy ? "保存中…" : "儲存學員資料"}
        </button>
      </footer>
    </form>
  );
}
