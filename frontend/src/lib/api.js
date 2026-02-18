const API = "/api";

export function getCookie(name) {
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function getCsrfToken() {
  return getCookie("csrf_token");
}

export async function apiFetch(path, { onAuthError, _retried, ...opts } = {}) {
  const method = (opts.method || "GET").toUpperCase();

  const headers = {
    ...(opts.headers || {}),
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
  };

  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (unsafe) {
    const csrf = getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(`${API}${path}`, {
    ...opts,
    method,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (res.status === 401 && !_retried) {
    try {
      const r = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (r.ok) return apiFetch(path, { onAuthError, _retried: true, ...opts });
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

export async function apiFetchForm(path, formData, { onAuthError, _retried } = {}) {
  const headers = {};
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;

  const res = await fetch(`${API}${path}`, {
    method: "POST",
    body: formData,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

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
