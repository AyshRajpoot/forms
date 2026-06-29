/** Backend origin only (e.g. https://my-api.onrender.com). No trailing slash; do not add /api — paths already start with /api/… */
function normalizeApiBase(raw) {
  let base = String(raw ?? "").trim();
  base = base.replace(/\/+$/, "");
  if (base.endsWith("/api")) {
    base = base.slice(0, -4);
  }
  return base;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);

if (import.meta.env.PROD && !API_BASE) {
  // eslint-disable-next-line no-console
  console.warn(
    "[api] VITE_API_URL is empty: /api requests hit this deployment. Host the Express app elsewhere and set VITE_API_URL to that server’s origin (no /api suffix)."
  );
}

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...authHeader(),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message =
      data?.message ||
      (data?.errors && typeof data.errors === "object" && Object.values(data.errors).join(", ")) ||
      res.statusText ||
      "Request failed";
    const err = new Error(message);
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}

export function setToken(token) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

export function getToken() {
  return localStorage.getItem("token");
}
