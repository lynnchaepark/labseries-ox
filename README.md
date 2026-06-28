# Lab Series OX Championship V1

## 화면 주소
- 참가자: `/`
- 진행자: `/?mode=admin`

## 필요 설정
이 버전은 진행자 시작 버튼, 동시 시작, 참가자 답변 저장, 조별 최고 득점자 표시를 위해 Firebase Realtime Database를 사용합니다.

`app.js` 상단의 `firebaseConfig`를 본인 Firebase 프로젝트 값으로 교체해야 동작합니다.

## 문제 수정
`app.js`의 `QUESTIONS` 배열에서 문제와 정답을 수정하면 됩니다.

## 시간 수정
`app.js`의 `DURATION = 15` 값을 바꾸면 문제당 제한시간이 변경됩니다.
