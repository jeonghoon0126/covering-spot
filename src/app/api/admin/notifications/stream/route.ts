import { NextRequest } from "next/server";
import { getUnreadNotificationCount } from "@/lib/db";
import { validateToken } from "@/app/api/admin/auth/route";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/notifications/stream?token=...
 * Server-Sent Events — 미읽 알림 카운트 실시간 스트리밍
 * - 연결 즉시 현재 카운트 전송
 * - 5초마다 카운트 변경 감지 시만 전송
 * - 55초 후 연결 종료 (브라우저가 자동 재연결)
 */
export async function GET(req: NextRequest) {
  if (!validateToken(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let lastCount = -1;

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (data: object) =>
        new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

      // 즉시 전송
      const initial = await getUnreadNotificationCount().catch(() => 0);
      lastCount = initial;
      controller.enqueue(encode({ unreadCount: initial }));

      // 5초마다 변경 감지
      const interval = setInterval(async () => {
        const count = await getUnreadNotificationCount().catch(() => lastCount);
        if (count !== lastCount) {
          lastCount = count;
          controller.enqueue(encode({ unreadCount: count }));
        }
      }, 5_000);

      // 55초 후 연결 종료 (Vercel Edge timeout 대비)
      const timeout = setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 55_000);

      // 클라이언트 연결 해제 시 정리
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearTimeout(timeout);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
    },
  });
}
