# 디톡스 해제 숫자 웹페이지 (GitHub Pages)

친구 폰에서 여는 정적 페이지예요. 서버와 비용 없이 동작해요.

- 링크의 `#k=...` 비밀 키는 `#` 뒤라서 서버(GitHub)로 전송되지 않아요.
- 처음 연 브라우저의 localStorage에 키를 저장하고, 주소창에서는 키를 지워요.
- 한국 시간 날짜로 HMAC-SHA256을 계산해 6자리 숫자를 보여줘요. 앱(`UnlockCode.kt`)과 똑같이 계산해요.
- `config.js`의 `playStoreUrl`을 채우면 "나도 해보기" 버튼이 보여요. 비워 두면 숨겨져요.

## 올리는 방법
이 폴더의 파일 6개(`index.html`, `code.js`, `config.js`, `manifest.webmanifest`, `sw.js`, `icon.svg`)를
**공개 저장소**(예: `detox-unlock`)의 맨 위에 올리고, Settings → Pages에서 `main` 브랜치 `/ (root)`로 켜면 돼요.
주소는 `https://<계정>.github.io/detox-unlock/`가 되고, 앱의 `app_links.properties`에 같은 주소를 넣어요.
