type EventName =
  // ROUTE - 화면 진입
  | "[ROUTE] SpotHomeScreen"
  | "[ROUTE] SpotBookingScreen"
  | "[ROUTE] SpotBookingCompleteScreen"
  | "[ROUTE] SpotBookingManageScreen"
  // CLICK - 유저 액션
  | "[CLICK] SpotHomeScreen_cta"
  | "[CLICK] SpotHomeScreen_carousel"
  | "[CLICK] SpotHomeScreen_priceTab"
  | "[CLICK] SpotHomeScreen_bookingBtn"
  | "[CLICK] SpotHomeScreen_faqOpen"
  | "[CLICK] SpotBookingScreen_kakaoBtn"
  | "[CLICK] SpotBookingScreen_nextStep"
  | "[CLICK] SpotBookingScreen_selectItem"
  | "[CLICK] SpotBookingScreen_uploadPhoto"
  | "[CLICK] SpotBookingScreen_submit"
  | "[CLICK] SpotBookingEditScreen_submit"
  | "[CLICK] SpotBookingManageScreen_cancel"
  | "[CLICK] SpotBookingManageScreen_edit"
  | "[CLICK] SpotBookingManageScreen_reschedule"
  // VIEW - 노출
  | "[VIEW] SpotBookingScreen_quotePreview"
  | "[VIEW] SpotBookingScreen_step"
  | "[VIEW] SpotScrollDepth"
  | "[VIEW] SpotHomeScreen_compareSection"
  // EVENT - 결과
  | "[EVENT] SpotBookingComplete"
  | "[EVENT] SpotBookingCancel"
  | "[EVENT] SpotBookingSearchResult"
  // EVENT - 날짜/시간 선택
  | "[EVENT] SpotBookingDateSelected"
  | "[EVENT] SpotBookingTimeSelected";

interface EventProps {
  "[CLICK] SpotHomeScreen_cta": { location: "hero" | "price" | "floating" | "bottom" | "nav" | "funnel" };
  "[CLICK] SpotBookingScreen_kakaoBtn": { location: "funnel" };
  "[CLICK] SpotHomeScreen_bookingBtn": { location: "hero" | "price" | "floating" | "bottom" };
  "[CLICK] SpotHomeScreen_carousel": { type: "scroll" | "arrow" | "dot"; direction?: "left" | "right" };
  "[CLICK] SpotHomeScreen_priceTab": { item: string };
  "[CLICK] SpotHomeScreen_faqOpen": { question: string; index: number };
  "[CLICK] SpotBookingScreen_nextStep": { step: number; stepName: string };
  "[CLICK] SpotBookingScreen_selectItem": { category: string; name: string; price: number };
  "[CLICK] SpotBookingScreen_uploadPhoto": { count: number };
  "[CLICK] SpotBookingScreen_submit": { itemCount: number; estimatedTotal: number };
  "[CLICK] SpotBookingEditScreen_submit": { itemCount: number; estimatedTotal: number };
  "[CLICK] SpotBookingManageScreen_cancel": { bookingId: string; reason?: string };
  "[CLICK] SpotBookingManageScreen_edit": { bookingId: string };
  "[CLICK] SpotBookingManageScreen_reschedule": { bookingId: string };
  "[VIEW] SpotBookingScreen_quotePreview": { itemCount: number; total: number };
  "[VIEW] SpotBookingScreen_step": { step: number; stepName: string };
  "[VIEW] SpotScrollDepth": { depth: 25 | 50 | 75 | 100 };
  "[EVENT] SpotBookingComplete": { bookingId: string };
  "[EVENT] SpotBookingCancel": { bookingId: string; reason?: string };
  "[EVENT] SpotBookingSearchResult": { found: number };
  "[EVENT] SpotBookingDateSelected": { date: string };
  "[EVENT] SpotBookingTimeSelected": { time: string; date: string };
}

declare global {
  interface Window {
    mixpanel?: {
      track: (event: string, props?: object) => void;
      identify: (userId: string) => void;
      people?: { set: (props: object) => void };
    };
    airbridge?: {
      events: { send: (event: string, data?: object) => void };
    };
    gtag?: (...args: unknown[]) => void;
  }
}

function getExperimentVariant(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const result: Record<string, string> = {};
  const matches = document.cookie.matchAll(/ab_([^=]+)=([^;]+)/g);
  for (const match of matches) {
    result[`experiment_${match[1]}`] = match[2];
  }
  return result;
}

export function track<T extends EventName>(
  event: T,
  properties?: T extends keyof EventProps ? EventProps[T] : never
) {
  if (typeof window === "undefined") return;

  const props = {
    ...properties,
    ...getExperimentVariant(),
    timestamp: Date.now(),
    url: window.location.href,
  };

  // Mixpanel
  try {
    if (window.mixpanel) {
      window.mixpanel.track(event, props);
    }
  } catch { /* Mixpanel 초기화 경쟁 조건 등 오류 무시 */ }

  // Airbridge
  try {
    if (window.airbridge) {
      window.airbridge.events.send(event, { customAttributes: props });
    }
  } catch { /* Airbridge 오류 무시 */ }

  // GA4
  try {
    if (window.gtag) {
      window.gtag("event", event, props);
    }
  } catch { /* GA4 오류 무시 */ }

  // 서버 이벤트 로깅 (Supabase spot_events → Grafana 대시보드용)
  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, properties: props }),
    }).catch(() => {});
  } catch { /* fire-and-forget */ }
}

/** 서버 사이드 Mixpanel HTTP API 이벤트 전송 (fire-and-forget) */
export async function trackServer(
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (!token) return;
  try {
    await fetch("https://api.mixpanel.com/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{
        event,
        properties: {
          token,
          time: Math.floor(Date.now() / 1000),
          ...properties,
        },
      }]),
    });
  } catch {
    // fire-and-forget: 실패 무시
  }
}

export function identify(userId: string, props?: { phone?: string; name?: string }) {
  if (typeof window === "undefined") return;
  try {
    if (window.mixpanel) {
      window.mixpanel.identify(userId);
      if (props) {
        window.mixpanel.people?.set({
          ...(props.phone && { $phone: props.phone }),
          ...(props.name && { $name: props.name }),
        });
      }
    }
  } catch { /* Mixpanel 오류 무시 */ }
}
