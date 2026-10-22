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
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method || "GET",
      credentials: "same-origin",
      headers:
        options.body === undefined
          ? undefined
          : { "Content-Type": "application/json" },
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
  let data: T & { message?: string };
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "本地服務沒有回傳有效資料。請確認以 npm run dev 或 npm start 啟動。",
      response.status,
    );
  }
  if (!response.ok)
    throw new ApiError(
      data.message || "資料尚未保存，請重試。",
      response.status,
    );
  return data;
}
