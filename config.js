// 웹페이지 설정 — 여기만 바꾸면 된다.
window.DETOX_CONFIG = {
  // "나도 해보기" Play 스토어 주소. 비워 두면 버튼이 숨겨진다.
  // 예) "https://play.google.com/store/apps/details?id=com.jh7002.digitaldetox"
  // utm_source=friend_code 는 자동으로 붙는다.
  playStoreUrl: "",

  // "처음 연 기기만" 확인용 Firebase (프로젝트 phonshimpyo, Firestore 서울).
  // 웹 앱 설정값은 공개되어도 되는 값이고, 실제 보호는 Firestore 보안 규칙이 한다.
  firebase: {
    apiKey: "AIzaSyBGtq8bPEbkMcAJ8Fl_eRuMwWAg0absrn0",
    authDomain: "phonshimpyo.firebaseapp.com",
    projectId: "phonshimpyo",
    storageBucket: "phonshimpyo.firebasestorage.app",
    messagingSenderId: "202082776743",
    appId: "1:202082776743:web:892fdaf831f65d2300cd82",
  },
};
