// src/lib/api.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

export async function api(path, { method = "GET", body, token } = {}) {
  const t = token || localStorage.getItem("token") || "";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.message || data?.error || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}
