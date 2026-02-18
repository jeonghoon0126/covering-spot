import { NextRequest, NextResponse } from "next/server";
import { getActiveExperiment, assignVariant } from "@/config/experiments";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const experiment = getActiveExperiment();
  if (!experiment) return response;

  const cookieName = `ab_${experiment.name}`;
  const existing = request.cookies.get(cookieName)?.value;

  // 이미 할당된 variant가 유효하면 유지
  if (existing && experiment.variants.includes(existing)) {
    return response;
  }

  // 새로 할당
  const variant = assignVariant(experiment);
  response.cookies.set(cookieName, variant, {
    maxAge: 60 * 60 * 24 * 30, // 30일
    path: "/",
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|images|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|otf)$).*)",
  ],
};
