// "처음 연 기기만": 링크마다 Firestore 문서 하나(links/{지문})에 처음 연 브라우저의
// 익명 로그인 uid 를 적는다. 다른 브라우저는 그 문서를 읽을 수도, 덮어쓸 수도 없다.
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

async function doClaim(secret) {
  const { fs, db, uid } = await init();
  const ref = fs.doc(db, 'links', await linkId(secret));
  let snap;
  try {
    snap = await fs.getDocFromServer(ref);
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
  if (snap.exists()) return snap.data().uid === uid ? 'mine' : 'other';
  try {
    // 문서가 이미 있으면(동시에 다른 기기가 먼저 열었으면) 규칙상 거부된다
    await fs.setDoc(ref, { uid, at: fs.serverTimestamp() });
  } catch (e) {
    if (e && e.code === 'permission-denied') return 'other';
    throw e;
  }
  return 'mine';
}

/**
 * 이 브라우저가 이 링크의 주인인지 확인하고, 아무도 열지 않았으면 이 브라우저로 정한다.
 * 결과: 'mine'(이 기기) | 'other'(다른 기기가 먼저 엶) | 'setup'(Firebase 설정 문제) | 'offline'
 */
export async function claim(secret) {
  try {
    return await withTimeout(doClaim(secret));
  } catch (e) {
    const code = (e && e.code) || '';
    if (SETUP_ERRORS.some((c) => code.startsWith(c))) return 'setup';
    if (typeof console !== 'undefined') console.warn('claim failed', code, e);
    return 'offline';
  }
}
