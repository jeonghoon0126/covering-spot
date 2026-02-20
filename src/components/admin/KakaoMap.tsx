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
  color: string; // HEX color 직접 지원 (예: "#3B82F6")
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

const KakaoMap = forwardRef<KakaoMapHandle, KakaoMapProps>(function KakaoMap(
  { markers, selectedMarkerId, onMarkerClick, className = "" },
  ref,
) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const overlaysRef = useRef<unknown[]>([]);
  const markerElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevSelectedRef = useRef<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // panTo 외부 호출용
  useImperativeHandle(ref, () => ({
    panTo: (lat: number, lng: number) => {
      if (!mapRef.current || !window.kakao?.maps) return;
      const pos = new window.kakao.maps.LatLng(lat, lng);
      (mapRef.current as any).panTo(pos);
    },
  }), []);

  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || !window.kakao?.maps) return;

    try {
      const { kakao } = window;
      const container = mapContainerRef.current;
      const options = {
        center: new kakao.maps.LatLng(37.5665, 126.978),
        level: 11,
      };

      mapRef.current = new kakao.maps.Map(container, options);
      setIsMapReady(true);
    } catch (e) {
      console.error("[KakaoMap] 초기화 실패:", e);
      setMapError("지도 초기화에 실패했습니다");
    }
  }, []);

  // 마커 DOM 스타일만 업데이트 (선택 변경 시)
  const updateMarkerStyle = useCallback((markerId: string, isSelected: boolean, color: string) => {
    const el = markerElsRef.current.get(markerId);
    if (!el) return;
    const size = isSelected ? 28 : 22;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.boxShadow = isSelected
      ? `0 0 0 3px ${color}40, 0 2px 8px rgba(0,0,0,0.3)`
      : "0 2px 6px rgba(0,0,0,0.3)";
  }, []);

  const renderMarkers = useCallback(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const { kakao } = window;

    // 기존 오버레이 제거
    overlaysRef.current.forEach((overlay: any) => {
      overlay.setMap(null);
    });
    overlaysRef.current = [];
    markerElsRef.current.clear();

    if (markers.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();

    markers.forEach((marker) => {
      const position = new kakao.maps.LatLng(marker.lat, marker.lng);
      const isSelected = marker.id === selectedMarkerId;
      const color = marker.color;
      const size = isSelected ? 28 : 22;

      const el = document.createElement("div");
      el.style.cssText = `
        width: ${size}px; height: ${size}px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: 11px; color: white;
      `;
      if (isSelected) {
        el.style.boxShadow = `0 0 0 3px ${color}40, 0 2px 8px rgba(0,0,0,0.3)`;
      }
      if (marker.label) el.textContent = marker.label;

      if (onMarkerClick) {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onMarkerClick(marker.id);
        });
      }

      const overlay = new kakao.maps.CustomOverlay({
        position,
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
      });

      (overlay as any).setMap(mapRef.current);
      overlaysRef.current.push(overlay);
      markerElsRef.current.set(marker.id, el);
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
    prevSelectedRef.current = selectedMarkerId ?? null;
  }, [markers, selectedMarkerId, onMarkerClick]);

  // 선택 변경: 마커 데이터가 같으면 스타일만 업데이트
  useEffect(() => {
    if (!isMapReady) return;
    const prev = prevSelectedRef.current;
    if (prev === (selectedMarkerId ?? null) || markerElsRef.current.size === 0) return;

    // 이전 선택 해제
    if (prev) {
      const m = markers.find((mk) => mk.id === prev);
      if (m) updateMarkerStyle(prev, false, m.color);
    }
    // 새 선택 하이라이트
    if (selectedMarkerId) {
      const m = markers.find((mk) => mk.id === selectedMarkerId);
      if (m) updateMarkerStyle(selectedMarkerId, true, m.color);
    }
    prevSelectedRef.current = selectedMarkerId ?? null;
  }, [selectedMarkerId, isMapReady, markers, updateMarkerStyle]);

  useEffect(() => {
    if (isMapReady) renderMarkers();
  }, [isMapReady, renderMarkers]);

  useEffect(() => {
    return () => {
      overlaysRef.current.forEach((overlay: any) => overlay.setMap(null));
      overlaysRef.current = [];
    };
  }, []);

  // SDK가 이미 로드되었을 수 있음 (페이지 재방문 등)
  useEffect(() => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => {
        setSdkLoaded(true);
        initializeMap();
      });
    }
    // 10초 타임아웃: SDK 로드 실패 감지
    const timeout = setTimeout(() => {
      if (!isMapReady) {
        const host = typeof window !== "undefined" ? window.location.hostname : "";
        setMapError(
          `지도 로드 시간 초과. Kakao 개발자 콘솔에서 "${host}" 도메인을 등록해주세요.`
        );
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [initializeMap, isMapReady]);

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
        />
      </div>
    </>
  );
});

export default KakaoMap;
