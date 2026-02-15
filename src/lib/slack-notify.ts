import type { Booking } from "@/types/booking";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://covering-spot.vercel.app";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${process.env.BOOKING_SPREADSHEET_ID}`;

function actionsBlock(buttons: { text: string; url: string; primary?: boolean }[]) {
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

const STATUS_LABELS: Record<string, string> = {
  pending: "접수 대기",
  confirmed: "확인됨",
  quote_confirmed: "견적 확정",
  in_progress: "수거 진행중",
  completed: "수거 완료",
  payment_requested: "결제 요청",
  payment_completed: "결제 완료",
  cancelled: "취소",
  rejected: "거절",
};

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00+09:00");
  return DAYS[d.getDay()];
}

async function postSlack(blocks: unknown[]): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!token || !channel) return;

  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, blocks }),
    });
  } catch {
    // Slack 실패가 예약을 막으면 안 됨
  }
}

export async function sendBookingCreated(b: Booking): Promise<void> {
  const itemLines = b.items
    .map(
      (i) =>
        `• ${i.displayName || i.category + " " + i.name} x${i.quantity} - ${formatPrice(i.price * i.quantity)}`,
    )
    .join("\n");

  const envInfo: string[] = [];
  envInfo.push(`엘리베이터: ${b.hasElevator ? "있음" : "없음"}`);
  envInfo.push(`주차: ${b.hasParking ? "가능" : "불가"}`);
  const envText = envInfo.join(" | ");

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "📋 새 수거 예약 접수" },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*날짜*\n${b.date} (${getDayName(b.date)}) ${b.timeSlot}`,
        },
        { type: "mrkdwn", text: `*지역*\n${b.area}` },
        {
          type: "mrkdwn",
          text: `*고객*\n${b.customerName} (${b.phone})`,
        },
        {
          type: "mrkdwn",
          text: `*주소*\n${b.address} ${b.addressDetail}`,
        },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*작업환경*\n${envText}` },
    },
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*품목*\n${itemLines}` },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*품목 합계*\n${formatPrice(b.totalPrice - (b.items.reduce((s, i) => s + i.price * i.quantity, 0) === b.totalPrice ? 0 : b.ladderPrice + (b.totalPrice - b.items.reduce((s, i) => s + i.price * i.quantity, 0) - b.ladderPrice)))}`,
        },
        {
          type: "mrkdwn",
          text: `*인력비 (${b.crewSize}명)*\n${formatPrice(b.totalPrice - b.items.reduce((s, i) => s + i.price * i.quantity, 0) - b.ladderPrice)}`,
        },
        {
          type: "mrkdwn",
          text: `*사다리차*\n${b.needLadder ? formatPrice(b.ladderPrice) : "없음"}`,
        },
        {
          type: "mrkdwn",
          text: `*총 견적*\n*${formatPrice(b.totalPrice)}*`,
        },
      ],
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*예상 견적 범위*\n${formatPrice(b.estimateMin)} ~ ${formatPrice(b.estimateMax)}`,
        },
        {
          type: "mrkdwn",
          text: `*사진*\n${b.photos.length > 0 ? `${b.photos.length}장 첨부` : "없음"}`,
        },
      ],
    },
    ...(b.memo
      ? [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*요청사항*\n${b.memo}` },
          },
        ]
      : []),
    actionsBlock([
      { text: "관리자 페이지", url: `${BASE_URL}/admin`, primary: true },
      { text: "견적 확인", url: SHEET_URL },
    ]),
  ];

  await postSlack(blocks);
}

export async function sendBookingUpdated(b: Booking): Promise<void> {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "✏️ 수거 예약 수정" },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*날짜*\n${b.date} (${getDayName(b.date)}) ${b.timeSlot}`,
        },
        { type: "mrkdwn", text: `*지역*\n${b.area}` },
        {
          type: "mrkdwn",
          text: `*고객*\n${b.customerName} (${b.phone})`,
        },
        {
          type: "mrkdwn",
          text: `*총 견적*\n*${formatPrice(b.totalPrice)}*`,
        },
      ],
    },
    actionsBlock([
      { text: "관리자 페이지", url: `${BASE_URL}/admin`, primary: true },
      { text: "시트 보기", url: SHEET_URL },
    ]),
  ];

  await postSlack(blocks);
}

export async function sendBookingDeleted(b: Booking): Promise<void> {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "❌ 수거 예약 취소" },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*날짜*\n${b.date} (${getDayName(b.date)}) ${b.timeSlot}`,
        },
        {
          type: "mrkdwn",
          text: `*고객*\n${b.customerName} (${b.phone})`,
        },
        {
          type: "mrkdwn",
          text: `*총 견적*\n${formatPrice(b.totalPrice)}`,
        },
      ],
    },
    actionsBlock([
      { text: "관리자 페이지", url: `${BASE_URL}/admin`, primary: true },
    ]),
  ];

  await postSlack(blocks);
}

export async function sendQuoteConfirmed(b: Booking): Promise<void> {
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "💰 견적 확정" },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*날짜*\n${b.date} (${getDayName(b.date)}) ${b.timeSlot}`,
        },
        { type: "mrkdwn", text: `*지역*\n${b.area}` },
        {
          type: "mrkdwn",
          text: `*고객*\n${b.customerName} (${b.phone})`,
        },
        {
          type: "mrkdwn",
          text: `*주소*\n${b.address} ${b.addressDetail}`,
        },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*예상 견적 범위*\n${formatPrice(b.estimateMin)} ~ ${formatPrice(b.estimateMax)}`,
        },
        {
          type: "mrkdwn",
          text: `*최종 확정 금액*\n*${b.finalPrice != null ? formatPrice(b.finalPrice) : "미정"}*`,
        },
      ],
    },
    ...(b.adminMemo
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*관리자 메모*\n${b.adminMemo}`,
            },
          },
        ]
      : []),
    actionsBlock([
      { text: "관리자 페이지", url: `${BASE_URL}/admin`, primary: true },
      { text: "시트 보기", url: SHEET_URL },
    ]),
  ];

  await postSlack(blocks);
}

export async function sendStatusChanged(
  b: Booking,
  newStatus: string,
): Promise<void> {
  const statusLabel = STATUS_LABELS[newStatus] || newStatus;

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🔄 예약 상태 변경: ${statusLabel}`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*날짜*\n${b.date} (${getDayName(b.date)}) ${b.timeSlot}`,
        },
        { type: "mrkdwn", text: `*지역*\n${b.area}` },
        {
          type: "mrkdwn",
          text: `*고객*\n${b.customerName} (${b.phone})`,
        },
        {
          type: "mrkdwn",
          text: `*상태*\n*${statusLabel}*`,
        },
      ],
    },
    ...(b.finalPrice != null
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*최종 금액*\n${formatPrice(b.finalPrice)}`,
            },
          },
        ]
      : []),
    ...(b.adminMemo
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*관리자 메모*\n${b.adminMemo}`,
            },
          },
        ]
      : []),
    actionsBlock([
      { text: "관리자 페이지", url: `${BASE_URL}/admin`, primary: true },
      { text: "시트 보기", url: SHEET_URL },
    ]),
  ];

  await postSlack(blocks);
}
