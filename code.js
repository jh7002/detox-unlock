// 하루 해제 숫자 계산 — 앱(UnlockCode.kt)과 똑같은 방식.
// HMAC-SHA256(키 = 비밀 키 바이트, 메시지 = 한국 날짜 "YYYY-MM-DD") → RFC 4226 방식으로 6자리.
(function (root) {
  function b64urlToBytes(s) {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // 한국 시간 기준 오늘 날짜 "YYYY-MM-DD"
  function kstDate(now) {
    return new Date((now ?? Date.now()) + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }

  // 한국 시간 자정까지 남은 밀리초
  function msUntilKstMidnight(now) {
    const t = (now ?? Date.now()) + 9 * 3600 * 1000;
    const day = 24 * 3600 * 1000;
    return day - (t % day);
  }

  async function unlockCode(secret, dateStr) {
    const key = await crypto.subtle.importKey(
      'raw', b64urlToBytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dateStr)));
    const o = h[h.length - 1] & 0x0f;
    const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(bin % 1000000).padStart(6, '0');
  }

  function isValidSecret(s) {
    if (!s || !/^[A-Za-z0-9_-]{16,64}$/.test(s)) return false;
    try { return b64urlToBytes(s).length >= 16; } catch (e) { return false; }
  }

  const api = { unlockCode, kstDate, msUntilKstMidnight, isValidSecret, b64urlToBytes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DetoxCode = api;
})(typeof window !== 'undefined' ? window : globalThis);
