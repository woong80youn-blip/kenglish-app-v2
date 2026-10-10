내가 아래에 영어 학습 문장 원본 데이터를 제공할 것이다.

이 데이터를 기반으로 영어문장 학습 앱을 만들어줘.

# 1. 개발 방법

처음부터 모든 기능을 한꺼번에 구현하지 말고,
아래의 각 단계가 완료될 때마다 내가 직접 실행해서 확인할 수 있도록 해줘.

Html, css, javascript 로 개발해줘.
사용자 인증 및 데이터 저장은 아래 정보를 이용하여 firebase-config.js 를 만들고 Firebase 에 저장해줘. 

<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyDdQesDvR7SLoBvOl3AEdpXoH8jVHsXBOo",
    authDomain: "kenglish-db.firebaseapp.com",
    projectId: "kenglish-db",
    storageBucket: "kenglish-db.firebasestorage.app",
    messagingSenderId: "352695723380",
    appId: "1:352695723380:web:2ce0ff8d2e4391f1727821",
    measurementId: "G-T7MKS473EH"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>

---

# 2. 중요한 원칙

내가 제공하는 원본 영어/한국어 문장을 콘텐츠의 절대적인 기준으로 사용한다.

원본에 없는 내용은 임의로 생성하지 않는다.

문장에 문제가 있다고 판단되더라도 임의로 수정하지 말고 나에게 먼저 알려준다.

앱을 만드는 과정에서 원본 데이터와 앱 기능을 철저하게 분리한다.

먼저 내가 제공하는 텍스트를 분석하고,
데이터 구조와 검증 결과를 보여준 다음,
내가 확인하면 실제 앱 개발을 시작해라.

---

# 3. 원본 데이터

원본 데이터는 kenglish.csv 파일이야.
No.,Title,Part 번호,Unit 번호,Unit 제목,강의영상 보기 URL,문장 번호,한국어문장(실생활 영어 표현 익히기),영어문장(영어 문장 확인하기)로 이루어져 있다.

구조는 다음과 같다.

* Part 5개
* Unit 75개

각 Unit별 문장은 한국어와 영어가 한 쌍으로 구성되어 있다.

중요:
이 데이터는 내가 직접 작성한 원본 콘텐츠이므로 절대로 임의로 수정하지 마라.

다음 행위는 금지한다.

* 문장 수정
* 문장 자연스럽게 고치기
* 문장 추가
* 문장 삭제
* 문장 순서 변경
* 번역 수정
* AI가 새로운 문장 생성
* 원문에 없는 표현을 정답으로 추가

원본 데이터에 있는 문장을 그대로 앱의 학습 데이터로 사용한다.

---

# 4. 데이터 구조화

원본 텍스트를 다음 구조로 변환해라.

Part
→ Unit
→ Sentence

각 문장은 다음 정보를 갖도록 한다.

* no
* title
* part_no
* unit_no
* unit_title
* unit_url
* sentence_no
* korean
* english

예:

{
"no": "01",
"title": "K영어회화",
"part_no": "Part 01",
"unit_no": "Unit 01",
"unit_title": "영어는 '주어 + 동사'로 시작한다",
"unit_url": "https://www.youtube.com/watch?v=dChiYEk7Lxc",
"sentence_no": "01",
"korean": "나는 집에 간다. (I home go)",
"english": "I go home."
}

원본 문장은 그대로 유지한다.

---

# 5. 데이터와 앱 분리

가장 중요한 요구사항이다.
문장을 UI 코드에 직접 작성하지 마라.
문장 데이터는 별도의 데이터 파일로 관리한다.

예:

/data/kenglish.json

UI와 학습 로직은 kenglish.json을 읽어서 작동하도록 한다.

향후 내가 문장을 수정하거나 추가할 때
앱의 UI 코드를 수정하지 않고 데이터 파일만 변경할 수 있도록 만들어라.

---

# 6. 화면 디자인 참고

PC의 웹브라우져뿐만이 아니라 모바일화면에서도 잘 볼 수 있도록 크기 및 배치가 자동으로 조정되어야해.

참고 이미지는 ./images/k_ref01.png 파일이야.
앱을 캡처한 여러이미지가 있는데 화면 구성시 색감, 구도, 이미지를 참고해줘.

아이들도 좋아하도록 ./images/mood 에 있는 12개 이미지의 캐릭터를 각 화면에 자연스러운 크기로 배치해줘. 
캐릭터의 배경은 투명처리 하고 각 화면의 이미지에 잘 어울리도록 크기를 달리하고 배치해줘.

---

# 7. 앱의 핵심 기능

앱에는 다음 메뉴가 있다.

## 홈

* Unit, Part, 전체 학습 진행률 :  등록된 사용자들과 비교 할 수 있도록 전체 사용자별 전체 진행률을 비교 표시
* Unit별, 날짜별 정답수
* 학습하기 / 영어문장만들기 퀴즈
* 사용자 로그인/로그아웃
* point
* 기분 캐릭터 선택


## Unit 선택 ( 다중선택 )

