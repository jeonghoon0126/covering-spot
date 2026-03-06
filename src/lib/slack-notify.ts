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

const BASE_URL = "https://coveringspot.vercel.app";

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
  channelOverride?: string,
): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = channelOverride ?? process.env.SLACK_CHANNEL_ID;
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

/** 예약 제출 서버 에러 알림 */
export async function sendBookingSubmitError(
  error: unknown,
  partialBody: Record<string, unknown>,
): Promise<void> {
  const errMsg = error instanceof Error ? error.message : String(error);
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const customer = partialBody?.customerName && partialBody?.phone
    ? `${partialBody.customerName} / ${partialBody.phone}`
    : "파싱 불가";

  await postSlack([
    headerBlock("🚨 예약 제출 실패"),
    fieldsBlock([
      { label: "고객", value: customer },
      { label: "시각", value: now },
    ]),
    sectionBlock(`*에러*\n\`\`\`${errMsg}\`\`\``),
    actionButtonBlock([
      { text: "백오피스", url: `${BASE_URL}/admin/bookings`, primary: true },
    ]),
  ]);
}

/** 사진 업로드 에러 알림 */
export async function sendUploadError(
  error: unknown,
  fileInfo: { count: number; sizes: number[] },
): Promise<void> {
  const errMsg = error instanceof Error ? error.message : String(error);
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const maxSize = fileInfo.sizes.length > 0
    ? `${(Math.max(...fileInfo.sizes) / 1024 / 1024).toFixed(1)}MB`
    : "-";

  await postSlack([
    headerBlock("⚠️ 사진 업로드 실패"),
    fieldsBlock([
      { label: "파일 수", value: `${fileInfo.count}개` },
      { label: "최대 크기", value: maxSize },
      { label: "시각", value: now },
    ]),
    sectionBlock(`*에러*\n\`\`\`${errMsg}\`\`\``),
  ]);
}

/** 일일 이벤트 리포트 (방문수거 알림 채널) */
export async function sendDailyEventsReport(
  dateLabel: string,  // e.g. "03/06 (목)"
  events: { event_name: string; cnt: number }[],
  steps: { step: string; cnt: number }[],
): Promise<void> {
  const pickupChannel = process.env.SLACK_PICKUP_CHANNEL_ID ?? "C0AENH7JW2Y";

  const get = (name: string) => events.find((e) => e.event_name === name)?.cnt ?? 0;

  const home = get("[ROUTE] SpotHomeScreen");
  const kakao = get("[CLICK] SpotHomeScreen_cta");
  const bookingBtn = get("[CLICK] SpotHomeScreen_bookingBtn");
  const bookingScreen = get("[ROUTE] SpotBookingScreen");
  const complete = get("[EVENT] SpotBookingComplete");

  const pct = (n: number) => home > 0 ? ` (${(n / home * 100).toFixed(1)}%)` : "";

  const funnelLines = [
    `홈 방문          *${home.toLocaleString()}건*`,
    `├ 카카오 클릭     ${kakao.toLocaleString()}건${pct(kakao)}`,
    `├ 수거신청 클릭   ${bookingBtn.toLocaleString()}건${pct(bookingBtn)}`,
    `├ 예약화면 진입   ${bookingScreen.toLocaleString()}건${pct(bookingScreen)}`,
    `└ 예약 완료       *${complete.toLocaleString()}건*${pct(complete)}`,
  ].join("\n");

  const stepMap = Object.fromEntries(steps.map((s) => [s.step, s.cnt]));
  const stepNames: Record<string, string> = { "0": "고객정보", "1": "품목/사진", "2": "날짜/시간", "3": "작업환경", "4": "사다리차", "5": "견적확인" };
  const stepLines = [0, 1, 2, 3, 4, 5].map((i) => {
    const cnt = stepMap[String(i)] ?? 0;
    const prev = i > 0 ? (stepMap[String(i - 1)] ?? 0) : null;
    const drop = prev && prev > 0 ? ` (-${(100 - cnt / prev * 100).toFixed(0)}%)` : "";
    return `Step${i} ${stepNames[String(i)]}   ${cnt}건${drop}`;
  }).join("\n");

  await postSlack([
    headerBlock(`📊 방문수거 일일 리포트 | ${dateLabel}`),
    sectionBlock(`*퍼널*\n${funnelLines}`),
    dividerBlock(),
    sectionBlock(`*예약 스텝 이탈*\n${stepLines}`),
  ], undefined, pickupChannel);
}

// 관리자 메모 업데이트 → 스레드 답글
export async function sendAdminMemoUpdated(
  b: Booking,
  memo: string,
): Promise<void> {
  if (!b.slackThreadTs) return;
  await sendThreadReply(b.slackThreadTs, `📝 관리자 메모 업데이트\n${memo}`);
}
