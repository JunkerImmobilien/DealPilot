// http.js — schlanker fetch-Wrapper: Timeout, Retry mit Backoff, 429-Handling.
// Native fetch (Node 22), kein axios.

export async function httpJson(url, opts = {}) {
  const {
    method = 'GET',
    headers = {},
    body = null,
    timeoutMs = 15000,
    retries = 2,
    retryOn = [429, 500, 502, 503, 504],
  } = opts;

  let attempt = 0;
  let lastErr = null;

  while (attempt <= retries) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      clearTimeout(t);

      if (!res.ok) {
        if (retryOn.includes(res.status) && attempt < retries) {
          const wait = backoff(attempt, res);
          await sleep(wait);
          attempt++;
          continue;
        }
        const text = await safeText(res);
        const err = new Error(`HTTP ${res.status} ${url} :: ${text.slice(0, 300)}`);
        err.status = res.status;
        throw err;
      }
      return await res.json();
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      // AbortError oder Netzfehler -> retry, falls noch Versuche da
      if (attempt < retries) {
        await sleep(backoff(attempt));
        attempt++;
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr || new Error('httpJson: unbekannter Fehler');
}

// Wie httpJson, gibt aber rohen Text + Content-Type zurueck (fuer GML/XML/HTML).
export async function httpText(url, opts = {}) {
  const {
    method = 'GET', headers = {}, timeoutMs = 15000, form = null, body = null,
    retries = 1, retryOn = [429, 500, 502, 503, 504],
  } = opts;
  // GENESIS/Regionalstatistik erwartet application/x-www-form-urlencoded (nicht JSON -> sonst HTTP 415).
  let sendBody, sendHeaders = { ...headers };
  if (form) {
    sendBody = new URLSearchParams(Object.fromEntries(
      Object.entries(form).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
    )).toString();
    sendHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (body) {
    sendBody = JSON.stringify(body);
    sendHeaders['Content-Type'] = 'application/json';
  }
  let attempt = 0, lastErr = null;
  while (attempt <= retries) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers: sendHeaders, body: sendBody, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) {
        if (retryOn.includes(res.status) && attempt < retries) {
          await sleep(backoff(attempt, res)); attempt++; continue;
        }
        const text = await safeText(res);
        const err = new Error(`HTTP ${res.status} ${url} :: ${text.slice(0, 300)}`);
        err.status = res.status;
        throw err;
      }
      return { text: await res.text(), contentType: res.headers.get('content-type') || '' };
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < retries) { await sleep(backoff(attempt)); attempt++; continue; }
      throw lastErr;
    }
  }
  throw lastErr || new Error('httpText: unbekannter Fehler');
}

function backoff(attempt, res) {
  // Respektiere Retry-After-Header falls vorhanden
  if (res && res.headers) {
    const ra = res.headers.get('retry-after');
    if (ra && !isNaN(parseInt(ra, 10))) return parseInt(ra, 10) * 1000;
  }
  return Math.min(8000, 500 * Math.pow(2, attempt)); // 500, 1000, 2000...
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
