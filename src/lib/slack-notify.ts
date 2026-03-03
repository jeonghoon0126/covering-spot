import type { Booking } from "@/types/booking";
import { STATUS_LABELS } from "@/lib/constants";
import {
  headerBlock,
  sectionBlock,
  fieldsBlock,
  dividerBlock,
  actionButtonBlock,
  bookingContextBlock,
} from "@/lib/slack-blocks";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://spot.covering.co.kr";

/** Slack 알림 전용 라벨 (constants 기본값 + Slack 워딩 오버라이드) */
const SLACK_STATUS_LABELS: Record<string, string> = {
  ...STATUS_LABELS,
  pending: "접수 대기",
  payment_requested: "결제 요청",
  payment_completed: "결제 완료",
  rejected: "거절",
};

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

function formatManWon(n: number): string {
  return Math.round(n / 10000) + "만원";
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00+09:00");
  const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  return DAYS[d.getDay()];
}

// Slack chat.postMessage (스레드 지원, ts 반환)
async function postSlack(
  blocks: unknown[],
  threadTs?: string,
): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!token || !channel) return null;

  try {
    const body: Record<string, unknown> = { channel, blocks };
    if (threadTs) body.thread_ts = threadTs;

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return data.ok ? (data.ts as string) : null;
  } catch {
    return null;
  }
}

// 스레드 텍스트 답글
export async function sendThreadReply(
  threadTs: string,
  text: string,
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!token || !channel || !threadTs) return;

  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        thread_ts: threadTs,
        text,
      }),
    });
  } catch {
    // Slack 실패가 예약을 막으면 안 됨
  }
}

// 새 예약 접수 → 메인 메시지 (thread_ts 반환)
export async function sendBookingCreated(b: Booking): Promise<string | null> {
  const itemLines = b.items
    .map(
      (i) =>
        `• ${i.displayName || i.category + " " + i.name} x${i.quantity} - ${formatPrice(i.price * i.quantity)}`,
    )
    .join("\n");

  const envText = [
    `엘리베이터: ${b.hasElevator ? "있음" : "없음"}`,
    `주차: ${b.hasParking ? "가능" : "불가"}`,
  ].join(" | ");

  const itemTotal = b.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const blocks: unknown[] = [
    headerBlock("📋 새 수거 예약 접수"),
    bookingContextBlock(b),
    sectionBlock(`*작업환경*\n${envText}`),
    dividerBlock(),
    sectionBlock(`*품목*\n${itemLines}`),
    fieldsBlock([
      { label: "품목 합계", value: formatPrice(itemTotal) },
      { label: `인력비 (${b.crewSize}명)`, value: formatPrice(b.totalPrice - itemTotal - b.ladderPrice) },
      { label: "사다리차", value: b.needLadder ? formatPrice(b.ladderPrice) : "없음" },
      { label: "총 견적", value: `*${formatPrice(b.totalPrice)}*` },
    ]),
    fieldsBlock([
      { label: "예상 견적 범위", value: `${formatManWon(b.estimateMin)} ~ ${formatManWon(b.estimateMax)}` },
      { label: "사진", value: b.photos.length > 0 ? `${b.photos.length}장 첨부` : "없음" },
    ]),
    ...(b.memo ? [sectionBlock(`*요청사항*\n${b.memo}`)] : []),
  ];

  // 사진 이미지 블록 추가 (최대 5장)
  if (b.photos.length > 0) {
    blocks.push(dividerBlock());
    for (const [idx, url] of b.photos.slice(0, 5).entries()) {
      blocks.push({
        type: "image",
        image_url: url,
        alt_text: `품목 사진 ${idx + 1}`,
      });
    }
  }

  blocks.push(
    actionButtonBlock([
      { text: "상세 보기", url: `${BASE_URL}/admin/bookings/${b.id}`, primary: true },
    ]),
  );

  return await postSlack(blocks);
}

export async function sendBookingUpdated(b: Booking): Promise<void> {
  // 스레드가 있으면 스레드 답글로
  if (b.slackThreadTs) {
    await sendThreadReply(
      b.slackThreadTs,
      `✏️ 예약 수정됨\n날짜: ${b.date} (${getDayName(b.date)}) ${b.timeSlot}\n총 견적: ${formatPrice(b.totalPrice)}`,
    );
    return;
  }

  const blocks = [
    headerBlock("✏️ 수거 예약 수정"),
    fieldsBlock([
      { label: "날짜", value: `${b.date} (${getDayName(b.date)}) ${b.timeSlot}` },
      { label: "지역", value: b.area },
      { label: "고객", value: `${b.customerName} (${b.phone})` },
      { label: "총 견적", value: `*${formatPrice(b.totalPrice)}*` },
    ]),
    actionButtonBlock([
      { text: "상세 보기", url: `${BASE_URL}/admin/bookings/${b.id}`, primary: true },
    ]),
  ];

  await postSlack(blocks);
}

