// src/lib/api.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

export async function api(path, { method = "GET", body, token } = {}) {
  const t = token || localStorage.getItem("token") || "";
  const url = `${API_BASE}${path}`;
  console.info('[api] request', method, url, body ? { body } : {});

  try {
    const isForm = (typeof FormData !== 'undefined') && body instanceof FormData;
    const res = await fetch(url, {
      method,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });

    const text = await res.text().catch(() => null);
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

    if (!res.ok) {
      const message = data?.message || data?.error || `HTTP ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.body = data;
      console.error('[api] response error', method, url, err);
      throw err;
    }

    console.debug('[api] response', method, url, data);
    return data;
  } catch (err) {
    console.error('[api] network/error', method, url, err);
    throw err;
  }
}
