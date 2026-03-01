import type { Booking } from "@/types/booking";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00+09:00");
  return DAYS[d.getDay()];
}

// ── 기본 블록 빌더 ──────────────────────────────────────────

export function headerBlock(text: string) {
  return { type: "header", text: { type: "plain_text", text } };
}

export function sectionBlock(text: string) {
  return { type: "section", text: { type: "mrkdwn", text } };
}

export function fieldBlock(label: string, value: string) {
  return { type: "mrkdwn", text: `*${label}*\n${value}` };
}

export function fieldsBlock(fields: Array<{ label: string; value: string }>) {
  return {
    type: "section",
    fields: fields.map((f) => fieldBlock(f.label, f.value)),
  };
}

export function dividerBlock() {
  return { type: "divider" };
}

export function actionButtonBlock(
  buttons: Array<{ text: string; url: string; primary?: boolean }>,
) {
  return {
    type: "actions",
    elements: buttons.map((btn) => ({
      type: "button",
      text: { type: "plain_text", text: btn.text },
      url: btn.url,
      ...(btn.primary ? { style: "primary" } : {}),
    })),
  };
}

// ── 예약 공통 컨텍스트 블록 ──────────────────────────────────

/**
 * 날짜 / 지역 / 고객명+전화 / 주소 4개 필드를 포함한 section 블록.
 * sendBookingCreated, sendQuoteConfirmed, sendStatusChanged 등에서 공통 사용.
 */
export function bookingContextBlock(
  b: Pick<
    Booking,
    "date" | "timeSlot" | "area" | "customerName" | "phone" | "address" | "addressDetail" | "preferredSlots"
  >,
) {
  const fields: { label: string; value: string }[] = [
    { label: "날짜", value: `${b.date} (${getDayName(b.date)}) ${b.timeSlot}` },
    { label: "지역", value: b.area },
    { label: "고객", value: `${b.customerName} (${b.phone})` },
    { label: "주소", value: `${b.address} ${b.addressDetail}` },
  ];
  if (b.preferredSlots && b.preferredSlots.length > 1) {
    fields.push({ label: "선호시간대", value: b.preferredSlots.join(", ") });
  }
  return fieldsBlock(fields);
}
