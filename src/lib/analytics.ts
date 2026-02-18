type EventName =
  | "page_view"
  | "cta_click"
  | "carousel_interact"
  | "price_tab_select"
  | "faq_open"
  | "compare_section_viewed"
  | "scroll_depth";

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
  const match = document.cookie.match(/ab_([^=]+)=([^;]+)/);
  if (!match) return {};
  return { experiment: match[1], variant: match[2] };
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
