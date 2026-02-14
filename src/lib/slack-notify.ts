import type { Booking } from "@/types/booking";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

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
    ...(b.memo
      ? [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*요청사항*\n${b.memo}` },
          },
        ]
      : []),
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<https://docs.google.com/spreadsheets/d/${process.env.BOOKING_SPREADSHEET_ID}|📊 예약 시트 바로가기>`,
        },
      ],
    },
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
  ];

  await postSlack(blocks);
}
