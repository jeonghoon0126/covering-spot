export interface SpotArea {
  name: string;
  price1: number; // 1명 단가
  price2: number; // 2명 단가
  price3: number; // 3명 단가
}

/**
 * Daum Postcode API의 sigungu/sido로 서비스 지역 자동 매칭
 * - 서울: sigungu 직접 매칭 (예: "강남구")
 * - 경기: sigungu에서 시 이름 추출 (예: "고양시 덕양구" → "고양")
 * - 인천: sido로 매칭
 * @returns SpotArea 또는 null (서비스 불가 지역)
 */
export function detectAreaFromAddress(
  sigungu: string,
  sido: string,
): SpotArea | null {
  // 1. 서울 25개 구: sigungu 직접 매칭
  const directMatch = SPOT_AREAS.find((a) => a.name === sigungu);
  if (directMatch) return directMatch;

  // 2. 경기도 시 매칭: "김포시" → "김포", "고양시 덕양구" → "고양"
  if (sido.startsWith("경기")) {
    const cityName = sigungu.split("시")[0]; // "고양시 덕양구" → "고양"
    const cityMatch = SPOT_AREAS.find((a) => a.name === cityName);
    if (cityMatch) return cityMatch;
  }

  // 3. 인천광역시 → "인천"
  if (sido.startsWith("인천")) {
    return SPOT_AREAS.find((a) => a.name === "인천") || null;
  }

  return null;
}

export const SPOT_AREAS: SpotArea[] = [
  { name: "광진구", price1: 47000, price2: 71000, price3: 107000 },
  { name: "강동구", price1: 49000, price2: 74000, price3: 111000 },
  { name: "송파구", price1: 49000, price2: 74000, price3: 111000 },
  { name: "강남구", price1: 50000, price2: 75000, price3: 113000 },
  { name: "성동구", price1: 50000, price2: 75000, price3: 113000 },
  { name: "동대문구", price1: 49000, price2: 74000, price3: 111000 },
  { name: "중랑구", price1: 48000, price2: 72000, price3: 108000 },
  { name: "서초구", price1: 52000, price2: 78000, price3: 117000 },
  { name: "동작구", price1: 56000, price2: 84000, price3: 126000 },
  { name: "관악구", price1: 57000, price2: 86000, price3: 129000 },
  { name: "용산구", price1: 52000, price2: 78000, price3: 117000 },
  { name: "중구", price1: 51000, price2: 77000, price3: 116000 },
  { name: "종로구", price1: 52000, price2: 78000, price3: 117000 },
  { name: "성북구", price1: 50000, price2: 75000, price3: 113000 },
  { name: "강북구", price1: 52000, price2: 78000, price3: 117000 },
  { name: "도봉구", price1: 52000, price2: 78000, price3: 117000 },
  { name: "노원구", price1: 51000, price2: 77000, price3: 116000 },
  { name: "금천구", price1: 60000, price2: 90000, price3: 135000 },
  { name: "구로구", price1: 59000, price2: 89000, price3: 134000 },
  { name: "양천구", price1: 60000, price2: 90000, price3: 135000 },
  { name: "영등포구", price1: 59000, price2: 89000, price3: 134000 },
  { name: "강서구", price1: 61000, price2: 92000, price3: 138000 },
  { name: "마포구", price1: 59000, price2: 89000, price3: 134000 },
  { name: "서대문구", price1: 56000, price2: 84000, price3: 126000 },
  { name: "은평구", price1: 56000, price2: 84000, price3: 126000 },
  { name: "김포", price1: 69000, price2: 104000, price3: 156000 },
  { name: "파주", price1: 71000, price2: 107000, price3: 161000 },
  { name: "동두천", price1: 67000, price2: 101000, price3: 152000 },
  { name: "포천", price1: 67000, price2: 101000, price3: 152000 },
  { name: "양주", price1: 60000, price2: 90000, price3: 135000 },
  { name: "의정부", price1: 57000, price2: 86000, price3: 129000 },
  { name: "고양", price1: 62000, price2: 93000, price3: 140000 },
  { name: "남양주", price1: 50000, price2: 75000, price3: 113000 },
  { name: "구리", price1: 46000, price2: 69000, price3: 104000 },
  { name: "하남", price1: 51000, price2: 77000, price3: 116000 },
  { name: "가평", price1: 72000, price2: 108000, price3: 162000 },
  { name: "양평", price1: 65000, price2: 98000, price3: 147000 },
  { name: "여주", price1: 79000, price2: 119000, price3: 179000 },
  { name: "이천", price1: 72000, price2: 108000, price3: 162000 },
  { name: "안성", price1: 85000, price2: 128000, price3: 192000 },
  { name: "평택", price1: 83000, price2: 125000, price3: 188000 },
  { name: "화성", price1: 76000, price2: 114000, price3: 171000 },
  { name: "오산", price1: 72000, price2: 108000, price3: 162000 },
  { name: "용인", price1: 68000, price2: 102000, price3: 153000 },
  { name: "성남", price1: 56000, price2: 84000, price3: 126000 },
  { name: "수원", price1: 67000, price2: 101000, price3: 152000 },
  { name: "광주", price1: 56000, price2: 84000, price3: 126000 },
  { name: "안산", price1: 71000, price2: 107000, price3: 161000 },
  { name: "군포", price1: 65000, price2: 98000, price3: 147000 },
  { name: "의왕", price1: 64000, price2: 96000, price3: 144000 },
  { name: "과천", price1: 58000, price2: 87000, price3: 131000 },
  { name: "안양", price1: 61000, price2: 92000, price3: 138000 },
  { name: "부천", price1: 65000, price2: 98000, price3: 147000 },
  { name: "광명", price1: 61000, price2: 92000, price3: 138000 },
  { name: "인천", price1: 72000, price2: 108000, price3: 162000 },
  { name: "시흥", price1: 65000, price2: 98000, price3: 147000 },
];
