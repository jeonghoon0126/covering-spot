/** 전화번호 포맷팅 (010-1234-5678) */
export function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/[^\d]/g, "").slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
}

/** 가격을 천 단위 콤마 포맷 (예: 225000 → "225,000") */
export function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** 만원 단위 포맷 (예: 220000 → "22만") */
export function formatManWon(n: number): string {
  const man = Math.round(n / 10000);
  return `${man}만`;
}
