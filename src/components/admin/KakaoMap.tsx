"use client";

import Script from "next/script";
import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (container: HTMLElement, options: unknown) => unknown;
        LatLngBounds: new () => unknown;
        CustomOverlay: new (options: unknown) => unknown;
        event: { addListener: (target: unknown, type: string, handler: () => void) => void };
      };
    };
  }
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  subtitle?: string;
  color: string; // HEX color (예: "#3B82F6")
}

export interface KakaoMapHandle {
  panTo: (lat: number, lng: number) => void;
}

interface KakaoMapProps {
  markers: MapMarker[];
  selectedMarkerId?: string | null;
  onMarkerClick?: (id: string) => void;
  className?: string;
}

// HEX 색상만 허용 (CSS injection 방어)
function sanitizeColor(c: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#3B82F6";
}

const KakaoMap = forwardRef<KakaoMapHandle, KakaoMapProps>(function KakaoMap(
  { markers, selectedMarkerId, onMarkerClick, className = "" },
  ref,
) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const overlaysRef = useRef<unknown[]>([]);
  const dotElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const labelElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const selectedIdRef = useRef<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // panTo
  useImperativeHandle(ref, () => ({
    panTo: (lat: number, lng: number) => {
      if (!mapRef.current || !window.kakao?.maps) return;
      try {
        const pos = new window.kakao.maps.LatLng(lat, lng);
        (mapRef.current as any).panTo(pos);
      } catch (e) {
        console.error("[KakaoMap] panTo 실패:", e);
      }
    },
  }), []);

  // 줌 레벨에 따라 라벨 표시/숨김
  const syncLabelVisibility = useCallback(() => {
    if (!mapRef.current) return;
    try {
      const level = (mapRef.current as any).getLevel();
      const show = level <= 8;
      labelElsRef.current.forEach((el) => {
        el.style.display = show ? "block" : "none";
      });
    } catch {}
  }, []);

  const initializeMap = useCallback(() => {
    if (mapRef.current) return; // 이중 초기화 방지
    if (!mapContainerRef.current || !window.kakao?.maps) return;
    try {
      const { kakao } = window;
      const options = {
        center: new kakao.maps.LatLng(37.5665, 126.978),
        level: 8,
      };
      mapRef.current = new kakao.maps.Map(mapContainerRef.current, options);
      kakao.maps.event.addListener(mapRef.current as any, "zoom_changed", syncLabelVisibility);
      setIsMapReady(true);
    } catch (e) {
      console.error("[KakaoMap] 초기화 실패:", e);
      setMapError("지도 초기화에 실패했습니다");
    }
  }, [syncLabelVisibility]);

  // dot 스타일 업데이트 (선택 변경 시)
  const updateDotStyle = useCallback((markerId: string, isSelected: boolean, color: string) => {
    const el = dotElsRef.current.get(markerId);
    if (!el) return;
    const safe = sanitizeColor(color);
    const size = isSelected ? 32 : 26;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.boxShadow = isSelected
      ? `0 0 0 3px ${safe}40, 0 2px 8px rgba(0,0,0,0.3)`
      : "0 2px 6px rgba(0,0,0,0.3)";
  }, []);

  // 마커 렌더 (markers / onMarkerClick 변경 시만 — selectedMarkerId 제외)
  const renderMarkers = useCallback(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    const { kakao } = window;

    // 기존 오버레이 제거
    overlaysRef.current.forEach((overlay: any) => {
      try { overlay.setMap(null); } catch {}
    });
    overlaysRef.current = [];
    dotElsRef.current.clear();
    labelElsRef.current.clear();

    if (markers.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();
    let currentLevel = 8;
    try { currentLevel = (mapRef.current as any).getLevel(); } catch {}
    const showLabels = currentLevel <= 8;

    markers.forEach((marker) => {
      const position = new kakao.maps.LatLng(marker.lat, marker.lng);
      const safe = sanitizeColor(marker.color);
      // 초기 렌더는 항상 비선택 크기(26px)로, 선택 스타일은 별도 effect에서 처리
      const size = 26;

      // 컨테이너
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.alignItems = "center";
      container.style.cursor = "pointer";

      // 원형 dot — 개별 style 속성 (cssText 대신, injection 방어)
      const dot = document.createElement("div");
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.background = safe;
      dot.style.border = "3px solid white";
      dot.style.borderRadius = "50%";
      dot.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
      dot.style.display = "flex";
      dot.style.alignItems = "center";
      dot.style.justifyContent = "center";
      dot.style.fontWeight = "700";
      dot.style.fontSize = "11px";
      dot.style.color = "white";
      dot.style.transition = "all 0.15s ease";
      dot.style.flexShrink = "0";
      if (marker.label) dot.textContent = marker.label;

      container.appendChild(dot);

      // 라벨 (고객명 등)
      if (marker.subtitle) {
        const label = document.createElement("div");
        label.style.fontSize = "10px";
        label.style.fontWeight = "600";
        label.style.color = "#374151";
        label.style.whiteSpace = "nowrap";
        label.style.background = "rgba(255,255,255,0.93)";
        label.style.padding = "1px 5px";
        label.style.borderRadius = "3px";
        label.style.marginTop = "2px";
        label.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";
        label.style.maxWidth = "72px";
        label.style.overflow = "hidden";
        label.style.textOverflow = "ellipsis";
        label.style.display = showLabels ? "block" : "none";
        label.style.pointerEvents = "none";
        label.textContent = marker.subtitle;
        container.appendChild(label);
        labelElsRef.current.set(marker.id, label);
      }

      if (onMarkerClick) {
        container.addEventListener("click", (e) => {
          e.stopPropagation();
          onMarkerClick(marker.id);
        });
      }

      const overlay = new kakao.maps.CustomOverlay({
        position,
        content: container,
        xAnchor: 0.5,
        yAnchor: 0.5,
      });

      (overlay as any).setMap(mapRef.current);
      overlaysRef.current.push(overlay);
      dotElsRef.current.set(marker.id, dot);
      (bounds as any).extend(position);
    });

    if (markers.length === 1) {
      (mapRef.current as any).setCenter(
        new kakao.maps.LatLng(markers[0].lat, markers[0].lng),
      );
      (mapRef.current as any).setLevel(5);
    } else {
      (mapRef.current as any).setBounds(bounds);
    }

    // 렌더 직후 현재 선택 상태 반영
    const curSelected = selectedIdRef.current;
    if (curSelected) {
      const m = markers.find((mk) => mk.id === curSelected);
      if (m) updateDotStyle(curSelected, true, m.color);
    }
  }, [markers, onMarkerClick, updateDotStyle]); // selectedMarkerId 제거!

  // 선택 변경: dot 스타일만 업데이트 (전체 리빌드 없음)
  useEffect(() => {
    if (!isMapReady) return;
    const prev = selectedIdRef.current;
    const next = selectedMarkerId ?? null;
    selectedIdRef.current = next;

    if (prev === next || dotElsRef.current.size === 0) return;

    if (prev) {
      const m = markers.find((mk) => mk.id === prev);
      if (m) updateDotStyle(prev, false, m.color);
    }
    if (next) {
      const m = markers.find((mk) => mk.id === next);
      if (m) updateDotStyle(next, true, m.color);
    }
  }, [selectedMarkerId, isMapReady, markers, updateDotStyle]);

  useEffect(() => {
    if (isMapReady) renderMarkers();
  }, [isMapReady, renderMarkers]);

  useEffect(() => {
    return () => {
      overlaysRef.current.forEach((overlay: any) => {
        try { overlay.setMap(null); } catch {}
      });
      overlaysRef.current = [];
    };
  }, []);

  // SDK 재방문 대응 + 타임아웃
  useEffect(() => {
    if (!mapRef.current && window.kakao?.maps) {
      window.kakao.maps.load(() => {
        setSdkLoaded(true);
        initializeMap();
      });
    }
    const timeout = setTimeout(() => {
      if (!mapRef.current) {
        const host = typeof window !== "undefined" ? window.location.hostname : "";
        setMapError(
          `지도 로드 시간 초과. Kakao 개발자 콘솔에서 "${host}" 도메인을 등록해주세요.`
        );
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [initializeMap]);

  const handleScriptLoad = useCallback(() => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => {
        setSdkLoaded(true);
        initializeMap();
      });
    } else {
      setMapError("Kakao Maps SDK 로드에 실패했습니다. API 키를 확인해주세요.");
    }
  }, [initializeMap]);

  return (
    <>
      {!sdkLoaded && (
        <Script
          src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&autoload=false`}
          strategy="afterInteractive"
          onLoad={handleScriptLoad}
        />
      )}
      <div className={`relative ${className}`}>
        {!isMapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-10">
            {mapError ? (
              <div className="text-center px-4">
                <p className="text-red-500 text-sm font-medium mb-2">{mapError}</p>
                <a
                  href="https://developers.kakao.com/console/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 underline"
                >
                  Kakao 개발자 콘솔 열기
                </a>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">지도를 불러오는 중...</div>
            )}
          </div>
        )}
        <div
          ref={mapContainerRef}
          className="w-full h-full rounded-lg"
          style={{ minHeight: "400px" }}
          role="application"
          aria-label="배차 지도"
        />
      </div>
    </>
  );
});

export default KakaoMap;
