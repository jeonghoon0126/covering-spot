import crypto from "crypto";

const SOLAPI_URL = "https://api.solapi.com/messages/v4/send-many/detail";

const STATUS_LINK = "\n조회: https://coveringspot.vercel.app/booking/manage";

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

const STATUS_TEMPLATES: Record<string, (finalPrice?: number | null) => string> = {
  quote_confirmed: (finalPrice) =>
    `[커버링 스팟] 견적이 확정되었습니다. 최종 견적: ${finalPrice != null ? formatPrice(finalPrice) : "미정"}`,
  in_progress: () => "[커버링 스팟] 수거 팀이 출발했습니다.",
  completed: () => "[커버링 스팟] 수거가 완료되었습니다.",
  payment_requested: () => "[커버링 스팟] 정산 요청이 발송되었습니다.",
  cancelled: () => "[커버링 스팟] 신청이 취소되었습니다.",
  rejected: () => "[커버링 스팟] 수거가 불가한 건입니다.",
};

/**
 * Solapi v4 HMAC-SHA256 인증 헤더 생성
 * @see https://docs.solapi.com/authentication
 */
function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

/**
 * SMS 상태 알림 발송 (fire-and-forget)
 *
 * - SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER 환경변수 미설정 시 조용히 스킵
 * - STATUS_TEMPLATES에 없는 status는 무시
 * - 에러 발생 시 콘솔 로그만 남기고 throw 하지 않음
 */
export async function sendStatusSms(
  phone: string,
  status: string,
  bookingId: string,
  finalPrice?: number | null,
): Promise<void> {
  try {
    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const sender = process.env.SOLAPI_SENDER;

    if (!apiKey || !apiSecret || !sender) {
      console.log("[sms-notify] 환경변수 미설정 - SMS 발송 스킵");
      return;
    }

    const templateFn = STATUS_TEMPLATES[status];
    if (!templateFn) return;

    const text = templateFn(finalPrice) + STATUS_LINK;

    const res = await fetch(SOLAPI_URL, {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(apiKey, apiSecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            to: phone,
            from: sender,
            text,
            type: "SMS",
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[sms-notify] 발송 실패 (booking=${bookingId}):`, res.status, body);
    }
  } catch (err) {
    console.error("[sms-notify] 발송 에러:", err);
  }
}
