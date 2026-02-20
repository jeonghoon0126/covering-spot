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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const url = new URL('https://dapi.kakao.com/v2/local/search/address.json');
    url.searchParams.set('query', address.trim());

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `[geocode] Kakao API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    if (!data.documents || data.documents.length === 0) {
      console.error('[geocode] No results found for address:', address);
      return null;
    }

    const doc = data.documents[0];
    const lat = parseFloat(doc.y);
    const lng = parseFloat(doc.x);

    if (isNaN(lat) || isNaN(lng)) {
      console.error('[geocode] Invalid coordinates in response:', doc);
      return null;
    }

    return { lat, lng };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('[geocode] Request timeout after 3 seconds');
      } else {
        console.error('[geocode] Error:', error.message);
      }
    } else {
      console.error('[geocode] Unknown error:', error);
    }
    return null;
  }
}
