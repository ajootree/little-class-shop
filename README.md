# 수업상점 · 작은 성취를 차곡차곡

교과전담 교사가 여러 반의 수업 과제를 확인하고, 학생이 적립한 포인트로 작은 보상을 구매하는 Firebase 기반 웹앱입니다. 교사별로 ‘○○ 선생님의 ○○상점’을 개설합니다.

## 기능

- 교사 Google 로그인, 상점·학급 개설, 학생 일괄 등록, 모둠·모둠장 지정
- 개인 입장 코드·학생별 링크 발급, 코드 재발급과 이전 세션 접근 해제
- 과제 등록, 교사 또는 해당 모둠장의 수행 확인, 포인트 적립·확인 취소
- 상품 가격·재고·진열 관리, 학생 구매, 교사 보상 지급·취소 및 환급
- 학생별 포인트 원장, 학급 요약, CSV 내보내기
- 로그인 없이 조작 가능한 가상 학급 체험. 실제 Firebase 기록과 분리
- 토끼 상점과 상품은 생성한 PNG 이미지. 상점 이름과 수치는 실제 글자

## 개발

Node.js 24와 npm을 사용합니다.

```text
npm ci --ignore-scripts
npm run build
npm run dev
```

로컬 주소: http://127.0.0.1:8842/

```text
npm test
npm run test:rules
```

규칙 검사는 Java 21 이상과 Firebase Firestore Emulator가 필요합니다. 운영 프로젝트에 테스트 자료를 넣지 않습니다. 배포 대상은 `dist/`뿐입니다. Firebase SDK는 브라우저용으로 번들되며 서버 비밀키를 사용하지 않습니다.

## Firebase

프로젝트 ID: `class-shop-f0f24`. 클라이언트 설정은 `src/config.mjs`에 있습니다. 이 웹 설정은 공개 식별 정보이며 관리자 자격 증명이 아닙니다.

Authentication: Google(교사), 익명(학생의 개인 입장 코드와 결합). 교사·학생 모두 브라우저 세션 인증을 사용합니다. 학생이 같은 개인 코드로 다른 기기에 입장하면 학생 문서의 UID가 바뀌며 이전 세션은 접근을 잃습니다. 코드를 재발급하면 기존 코드를 비활성화하고 학생 UID 연결을 해제합니다.

규칙: `firestore.rules`. 기본 거부, 교사 상점 소유권, 학생 본인, 교사가 허용한 모둠장 범위를 검사합니다. 역할과 잔액을 클라이언트 화면의 숨김에 의존하지 않습니다. 수행 확인·구매·환급은 `runTransaction`과 `getAfter()` 보안 검증으로 원장·잔액·재고·상태가 함께 바뀌어야만 허용합니다. 원장은 수정·삭제할 수 없습니다.

참고: 모둠장은 같은 모둠 학생의 이름·잔액·수행 상태를 볼 수 있습니다. 개인 코드와 구매 원장은 볼 수 없습니다. 학생 이름 대신 별명을 사용할 수 있습니다. 개인 코드는 비밀번호처럼 학생 본인에게만 전달하세요. 공유 링크의 코드는 URL fragment에 담고 입장 완료 후 제거합니다. 로그인 유지가 필요하면 같은 브라우저 세션을 사용합니다.

운영 보안 설정과 검증 결과는 [보안 기록](docs/security.md), 제출 초안은 [과제 제출 자료](docs/submission.md)를 확인하세요.

## 배포

GitHub Pages는 `.github/workflows/pages.yml`을 사용합니다. 저장소 Settings → Pages → Source: GitHub Actions로 설정합니다. `main` 업로드 시 기본 검사·빌드 후 `dist/`를 배포합니다. 규칙 배포는 이 워크플로에 포함하지 않으며 Firebase 콘솔 또는 인증된 Firebase CLI에서 별도로 적용합니다.

Firebase 인증 허용 도메인과 웹 API 키 HTTP 리퍼러에 실제 배포 origin을 등록해야 합니다. GitHub Pages는 cross-origin 요청에 경로가 생략될 수 있으므로 `https://ajootree.github.io/*`를 등록합니다. 이 제한이 데이터 접근 권한을 대체하지 않으며 Firestore 규칙을 반드시 함께 배포해야 합니다.

## 이미지·글꼴

`dist/assets/shopfront.png`, `dist/assets/products.png`는 내장 image_gen 도구로 생성했습니다. 후자는 2×2 이미지 아틀라스입니다. 도형으로 캐릭터나 상품을 그리지 않습니다. 실제 사용한 프롬프트는 [이미지 제작 기록](docs/image-prompts.md)에 보관합니다.

주아체: Google Fonts / Woowahan Brothers, SIL Open Font License. 원문은 `dist/assets/Jua-OFL.txt`에 포함합니다.
