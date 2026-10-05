const API_BASE = "http://https://budnbudder-backend.onrender.com/api";

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;

  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    const error = new Error(
      data?.message || "Something went wrong."
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

window.BNB_API = {
  get: (path) =>
    apiFetch(path),

  post: (path, body) =>
    apiFetch(path, {
      method: "POST",
      body: JSON.stringify(body)
    }),

  patch: (path, body) =>
    apiFetch(path, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),

  delete: (path) =>
    apiFetch(path, {
      method: "DELETE"
    })
};