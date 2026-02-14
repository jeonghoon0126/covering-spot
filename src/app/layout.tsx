import type { Metadata } from "next";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { SITE_TITLE, SITE_DESC, SITE_URL, SITE_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESC,
  keywords: [
    "대형폐기물",
    "대형폐기물 수거",
    "폐기물 수거",
    "커버링",
    "커버링스팟",
    "가구 버리기",
    "폐기물 처리",
  ],
  openGraph: {
    title: SITE_TITLE,
    description: "소량부터 대량까지, 카톡 한 번이면 끝. 사전 견적 = 최종 금액.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "ko_KR",
    type: "website",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              name: SITE_NAME,
              description: SITE_DESC,
              url: SITE_URL,
              telephone: "02-1234-5678",
              address: {
                "@type": "PostalAddress",
                addressLocality: "서울특별시",
                addressRegion: "강남구",
                streetAddress: "테헤란로 11, 1114호",
              },
              areaServed: ["서울", "경기", "인천"],
              openingHours: "Mo-Su 10:00-22:00",
              priceRange: "₩₩",
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.9",
                ratingCount: "300000",
              },
            }),
          }}
        />
      </head>
      <body className="antialiased">
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}
