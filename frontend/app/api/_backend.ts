// Shared helper for proxying to the FastAPI backend (hosted on Render's free tier,
// which sleeps when idle and can take ~30-50s to wake up).
export const BACKEND = process.env.BACKEND_API_URL || 'http://localhost:8000';

export async function backendFetch(path: string, init: RequestInit = {}, timeoutMs = 55000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BACKEND}${path}`, { ...init, cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
