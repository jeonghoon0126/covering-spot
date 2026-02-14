import type { ProcessStep } from "@/types";

export const processSteps: ProcessStep[] = [
  { num: "01", title: "품목 선택", desc: "버리고 싶은 품목을\n선택하세요" },
  { num: "02", title: "일정 예약", desc: "원하는 날짜와\n시간을 선택하세요" },
  { num: "03", title: "문 앞 배출", desc: "예약일에 문 앞에\n놓아두세요" },
  { num: "04", title: "수거 완료", desc: "깔끔하게\n수거해 갑니다" },
];
