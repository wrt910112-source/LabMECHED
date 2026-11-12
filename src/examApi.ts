import { trainingHeaders, rejectTraining } from "./trainingClient";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let training: Record<string, string>;
  try {
    training = await trainingHeaders(path);
  } catch (error) {
    const e = error as Error & { status?: number };
    throw new ApiError(e.message, e.status || 0);
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: {
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...training,
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      "無法連線至本地服務。這次操作尚未確認保存，請恢復連線後重試。",
      0,
    );
  }
  let data: T & { message?: string; reason?: string };
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "本地服務沒有回傳有效資料。請確認以 npm run dev 或 npm start 啟動。",
      response.status,
    );
  }
  if (response.status === 423)
    rejectTraining(path, data.message || "請先接手操作。", data.reason);
  if (!response.ok)
    throw new ApiError(
      data.message || "資料尚未保存，請重試。",
      response.status,
    );
  return data;
}
