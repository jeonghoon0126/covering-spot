import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  typescript: {
    // 로컬 빌드는 타입체크 스킵 → 번들 확인만 빠르게
    // 타입 오류는 VS Code IntelliSense + npm run typecheck 로 확인
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

// SENTRY_AUTH_TOKEN 없으면 소스맵 업로드 스킵 (Vercel 빌드 실패 방지)
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: "covering",
      project: "covering-spot",
      silent: true,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;
