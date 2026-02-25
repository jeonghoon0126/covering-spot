import { SPOT_CATEGORIES } from "@/data/spot-items";

/**
 * 클라이언트에서 전달받은 품목 배열의 단가와 적재량을 서버 데이터 기준으로 덮어씁니다.
 * 악의적인 사용자가 items.price 또는 items.loadingCube를 변조하여 API를 호출하는 것을 방어합니다.
 */
export function enforceServerItems<T extends { category: string; name: string }>(
  clientItems: T[],
): (T & { price: number; loadingCube: number; displayName: string })[] {
  return clientItems.map((clientItem) => {
    const category = SPOT_CATEGORIES.find((c) => c.name === clientItem.category);
    const serverItem = category?.items.find((i) => i.name === clientItem.name);

    if (serverItem) {
      return {
        ...clientItem,
        price: serverItem.price,
        loadingCube: serverItem.loadingCube,
        displayName: serverItem.displayName, // 서버 디스플레이 네임으로 강제 통일
      };
    }

    // 서버 단가표에 존재하지 않는 임의 품목 (변조 의심)
    console.warn(
      `[enforceServerItems] 서버 단가표에 없는 품목 감지: ${clientItem.category} - ${clientItem.name}`,
    );
    return {
      ...clientItem,
      price: 0, // 승인되지 않은 품목의 가격은 0으로 강제 처리하여 결제/견적 조작 방지
      loadingCube: 0,
      displayName: clientItem.name, // 타입 에러 방지를 위해 name을 fallback으로 사용
    };
  });
}
