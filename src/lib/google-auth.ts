import { supabase } from "./supabase";

/**
 * Google ID 토큰 검증
 * Google tokeninfo 엔드포인트로 서버사이드 검증 (라이브러리 불필요)
 * @covering.app 도메인만 허용
 */
export async function verifyGoogleToken(
  idToken: string,
): Promise<{ email: string; name: string } | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) return null;

    const payload = await res.json();

    if (!payload.email_verified || payload.email_verified === "false") return null;
    if (!payload.email?.endsWith("@covering.app")) return null;

    return { email: payload.email, name: payload.name || payload.email.split("@")[0] };
  } catch {
    return null;
  }
}

/**
 * admin_users 테이블에서 이메일로 관리자 조회
 * 미등록 @covering.app 사용자는 자동 등록 (role: admin)
 */
export async function getOrCreateAdmin(
  email: string,
  name: string,
): Promise<{ id: string; email: string; name: string; role: string } | null> {
  // 기존 관리자 조회
  const { data: existing } = await supabase
    .from("admin_users")
    .select("id, email, name, role")
    .eq("email", email)
    .single();

  if (existing) return existing;

  // @covering.app 자동 등록
  const { data: created, error } = await supabase
    .from("admin_users")
    .insert({ email, name, role: "admin" })
    .select("id, email, name, role")
    .single();

  if (error || !created) return null;
  return created;
}
