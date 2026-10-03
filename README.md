# K영어회화 문장 만들기

CSV의 원본 문장으로 만든 정적 HTML/CSS/JavaScript 학습 앱입니다. 문장 데이터는 UI 및 학습 로직과 분리해 `data/kenglish.json`에서 관리합니다.

## 실행

ES modules와 JSON fetch를 사용하므로 파일을 직접 여는 대신 로컬 웹 서버에서 실행하세요.

- VS Code의 Live Server에서 `index.html`을 엽니다.
- 또는 저장소 루트에서 `npx serve .`를 실행한 뒤 표시된 주소를 엽니다.

로그인하지 않아도 Unit 선택, 문장 학습, 퀴즈, TTS, 포인트, 캐릭터 기능을 사용할 수 있습니다. 로그인 전 학습 기록은 현재 브라우저의 `localStorage`에 저장됩니다.

## Firebase 인증 및 동기화 설정

`firebase-config.js`에는 `kenglish-prompt.md`에 제공된 웹 앱 설정이 들어 있습니다. 계정 및 다른 사용자의 진행률 비교를 사용하려면 Firebase Console에서 다음을 설정해야 합니다.

1. Authentication에서 이메일/비밀번호 제공업체를 활성화합니다.
2. Firestore Database를 생성합니다.
3. 저장소 루트의 `firestore.rules`를 프로젝트에 배포합니다. Firebase CLI 사용 시 `firebase deploy --only firestore:rules`를 실행합니다.
4. 앱을 HTTPS 호스팅 또는 localhost에서 엽니다.

회원가입 아이디는 `아이디@kenglish.app` 형식의 Firebase 이메일 로그인 식별자로 변환됩니다. 닉네임과 로그인 아이디는 닉네임 선택 로그인을 위해 읽을 수 있는 프로필 목록에 저장되며, 비교 순위 문서는 닉네임과 전체 진행률만 저장합니다. 상세 학습 기록은 로그인한 본인만 읽고 쓸 수 있도록 규칙을 분리했습니다.

## 원본 데이터 처리

- `data/kenglish.json`은 최신 `kenglish.csv`의 779개 행을 열 이름만 지정된 구조로 변환한 파일입니다.
- 데이터에 있는 Part 01~05의 Unit 75개를 사용합니다. CSV의 원본 문장은 수정하거나 추가하지 않았습니다.
- 퀴즈 정답 판정은 대소문자, 공백, 일반적인 문장 부호 및 apostrophe 표기 차이를 무시합니다. 단어 자체는 바꾸지 않습니다.