export async function sendBookingDeleted(b: Booking): Promise<void> {
  // 스레드가 있으면 스레드 답글로
  if (b.slackThreadTs) {
    await sendThreadReply(b.slackThreadTs, `❌ 예약 취소됨\n고객: ${b.customerName} (${b.phone})`);
    return;
  }

  const blocks = [
    headerBlock("❌ 수거 예약 취소"),
    fieldsBlock([
      { label: "날짜", value: `${b.date} (${getDayName(b.date)}) ${b.timeSlot}` },
      { label: "고객", value: `${b.customerName} (${b.phone})` },
      { label: "총 견적", value: formatPrice(b.totalPrice) },
    ]),
    actionButtonBlock([
      { text: "관리자 페이지", url: `${BASE_URL}/admin`, primary: true },
    ]),
  ];

  await postSlack(blocks);
}

export async function sendQuoteConfirmed(b: Booking): Promise<void> {
  // 스레드가 있으면 스레드 답글로
  if (b.slackThreadTs) {
    const lines = [
      `💰 견적 확정`,
      `최종 금액: ${b.finalPrice != null ? formatPrice(b.finalPrice) : "미정"}`,
      `예상 범위: ${formatManWon(b.estimateMin)} ~ ${formatManWon(b.estimateMax)}`,
    ];
    if (b.adminMemo) lines.push(`관리자 메모: ${b.adminMemo}`);
    await sendThreadReply(b.slackThreadTs, lines.join("\n"));
    return;
  }

  const blocks = [
    headerBlock("💰 견적 확정"),
    bookingContextBlock(b),
    dividerBlock(),
    fieldsBlock([
      { label: "예상 견적 범위", value: `${formatManWon(b.estimateMin)} ~ ${formatManWon(b.estimateMax)}` },
      { label: "최종 확정 금액", value: `*${b.finalPrice != null ? formatPrice(b.finalPrice) : "미정"}*` },
    ]),
    ...(b.adminMemo ? [sectionBlock(`*관리자 메모*\n${b.adminMemo}`)] : []),
    actionButtonBlock([
      { text: "관리자 페이지", url: `${BASE_URL}/admin`, primary: true },
    ]),
  ];

  await postSlack(blocks);
}

export async function sendStatusChanged(
  b: Booking,
  newStatus: string,
): Promise<void> {
  const statusLabel = SLACK_STATUS_LABELS[newStatus] || newStatus;

  // 스레드가 있으면 스레드 답글로
  if (b.slackThreadTs) {
    const lines = [`🔄 상태 변경: ${statusLabel}`];
    if (b.finalPrice != null) lines.push(`최종 금액: ${formatPrice(b.finalPrice)}`);
    if (b.adminMemo) lines.push(`관리자 메모: ${b.adminMemo}`);
    await sendThreadReply(b.slackThreadTs, lines.join("\n"));
    return;
  }

  const blocks = [
    headerBlock(`🔄 예약 상태 변경: ${statusLabel}`),
    fieldsBlock([
      { label: "날짜", value: `${b.date} (${getDayName(b.date)}) ${b.timeSlot}` },
      { label: "지역", value: b.area },
      { label: "고객", value: `${b.customerName} (${b.phone})` },
      { label: "상태", value: `*${statusLabel}*` },
    ]),
    ...(b.finalPrice != null ? [sectionBlock(`*최종 금액*\n${formatPrice(b.finalPrice)}`)] : []),
    ...(b.adminMemo ? [sectionBlock(`*관리자 메모*\n${b.adminMemo}`)] : []),
    actionButtonBlock([
      { text: "관리자 페이지", url: `${BASE_URL}/admin`, primary: true },
    ]),
  ];

  await postSlack(blocks);
}

// 고객 수거 일정 변경 → 스레드 답글
export async function sendRescheduleNotify(
  b: Booking,
  prevDate: string,
  prevTimeSlot: string,
): Promise<void> {
  const lines = [
    `📅 수거 일정 변경 (고객 요청)`,
    `변경 전: ${prevDate} (${getDayName(prevDate)}) ${prevTimeSlot}`,
    `변경 후: ${b.date} (${getDayName(b.date)}) ${b.timeSlot}`,
  ];
  if (b.slackThreadTs) {
    await sendThreadReply(b.slackThreadTs, lines.join("\n"));
    return;
  }
  await postSlack([
    sectionBlock(lines.join("\n")),
    actionButtonBlock([
      { text: "상세 보기", url: `${BASE_URL}/admin/bookings/${b.id}`, primary: true },
    ]),
  ]);
}

// 관리자 메모 업데이트 → 스레드 답글
export async function sendAdminMemoUpdated(
  b: Booking,
  memo: string,
): Promise<void> {
  if (!b.slackThreadTs) return;
  await sendThreadReply(b.slackThreadTs, `📝 관리자 메모 업데이트\n${memo}`);
}
