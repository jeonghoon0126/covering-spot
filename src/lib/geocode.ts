// 인메모리 캐시 — 서버 프로세스 수명 동안 유효 (주소는 변하지 않으므로 TTL 불필요)
// key: 정규화된 주소, value: 좌표 또는 null(실패 결과는 캐시 안 함)
const geocodeCache = new Map<string, { lat: number; lng: number }>();

/**
 * Geocode a Korean address using Kakao REST API
 * @param address - The address string to geocode
 * @returns Coordinates {lat, lng} or null on failure
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY;

  if (!apiKey) {
    console.error('[geocode] KAKAO_REST_API_KEY is not set');
    return null;
  }

  if (!address || address.trim().length === 0) {
    console.error('[geocode] Address is empty');
    return null;
  }

  // 캐시 히트 확인
  const cacheKey = address.trim();
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const headers = { Authorization: `KakaoAK ${apiKey}` };
    const query = address.trim();

    // 1차: 주소 검색 (도로명/지번 정확 매칭)
    const addressUrl = new URL('https://dapi.kakao.com/v2/local/search/address.json');
    addressUrl.searchParams.set('query', query);

    const addressRes = await fetch(addressUrl.toString(), {
      headers,
      signal: controller.signal,
    });

    if (addressRes.ok) {
      const addressData = await addressRes.json();
      if (addressData.documents && addressData.documents.length > 0) {
        const doc = addressData.documents[0];
        const lat = parseFloat(doc.y);
        const lng = parseFloat(doc.x);
        clearTimeout(timeoutId);
        if (!isNaN(lat) && !isNaN(lng)) {
          const result = { lat, lng };
          geocodeCache.set(cacheKey, result);
          return result;
        }
      }
    }

    // 2차 폴백: 키워드 검색 (구·동 단위 약식 주소도 인식)
    const keywordUrl = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
    keywordUrl.searchParams.set('query', query);
    keywordUrl.searchParams.set('size', '1');

    const keywordRes = await fetch(keywordUrl.toString(), {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!keywordRes.ok) {
      console.error(`[geocode] Kakao API error: ${keywordRes.status} ${keywordRes.statusText}`);
      return null;
    }

    const keywordData = await keywordRes.json();
    if (!keywordData.documents || keywordData.documents.length === 0) {
      console.error('[geocode] No results found for address:', address);
      return null;
    }

    const doc = keywordData.documents[0];
    const lat = parseFloat(doc.y);
    const lng = parseFloat(doc.x);

    if (isNaN(lat) || isNaN(lng)) {
      console.error('[geocode] Invalid coordinates in response:', doc);
      return null;
    }

    const result = { lat, lng };
    geocodeCache.set(cacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('[geocode] Request timeout after 5 seconds');
      } else {
        console.error('[geocode] Error:', error.message);
      }
    } else {
      console.error('[geocode] Unknown error:', error);
    }
    return null;
  }
}
