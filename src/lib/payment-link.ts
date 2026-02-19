/**
 * 결제 링크 생성 (Placeholder)
 * TODO: 실제 결제 API 연동 시 구현
 */
export async function createPaymentLink(
  bookingId: string,
  amount: number,
  customerName: string,
): Promise<string | null> {
  // 결제 API 정보 미정 — placeholder
  console.log(`[payment-link] placeholder: bookingId=${bookingId}, amount=${amount}, customer=${customerName}`);
  return null;
}
