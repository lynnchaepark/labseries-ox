# Lab Series OX Championship - Team Version

## 접속 주소
- 참가자: https://labseries-ox.vercel.app
- 진행자: https://labseries-ox.vercel.app/admin.html

## 변경된 방식
- 개인전이 아니라 팀당 1명만 접속합니다.
- 참가자는 이름 없이 조만 선택합니다. (1조~4조)
- 진행자가 START를 눌러야 시작됩니다.
- 각 팀은 O/X 답변을 선택하고 `다음 문제로 넘어가기`를 눌러 다음 문제로 이동합니다.
- 최종 순위는 점수 높은 순으로 결정됩니다.
- 동점이면 전체 제출 소요시간이 짧은 팀이 승리합니다.
- 진행자가 `결과 공개` 버튼을 눌러야 참가자 화면에 결과가 표시됩니다.

## OX 문제 수정 방법
`questions.js` 파일에서 QUESTIONS 배열의 text와 answer만 수정하면 됩니다.

```js
{
  text: "문제 내용",
  answer: "O"
}
```

정답은 반드시 `O` 또는 `X`로 입력하세요.
