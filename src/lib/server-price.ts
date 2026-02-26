import type { SpotItem } from "@/lib/db";

/**
 * 클라이언트에서 전달받은 품목 배열의 단가와 적재량을 서버 데이터 기준으로 덮어씁니다.
 * 악의적인 사용자가 items.price 또는 items.loadingCube를 변조하여 API를 호출하는 것을 방어합니다.
 * spotItems는 DB에서 로드한 활성 품목 목록을 호출측에서 전달해야 합니다.
 */
export function enforceServerItems<T extends { category: string; name: string }>(
  clientItems: T[],
  spotItems: SpotItem[],
): (T & { price: number; loadingCube: number; displayName: string })[] {
  return clientItems.map((clientItem) => {
    const serverItem = spotItems.find(
      (i) => i.category === clientItem.category && i.name === clientItem.name,
    );

    if (serverItem) {
      return {
        ...clientItem,
        price: serverItem.price,
        loadingCube: serverItem.loadingCube,
        displayName: serverItem.displayName,
      };
    }

    // 서버 단가표에 존재하지 않는 임의 품목 (변조 의심)
    console.warn(
      `[enforceServerItems] 서버 단가표에 없는 품목 감지: ${clientItem.category} - ${clientItem.name}`,
    );
    return {
      ...clientItem,
      price: 0,
      loadingCube: 0,
      displayName: clientItem.name,
    };
  });
}
