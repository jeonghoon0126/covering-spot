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
 *
 * ⚠️ 보안 정책: 자동 등록 금지
 * 관리자 계정은 반드시 Supabase 대시보드에서 admin_users 테이블에 직접 삽입해야 합니다.
 * - 퇴사자/임시직 등 @covering.app 메일 보유자의 무단 접근 방지
 * - INSERT: INSERT INTO admin_users (email, name, role) VALUES ('email@covering.app', '이름', 'admin');
 */
export async function getOrCreateAdmin(
  email: string,
  _name: string,
): Promise<{ id: string; email: string; name: string; role: string } | null> {
  const { data: existing } = await supabase
    .from("admin_users")
    .select("id, email, name, role")
    .eq("email", email)
    .single();

  if (!existing) {
    console.warn(`[google-auth] 미등록 계정 접근 시도: ${email}`);
    return null;
  }

  return existing;
}
