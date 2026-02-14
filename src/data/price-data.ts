import type { PriceCategory } from "@/types";

export const priceCategories: PriceCategory[] = [
  {
    id: "sofa",
    icon: "🛋️",
    title: "소파",
    subtitle: "1인용부터 대형 소파까지",
    rows: [
      { label: "1~2인용 소파", value: "15,000 ~ 25,000원", barPercent: 40 },
      {
        label: "3인용 이상 / L자형",
        value: "25,000 ~ 40,000원",
        barPercent: 60,
      },
    ],
  },
  {
    id: "bed",
    icon: "🛏️",
    title: "침대",
    subtitle: "싱글부터 킹사이즈까지",
    rows: [
      { label: "싱글/슈퍼싱글", value: "25,000 ~ 35,000원", barPercent: 45 },
      { label: "더블/퀸/킹", value: "35,000 ~ 50,000원", barPercent: 65 },
      { label: "프레임 포함", value: "50,000 ~ 70,000원", barPercent: 85 },
    ],
  },
  {
    id: "fridge",
    icon: "🧊",
    title: "냉장고",
    subtitle: "소형부터 양문형까지",
    rows: [
      { label: "소형 (200L 이하)", value: "25,000 ~ 35,000원", barPercent: 45 },
      { label: "대형 / 양문형", value: "40,000 ~ 60,000원", barPercent: 75 },
    ],
  },
  {
    id: "washer",
    icon: "🫧",
    title: "세탁기",
    subtitle: "일반 세탁기부터 건조기까지",
    rows: [
      { label: "일반 세탁기", value: "25,000 ~ 35,000원", barPercent: 45 },
      { label: "드럼 / 건조기", value: "35,000 ~ 50,000원", barPercent: 65 },
    ],
  },
  {
    id: "desk",
    icon: "🪑",
    title: "책상/의자",
    subtitle: "학생 책상부터 사무용까지",
    rows: [
      { label: "일반 책상", value: "15,000 ~ 25,000원", barPercent: 35 },
      {
        label: "사무용 / L형 책상",
        value: "25,000 ~ 37,000원",
        barPercent: 55,
      },
      { label: "의자", value: "8,000 ~ 15,000원", barPercent: 20 },
    ],
  },
  {
    id: "ac",
    icon: "❄️",
    title: "에어컨",
    subtitle: "이동식부터 스탠드까지",
    rows: [
      {
        label: "이동식 / 벽걸이",
        value: "30,000 ~ 40,000원",
        barPercent: 55,
      },
      { label: "스탠드형", value: "40,000 ~ 60,000원", barPercent: 75 },
    ],
  },
  {
    id: "etc",
    icon: "📦",
    title: "기타",
    subtitle: "그 외 대형 폐기물",
    rows: [
      { label: "자전거", value: "10,000 ~ 15,000원", barPercent: 20 },
      {
        label: "러닝머신 / 운동기구",
        value: "30,000 ~ 50,000원",
        barPercent: 65,
      },
      { label: "의류 박스 (개당)", value: "5,000원", barPercent: 10 },
    ],
  },
];
