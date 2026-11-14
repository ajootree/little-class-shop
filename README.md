# 수업상점

교사의 수업 과제 확인, 학생 포인트 적립, 보상 구매를 위한 웹앱입니다.

## 실행

Node.js 24를 사용합니다.

```sh
npm ci --ignore-scripts
npm run build
npm run dev
```

로컬 주소: http://127.0.0.1:8842/

## Firebase와 배포

- Firebase 클라이언트 설정: `src/config.mjs`
- 인증: 교사 Google 로그인, 학생 Firebase 이메일/비밀번호 인증. 학생에게 실제 이메일을 받지 않습니다.
- 학생 가입·로그인: 학급 가입 코드, 이름, 비밀번호. 교사 승인 후 이용할 수 있습니다.
- Firestore 접근 규칙: `firestore.rules`. 규칙은 인증된 Firebase CLI에서 별도로 배포합니다.
- 웹 배포: `main` 변경 시 GitHub Actions가 검사·빌드 후 `dist/`를 GitHub Pages에 배포합니다.
- Firebase 인증 승인 도메인과 API 키의 HTTP 리퍼러 허용 목록에 실제 사용 주소를 등록해야 합니다. 데이터 권한은 Firestore 규칙에서 별도로 검증합니다.

## 검사

`npm test`로 기본 검사를 실행합니다. Firebase 인증·권한 검사는 Java 21 이상을 준비한 뒤 `npm run test:rules`로 실행합니다. 규칙 검사는 운영 데이터와 분리된 로컬 에뮬레이터를 사용합니다.

## 글꼴 라이선스

주아체: Woowahan Brothers, SIL Open Font License. 원문: `dist/assets/Jua-OFL.txt`.
