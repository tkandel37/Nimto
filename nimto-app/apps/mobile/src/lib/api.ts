import Constants from "expo-constants";

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
export const API_URL = (configuredApiUrl || "http://localhost:4000").replace(
  /\/$/,
  "",
);

export const WEB_URL = (
  process.env.EXPO_PUBLIC_WEB_URL || "http://localhost:3000"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);
  if (requestOptions.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set(
    "X-Nimto-Client",
    `mobile/${Constants.expoConfig?.version ?? "development"}`,
  );

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      headers,
    });
  } catch {
    throw new ApiError(
      "Could not connect to myNimto. Check your internet connection and API URL.",
      0,
    );
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : Array.isArray(data.message)
          ? data.message.join(" ")
          : "Something went wrong. Please try again.";
    throw new ApiError(message, response.status);
  }
  return data as T;
}
