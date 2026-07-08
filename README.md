# Lab Series Quiz Championship V4

## 접속 주소
- 참가자: `https://labseries-ox.vercel.app`
- 진행자: `https://labseries-ox.vercel.app/admin.html`

## 이번 버전 변경사항
- 이름 입력 제거: 조 드롭다운만 선택
- 개인전이 아닌 팀 대표 1명씩 참여
- OX / 단답형 / 빈칸형 / 다중선택형 지원
- 답변 후 `다음 문제로 넘어가기` 버튼으로 진행
- 최종 결과는 1등~4등, 점수, 제출 소요시간 표시
- 동점 시 제출 소요시간이 짧은 팀이 상위 순위

## 문제 수정 위치
`questions.js` 파일에서 문제와 정답을 수정합니다.

### OX 예시
```js
{
  type: "ox",
  text: "문제 문장",
  answer: "O",
  points: 1
}
```

### 단답형 예시
```js
{
  type: "short",
  text: "문제 문장",
  answers: ["콜라겐", "collagen"],
  points: 1
}
```

### 다중선택형 예시
```js
{
  type: "multi",
  text: "모두 선택해주세요.",
  options: [
    { label: "정답 보기", correct: true },
    { label: "오답 보기", correct: false }
  ],
  points: 1
}
```


## 최종 수정 사항
- 결과 화면에서 이름 대신 조명(1조~4조)만 표시합니다.
- undefined 표시 방지를 위해 조명 fallback을 추가했습니다.
- 동점 시 제출 소요시간이 짧은 조가 상위 순위로 표시됩니다.
