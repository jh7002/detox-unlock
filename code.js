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

  // ── 링크를 보낸 사람 기기의 시간대 (링크의 z=). 없으면(예전 링크) 한국 시간 ──
  const LEGACY_ZONE = 'Asia/Seoul';

  function validZone(z) {
    if (!z) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch (e) { return false; }
  }

  function zoneOrLegacy(z) { return validZone(z) ? z : LEGACY_ZONE; }

  // [zone] 의 지금 시각 {y, mo, d, h, mi, s}
  function partsIn(zone, now) {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const p = {};
    for (const x of f.formatToParts(new Date(now ?? Date.now()))) p[x.type] = x.value;
    return p;
  }

  // [zone] 기준 오늘 날짜 "YYYY-MM-DD"
  function zoneDate(zone, now) {
    if (zoneOrLegacy(zone) === LEGACY_ZONE) return kstDate(now);
    const p = partsIn(zoneOrLegacy(zone), now);
    return `${p.year}-${p.month}-${p.day}`;
  }

  // [zone] 기준 자정까지 남은 밀리초
  function msUntilZoneMidnight(zone, now) {
    if (zoneOrLegacy(zone) === LEGACY_ZONE) return msUntilKstMidnight(now);
    const t = now ?? Date.now();
    const p = partsIn(zoneOrLegacy(zone), t);
    const elapsed = ((+p.hour * 60 + +p.minute) * 60 + +p.second) * 1000 + (t % 1000);
    return Math.max(1000, 24 * 3600 * 1000 - elapsed);
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

  const api = {
    unlockCode, kstDate, msUntilKstMidnight, isValidSecret, b64urlToBytes,
    LEGACY_ZONE, validZone, zoneOrLegacy, zoneDate, msUntilZoneMidnight,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DetoxCode = api;
})(typeof window !== 'undefined' ? window : globalThis);