각 Unit을 표시하여 선택 할 수 있도록 한다.


# 8. 학습모드

선택한 Unit의 전체문장을 순서대로 학습한다. TTS 기능으로 발음 연습을 할 수 있도록한다.

화면에는:

Unit 번호,Unit 제목,강의영상 보기 URL 와
각각의 문장 번호,한국어문장(실생활 영어 표현 익히기),영어문장(영어 문장 확인하기) 를
목록으로 보여준다.

---

# 9. 영어문장 만들기 퀴즈

선택된 Unit 에서 문제수를 스크롤로 선택 할 수 있도록 한다. 1개~선택된 Unit의 총문장수
퀴즈에서는 한국어 문장만 보여준다.
퀴즈의 문장순서는 랜덤하게 나타낸다.

예:

한국어:

"원본 한국어 문장"

학습자가 영어 문장을 입력한다.

[정답 확인]

입력한 문장과 원본 영어 문장을 비교한다.

결과:

정답, 멋진 칭찬의 메시지
또는
오답, 재미있고 익살스러운 응원의 메시지

정답일 경우 다음 문제로 이동한다.

오답일 경우 원본 영어 문장을 보여주고,
다시 풀 수 있도록 한다.

퀴즈 화면 상단에 현재 문제와 전체 문제 수가 문제 1 / 10 형식으로 표시되도록 한다. 
다음 문제로 넘어갈 때 현재 번호도 함께 갱신된다.

---

# 10. 힌트기능

영어문장 만들기 퀴즈시 힌트를 참고 할 수 있도록 한다.

힌트는 원본 영어 문장을 단어 단위로 분리하여 섞어서 보여 준다.

예:
[every] [I] [morning] [coffee] [drink]

반드시 원본 영어 문장을 기준으로 단어를 생성한다.

AI가 임의로 다른 문장을 만들지 않는다.

---

# 11. 채점

기본적으로 원본 영어 문장과 비교한다.

다음 차이는 가능하면 허용한다.

* 대문자/소문자
* 문장 앞뒤 공백
* 문장 마지막 마침표
* 특수문자, 문장기호
* 일반적인 apostrophe 차이

예:

I'm a student.

Im a  student

이러한 표기 차이는 가능하면 같은 답으로 처리한다.

단, 원본 문장의 의미나 문법을 변경하는 표현은 임의로 정답 처리하지 않는다.

---

# 12. 학습 진행률

문장별 학습 상태와 정답을 맞춘 횟수를 저장한다.

상태:

* 미학습
* 학습중(오답)
* 학습완료(정답)

Unit별 진행률, part별 진행률, 전체 진행률을 자동으로 계산한다. 

전체 진행률은 높은 진행률 순으로 정렬하고 퍼센트를 소수 둘째 자리까지 보여준다.

정답수:

문장별 정답을 맞출때마다 정답수를 +1 한다.

---

# 13. Point 

다음 규칙으로 Point를 계산한다. 
point 버튼을 누르면 point 산정 근거를 보여준다.

* 문장별 정답수 * 10 point
* 진행률 100% Unit 수 * 500 point
* 진행률 100% Part 수 * 1000 Point
* 강의 영상 보기 클릭 수 * 50 point ( unit당 최초 1회만 부여 )
* 5일연속 학습하면 + 1000 point, point가 주어진 이후 5일 연속시 + 1000 point
* 10일연속 학습하면 + 3000 point, point가 주어진 이후 10일 연속시 + 3000 point
* 전체진행률이 100% 에도달하면 특별선물이 주어진다는 축하의 메시지가 담긴 멋진 팝업 생성

Point를 중간에 사용할 수 있도록 팝업에 포인트 사용 기능과 차감 내역을 추가. 
(양수는 포인트 차감, 음수는 포인트 복구. 0과 보유 포인트를 초과하는 차감은 허용하지 않음)

---

# 14. 기분 캐릭터 

기분 캐릭터를 선택 할 수 있다. 

캐릭터이미지는 ./images/mood 에 있는 12개 이미지를 사용해줘. 12개 캐릭터의 이름은 각 파일명과 같아. 

기분 캐릭터를 선택하면, 선택한 캐릭터가 화면 구성 이미지에 사용 되고 캐릭터의 색상을 중심으로 어울리는 색상의 분위기로 바뀐다.

주요버튼의 색상은 캐릭터의 색상과 같게 한다.

---
# 15. 사용자 인증

firebase 를 이용해서 사용자등록 및 인증을 한다.

사용자 등록 : 
id, 닉네임, 비밀번호 를 입력 ( firebase 의 식별자에 입력하기 위해 id를 이메일주소로 변경하여 등록한다. 제공업체 : 이메일/비밀번호 )


로그인 :
firebase 에 등록된 사용자의 닉네임을 목록으로 보여주고 선택 하게 한다. 
닉네임 선택과 비밀번호 입력를 입력하여 로그인한다.
로그인 후 로그인 버튼은 로그아웃 버튼으로 변경한다.

---

