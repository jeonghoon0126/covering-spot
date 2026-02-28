/**
 * FlareLane SMS 발송 모듈
 *
 * 환경변수:
 *   FLARELANE_API_KEY     — FlareLane 프로젝트 API Key (Bearer 인증)
 *   FLARELANE_PROJECT_ID  — FlareLane 프로젝트 ID
 *
 * API 스펙:
 *   POST https://api.flarelane.com/v1/projects/{PROJECT_ID}/sms
 *   Auth: Authorization: Bearer {API_KEY}
 *   Body: { targetType, targetIds (E.164), isAdvertisement, body }
 *
 * @see https://flarelane-api-docs.readme.io/reference/send-notifications
 */

const STATUS_LINK = "\n조회: https://coveringspot.vercel.app/booking/manage";

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

/**
 * Booking.status → SMS 템플릿 키 매핑
 * - "pending"은 DB status, "received"는 SMS 템플릿 키 (접수 안내 문구)
 */
const STATUS_ALIAS: Record<string, string> = {
  pending: "received",
};

const STATUS_TEMPLATES: Record<string, (finalPrice?: number | null, paymentUrl?: string | null) => string> = {
  received: () =>
    `[커버링 방문수거] 수거 신청이 접수되었어요!\n\n담당자가 견적을 검토 중이에요. 빠르게 연락드릴게요.\n신청 내역은 아래 링크에서 확인하세요.`,
  quote_confirmed: (finalPrice) =>
    `[커버링 방문수거] 안녕하세요! 견적이 확정되었어요.\n\n최종 견적: ${finalPrice != null ? formatPrice(finalPrice) : "미정"}\n\n견적이 맞지 않으시면 수거 전날까지 변경·취소가 가능해요.\n아래 링크에서 상세 내용을 확인해 주세요.`,
  in_progress: () =>
    "[커버링 방문수거] 수거 팀이 출발했어요!\n\n도착 예정 시간에 맞춰 문 앞에 품목을 준비해 주시면 더 빠르게 진행돼요.\n감사합니다!",
  completed: () =>
    "[커버링 방문수거] 수거가 완료되었어요!\n\n이용해 주셔서 감사합니다.\n다음에도 필요하시면 편하게 신청해 주세요.",
  payment_requested: (_finalPrice, paymentUrl) =>
    "[커버링 방문수거] 정산 안내드려요." +
    (paymentUrl ? `\n\n아래 링크에서 결제를 진행해 주세요.\n결제 링크: ${paymentUrl}` : "") +
    "\n\n결제 완료 후 정산이 확정돼요.\n문의사항은 카카오톡 채널로 연락 주세요!",
  // "dispatched"는 DB status가 아닌 배차 이벤트 전용 키 (dispatch-auto/route.ts, dispatch/route.ts에서 호출)
  dispatched: () =>
    "[커버링 방문수거] 안녕하세요! 수거 담당 기사가 배정되었어요.\n\n수거 당일 기사 출발 시 다시 안내드릴게요. 감사합니다!",
  cancelled: () =>
    "[커버링 방문수거] 수거 신청이 취소되었어요.\n\n새로운 수거가 필요하시면 언제든 편하게 신청해 주세요!\n감사합니다.",
  rejected: () =>
    "[커버링 방문수거] 죄송합니다. 해당 건은 수거가 어려운 상황이에요.\n\n자세한 사유가 궁금하시면 카카오톡 채널로 문의해 주세요.\n불편을 드려 죄송합니다.",
};

/**
 * 한국 전화번호를 E.164 형식으로 변환
 * "010-1234-5678" → "+821012345678"
 */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return "+82" + digits.slice(1);
  }
  if (digits.startsWith("82")) {
    return "+" + digits;
  }
  return "+" + digits;
}

/**
 * FlareLane SMS 발송 (fire-and-forget)
 *
 * - FLARELANE_API_KEY, FLARELANE_PROJECT_ID 환경변수 미설정 시 조용히 스킵
 * - STATUS_TEMPLATES에 없는 status는 무시
 * - 에러 발생 시 콘솔 로그만 남기고 throw 하지 않음
 */
export async function sendStatusSms(
  phone: string,
  status: string,
  bookingId: string,
  finalPrice?: number | null,
  paymentUrl?: string | null,
): Promise<void> {
  try {
    const apiKey = process.env.FLARELANE_API_KEY;
    const projectId = process.env.FLARELANE_PROJECT_ID;

    if (!apiKey || !projectId) {
      console.log("[sms-notify] FlareLane 환경변수 미설정 - SMS 발송 스킵");
      return;
    }

    const resolvedStatus = STATUS_ALIAS[status] ?? status;
    const templateFn = STATUS_TEMPLATES[resolvedStatus];
    if (!templateFn) return;

    const text = templateFn(finalPrice, paymentUrl) + STATUS_LINK;

    const res = await fetch(
      `https://api.flarelane.com/v1/projects/${projectId}/sms`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetType: "phoneNumber",
          targetIds: [toE164(phone)],
          isAdvertisement: false,
          body: text,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`[sms-notify] FlareLane 발송 실패 (booking=${bookingId}):`, res.status, body);
    }
  } catch (err) {
    console.error("[sms-notify] FlareLane 발송 에러:", err);
  }
}

/**
 * FlareLane 카카오 알림톡 발송
 *
 * 알림톡은 사전에 FlareLane 콘솔에서 템플릿 등록 필요.
 * 템플릿 ID를 받아서 발송.
 *
 * @see https://flarelane-api-docs.readme.io/reference/send-kakao-alimtalk
 */
export async function sendAlimtalk(
  phone: string,
  templateId: string,
  interpolations?: Record<string, string>,
): Promise<void> {
  try {
    const apiKey = process.env.FLARELANE_API_KEY;
    const projectId = process.env.FLARELANE_PROJECT_ID;

    if (!apiKey || !projectId) {
      console.log("[alimtalk] FlareLane 환경변수 미설정 - 알림톡 발송 스킵");
      return;
    }

    const res = await fetch(
      `https://api.flarelane.com/v1/projects/${projectId}/alimtalk`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetType: "phoneNumber",
          targetIds: [toE164(phone)],
          templateId,
          ...(interpolations ? { interpolations } : {}),
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`[alimtalk] FlareLane 발송 실패:`, res.status, body);
    }
  } catch (err) {
    console.error("[alimtalk] FlareLane 발송 에러:", err);
  }
}
