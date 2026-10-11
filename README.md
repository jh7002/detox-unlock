# 디톡스 해제 숫자 웹페이지 (GitHub Pages + Firebase)

친구 폰에서 여는 정적 페이지예요.

- 링크의 `#k=...` 비밀 키는 `#` 뒤라서 서버로 전송되지 않아요.
- 한국 시간 날짜로 HMAC-SHA256을 계산해 6자리 숫자를 보여줘요. 앱(`UnlockCode.kt`)과 똑같이 계산해요.
- **처음 연 기기만** (`claim.js`): 링크를 처음 열면 Firebase 익명 로그인 후 Firestore `links/{SHA-256 지문}` 문서에
  그 브라우저의 uid를 적어요. 다른 브라우저는 그 문서를 읽거나 덮어쓸 수 없어서 "이미 다른 기기에서 열린 링크예요"가 보여요.
  비밀 키는 보내지 않고, 되돌릴 수 없는 지문만 써요. 확인된 링크는 localStorage에 표시해 두어 다음부터는 오프라인에서도 보여요.
- **앱과 연결**: 앱(`FriendCloud.kt`)이 같은 문서에 링크를 등록(owner)하고, 새 링크로 바꾸거나 친구를 지우면 `revoked`,
  코드로 해제한 날은 `usedDate`를 적어요. 웹페이지는 가장 최근 링크의 숫자 1개만 보이고, 무효 링크는 지우고,
  `usedDate`가 오늘이면 숫자 대신 "오늘은 사용함"을 보여줘요. 앱은 `opener`/`openedAt`으로 친구가 열었는지 보여줘요.
- `config.js`: `playStoreUrl`(비우면 "나도 해보기" 숨김), `firebase`(웹 앱 설정값).
- `firestore.rules`: Firebase 콘솔 → Firestore → 규칙 탭에 붙여넣을 보안 규칙. (웹페이지 저장소에는 올리지 않아도 돼요.)

## 올리는 방법
`index.html`, `code.js`, `claim.js`, `config.js`, `manifest.webmanifest`, `sw.js`, `icon.svg`, `terms.html`, `privacy.html`을
**공개 저장소**(`detox-unlock`)의 맨 위에 올리고, Settings → Pages에서 `main` 브랜치 `/ (root)`로 켜면 돼요.

## Firebase 설정 (프로젝트 phonshimpyo)
1. Authentication → 로그인 방법 → **익명** 사용 설정
2. Authentication → 설정 → 승인된 도메인에 `jh7002.github.io` 추가
3. Firestore → 규칙 탭에 `firestore.rules` 내용을 붙여넣고 게시
