type EventName =
  | "page_view"
  | "cta_click"
  | "carousel_interact"
  | "price_tab_select"
  | "faq_open"
  | "compare_section_viewed"
  | "scroll_depth"
  | "booking_start"
  | "booking_step_complete"
  | "booking_item_select"
  | "booking_photo_upload"
  | "booking_submit"
  | "booking_complete"
  | "booking_manage_view"
  | "booking_cancel"
  | "quote_preview";

interface EventProps {
  cta_click: { location: "hero" | "price" | "floating" | "bottom" | "nav" };
  carousel_interact: {
    type: "scroll" | "arrow" | "dot";
    direction?: "left" | "right";
  };
  price_tab_select: { item: string };
  faq_open: { question: string; index: number };
  scroll_depth: { depth: 25 | 50 | 75 | 100 };
  compare_section_viewed: Record<string, never>;
  page_view: { variant?: string };
  booking_start: Record<string, never>;
  booking_step_complete: { step: number; stepName: string };
  booking_item_select: { category: string; name: string; price: number };
  booking_photo_upload: { count: number };
  booking_submit: { itemCount: number; estimatedTotal: number };
  booking_complete: { bookingId: string };
  booking_manage_view: Record<string, never>;
  booking_cancel: { bookingId: string; reason?: string };
  quote_preview: { itemCount: number; total: number };
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
    window.mixpanel.track(`[Spot] ${event}`, props);
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
