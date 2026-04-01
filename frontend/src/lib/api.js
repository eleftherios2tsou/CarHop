// base URL prefix for all API calls — the backend is mounted at /api
const API = "/api";

// this function reads a cookie by name from document.cookie
// we need it to grab the CSRF token before any state-changing request
export function getCookie(name) {
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return ""; // return empty string if the cookie isn't found
}

// convenience wrapper — just gets the csrf_token cookie specifically
export function getCsrfToken() {
  return getCookie("csrf_token");
}

// this is the main function used throughout the app to call backend endpoints
// it handles JSON headers, CSRF tokens, auth cookie refresh, and error messages automatically
export async function apiFetch(path, { onAuthError, _retried, ...opts } = {}) {
  const method = (opts.method || "GET").toUpperCase();

  // start building the headers — spread any custom headers the caller passed in
  const headers = {
    ...(opts.headers || {}),
    // only add Content-Type: application/json if there's a body to send
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
  };

  // GET, HEAD, and OPTIONS are "safe" methods — they don't change data
  // so we only need to attach the CSRF token for the unsafe ones (POST, PUT, DELETE, etc.)
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (unsafe) {
    const csrf = getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf; // attach the token so the server accepts the request
  }

  // make the actual fetch call — credentials: "include" is important so cookies get sent
  const res = await fetch(`${API}${path}`, {
    ...opts,
    method,
    headers,
    credentials: "include",
  });

  // read the raw response text first, then try to parse it as JSON
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text; // if it's not valid JSON, just use the raw string
  }

  // if we get a 401 and haven't already retried, attempt a token refresh
  // this happens when the access token has expired but the refresh token is still valid
  if (res.status === 401 && !_retried) {
    try {
      const r = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      // if the refresh worked, retry the original request exactly once
      if (r.ok) return apiFetch(path, { onAuthError, _retried: true, ...opts });
    } catch {
      // ignore errors from the refresh attempt — we'll fall through to the auth error handler
    }
    // refresh failed — notify the parent component so it can redirect to login
    if (onAuthError) onAuthError();
    throw new Error("Session expired. Please login again.");
  }

  // any other non-2xx response — try to extract a human-readable error message from the response body
  if (!res.ok) {
    const msg =
      (data?.detail &&
        (Array.isArray(data.detail)
          ? JSON.stringify(data.detail)
          : data.detail)) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data; // happy path — return the parsed response body
}

// same as apiFetch but for multipart form data (e.g. file uploads)
// we deliberately don't set Content-Type here because the browser needs to set it
// automatically with the correct multipart boundary
export async function apiFetchForm(path, formData, { onAuthError, _retried } = {}) {
  const headers = {};
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf; // still need CSRF even for file uploads

  const res = await fetch(`${API}${path}`, {
    method: "POST",
    body: formData,
    headers,
    credentials: "include",
  });

  // same text → JSON parsing logic as apiFetch above
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  // same 401 refresh logic as above — try to refresh the access token and retry once
  if (res.status === 401 && !_retried) {
    try {
      const r = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (r.ok) return apiFetchForm(path, formData, { onAuthError, _retried: true });
    } catch {
      // ignore
    }
    if (onAuthError) onAuthError();
    throw new Error("Session expired. Please login again.");
  }

  if (!res.ok) {
    const msg =
      (data?.detail &&
        (Array.isArray(data.detail)
          ? JSON.stringify(data.detail)
          : data.detail)) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}
