// "처음 연 기기만": 링크마다 Firestore 문서 하나(links/{지문})에 처음 연 브라우저의
// 익명 로그인 uid 를 적는다. 다른 브라우저는 그 문서를 읽을 수도, 덮어쓸 수도 없다.
// 같은 문서에 앱이 "더 이상 쓸 수 없는 링크(revoked)", "오늘 사용함(usedDate)"을 적는다.
// 비밀 키는 서버로 보내지 않고, 되돌릴 수 없는 SHA-256 지문만 문서 이름으로 쓴다.
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const TIMEOUT_MS = 20000;

let ready = null;

// Firebase 는 확인이 필요할 때만 불러온다 (이미 확인된 숫자는 오프라인에서도 보이도록)
function init() {
  if (!ready) {
    ready = (async () => {
      const [{ initializeApp }, auth, fs] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-auth.js'),
        import(SDK + 'firebase-firestore.js'),
      ]);
      const app = initializeApp(window.DETOX_CONFIG.firebase);
      const a = auth.getAuth(app);
      // 이 브라우저에 저장된 익명 계정을 먼저 기다리고, 없으면 새로 만든다
      const saved = await new Promise((resolve) => {
        const off = auth.onAuthStateChanged(a, (u) => { off(); resolve(u); });
      });
      const user = saved || (await auth.signInAnonymously(a)).user;
      return { fs, db: fs.getFirestore(app), uid: user.uid };
    })();
    ready.catch(() => { ready = null; });
  }
  return ready;
}

export async function linkId(secret) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('detox-unlock:' + secret));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

function withTimeout(p) {
  return Promise.race([
    p,
    new Promise((_, reject) => setTimeout(() => reject({ code: 'timeout' }), TIMEOUT_MS)),
  ]);
}

const SETUP_ERRORS = [
  'auth/operation-not-allowed', 'auth/admin-restricted-operation', 'auth/unauthorized-domain',
  'auth/invalid-api-key', 'auth/api-key-not-valid', 'auth/requests-from-referer-are-blocked',
];

async function readDoc(fs, db, ref) {
  try {
    return await fs.getDocFromServer(ref);
  } catch (e) {
    if (e && e.code === 'permission-denied') {
      // 남이 먼저 연 링크인지, 보안 규칙이 아직 안 들어간 것인지 구분한다:
      // 규칙이 맞으면 없는 문서는 읽을 수 있다.
      try {
        await fs.getDocFromServer(fs.doc(db, 'links', '0'.repeat(64)));
      } catch (e2) {
        return 'setup';
      }
      return 'other';
    }
    throw e;
  }
}

// 친구가 열지 않은 채 만료됐는지: 서버 문서의 expireAt, 문서가 없으면(만료돼 지워졌거나 등록 전) 링크의 e= 값
function isExpired(d, exists, expireMs) {
  const at = d.expireAt && typeof d.expireAt.toMillis === 'function' ? d.expireAt.toMillis() : 0;
  if (at) return Date.now() >= at;
  return !exists && expireMs > 0 && Date.now() >= expireMs;
}

// 서버 문서를 보고 상태를 정한다. 등록이 필요하면 null
function stateOf(d, exists, uid, expireMs) {
  const usedDate = typeof d.usedDate === 'string' ? d.usedDate : '';
  // 보낸 사람이 새 링크로 바꿨거나 지운 링크
  if (d.revoked === true) return { state: 'revoked' };
  const opener = d.opener || d.uid || null;
  if (opener === uid) return { state: 'mine', usedDate };
  if (opener) return { state: 'other' };
  // 아무도 열지 않은 채 24시간이 지난 링크
  if (isExpired(d, exists, expireMs)) return { state: 'expired' };
  return null;
}

async function doClaim(secret, expireMs) {
  const { fs, db, uid } = await init();
  const ref = fs.doc(db, 'links', await linkId(secret));
  const snap = await readDoc(fs, db, ref);
  if (typeof snap === 'string') return { state: snap };
  const known = stateOf(snap.exists() ? snap.data() : {}, snap.exists(), uid, expireMs);
  if (known) return known;
  // 처음 열기(친구 등록): 트랜잭션으로 "아직 아무도 안 열었는지" 다시 보고 opener 를 적는다.
  // 만료 시각(expireAt)은 같은 쓰기에서 지운다 → 이제 친구가 열쇠를 가졌으니 만료되지 않는다.
  try {
    const result = await fs.runTransaction(db, async (tx) => {
      const cur = await tx.get(ref);
      const d = cur.exists() ? cur.data() : {};
      const s = stateOf(d, cur.exists(), uid, expireMs);
      if (s) return s;
      if (cur.exists()) {
        const open = { opener: uid, openedAt: fs.serverTimestamp() };
        if ('expireAt' in d) open.expireAt = fs.deleteField();
        tx.update(ref, open);
      } else {
        // 앱이 아직 등록하지 않은 링크 (예전에 보낸 링크, 앱이 오프라인 등)
        tx.set(ref, { opener: uid, openedAt: fs.serverTimestamp() });
      }
      return { state: 'mine', usedDate: typeof d.usedDate === 'string' ? d.usedDate : '' };
    });
    return result;
  } catch (e) {
    if (e && e.code === 'permission-denied') {
      // 그사이 다른 기기가 열었거나 만료·무효가 됐는지 한 번 더 보고, 아니면 "확인하지 못함"
      const again = await readDoc(fs, db, ref);
      if (typeof again === 'string') return { state: again };
      const s = stateOf(again.exists() ? again.data() : {}, again.exists(), uid, expireMs);
      if (s) return s;
      if (typeof console !== 'undefined') console.warn('claim write denied', e);
      return { state: 'failed' };
    }
    throw e;
  }
}

/**
 * 이 브라우저가 이 링크의 주인인지 확인하고, 아무도 열지 않았으면 이 브라우저로 정한다.
 * 결과 { state, usedDate }:
 *   state = 'mine'(이 기기) | 'other'(다른 기기가 먼저 엶) | 'revoked'(더 이상 쓸 수 없는 링크)
 *         | 'expired'(아무도 열지 않은 채 24시간이 지난 링크)
 *         | 'failed'(등록 쓰기가 거절됨 — 숫자를 보여 주지 않는다)
 *         | 'setup'(Firebase 설정 문제) | 'offline'
 *   usedDate = 보낸 사람이 코드로 해제한 한국 날짜 ("" 이면 없음)
 */
export async function claim(secret, expireMs = 0) {
  try {
    return await withTimeout(doClaim(secret, expireMs));
  } catch (e) {
    const code = (e && e.code) || '';
    if (SETUP_ERRORS.some((c) => code.startsWith(c))) return { state: 'setup' };
    if (typeof console !== 'undefined') console.warn('claim failed', code, e);
    return { state: 'offline' };
  }
}
