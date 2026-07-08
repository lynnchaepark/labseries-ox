export const QUESTIONS = [
  {
    type: "ox",
    text: "남성의 피부는\n빛을 다양한 방향으로 반사하여\n피부가 더욱 칙칙해 보입니다.",
    answer: "O",
    points: 1
  },
  {
    type: "ox",
    text: "남성과 여성의 피부는\n기본 구조부터 다르기 때문에,\n각각에 맞는 제품과 케어가 필요하다.",
    answer: "X",
    points: 1
  },
  {
    type: "ox",
    text: "남성피부는 호르몬의 영향으로\n여성보다 지방 함량이 많아\n피부가 더 두껍다.",
    answer: "X",
    points: 1
  },
  {
    type: "short",
    text: "남성의 표피와 진피는 여성보다 최대 약 20% 더 두껍습니다.\n\n또한 남성은 (          ) 밀도가 높아 피부가 더욱 단단한 느낌을 주며, 주름이 나타나는 시기가 여성에 비해 상대적으로 이릅니다.",
    placeholder: "정답 입력",
    answers: ["콜라겐", "collagen"],
    points: 1
  },
  {
    type: "blanks",
    text: "호르몬 차이에 의해 남성은 여성보다 약 (   )~(   )% 더 많은 땀을 흘립니다.\n\n또한 반복적인 면도로 피부 장벽이 손상되어 수분이 유실되며, 여성보다 수분 함유량이 (   )배 적습니다.",
    fields: [
      { key: "sweatMin", label: "첫 번째 빈칸", placeholder: "예: 30" },
      { key: "sweatMax", label: "두 번째 빈칸", placeholder: "예: 40" },
      { key: "water", label: "세 번째 빈칸", placeholder: "예: 3" }
    ],
    points: 1
  },
  {
    type: "multi",
    text: "남성 피부에 영향을 주는 요인을 모두 선택해주세요.",
    options: [
      { label: "면도", correct: true },
      { label: "폐경", correct: false },
      { label: "남성호르몬", correct: true },
      { label: "높은 근육 함량으로 인한 무게감", correct: true }
    ],
    points: 1
  }
];

export const TEAM_LABELS = ["1조", "2조", "3조", "4조"];
