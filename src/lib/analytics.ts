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
  | "[CLICK] SpotHomeScreen_faqOpen"
  | "[CLICK] SpotBookingScreen_nextStep"
  | "[CLICK] SpotBookingScreen_selectItem"
  | "[CLICK] SpotBookingScreen_uploadPhoto"
  | "[CLICK] SpotBookingScreen_submit"
  | "[CLICK] SpotBookingEditScreen_submit"
  | "[CLICK] SpotBookingManageScreen_cancel"
  // VIEW - 노출
  | "[VIEW] SpotBookingScreen_quotePreview"
  | "[VIEW] SpotScrollDepth"
  | "[VIEW] SpotHomeScreen_compareSection"
  // EVENT - 결과
  | "[EVENT] SpotBookingComplete"
  | "[EVENT] SpotBookingCancel";

interface EventProps {
  "[CLICK] SpotHomeScreen_cta": { location: "hero" | "price" | "floating" | "bottom" | "nav" };
  "[CLICK] SpotHomeScreen_carousel": { type: "scroll" | "arrow" | "dot"; direction?: "left" | "right" };
  "[CLICK] SpotHomeScreen_priceTab": { item: string };
  "[CLICK] SpotHomeScreen_faqOpen": { question: string; index: number };
  "[CLICK] SpotBookingScreen_nextStep": { step: number; stepName: string };
  "[CLICK] SpotBookingScreen_selectItem": { category: string; name: string; price: number };
  "[CLICK] SpotBookingScreen_uploadPhoto": { count: number };
  "[CLICK] SpotBookingScreen_submit": { itemCount: number; estimatedTotal: number };
  "[CLICK] SpotBookingEditScreen_submit": { itemCount: number; estimatedTotal: number };
  "[CLICK] SpotBookingManageScreen_cancel": { bookingId: string; reason?: string };
  "[VIEW] SpotBookingScreen_quotePreview": { itemCount: number; total: number };
  "[VIEW] SpotScrollDepth": { depth: 25 | 50 | 75 | 100 };
  "[EVENT] SpotBookingComplete": { bookingId: string };
  "[EVENT] SpotBookingCancel": { bookingId: string; reason?: string };
}

declare global {
  interface Window {
    mixpanel?: { track: (event: string, props?: object) => void };
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
  if (window.mixpanel) {
    window.mixpanel.track(event, props);
  }

  // Airbridge
  if (window.airbridge) {
    window.airbridge.events.send(event, { customAttributes: props });
  }

  // GA4
  if (window.gtag) {
    window.gtag("event", event, props);
  }
}
