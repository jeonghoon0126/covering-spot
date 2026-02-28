import type { Booking } from "@/types/booking";
import { STATUS_LABELS } from "@/lib/constants";

// CSV 내보내기: 현재 필터 조건으로 최대 1000건 서버에서 가져와 내보냄
export async function exportCSV(params: {
  token: string;
  activeTab: string;
  debouncedSearch: string;
  dateFrom: string;
  dateTo: string;
  showToast: (msg: string, isError?: boolean) => void;
}) {
  const { token, activeTab, debouncedSearch, dateFrom, dateTo, showToast } = params;
  try {
    const searchParams = new URLSearchParams();
    if (activeTab !== "all") searchParams.set("status", activeTab);
    if (debouncedSearch) searchParams.set("search", debouncedSearch);
    if (dateFrom) searchParams.set("dateFrom", dateFrom);
    if (dateTo) searchParams.set("dateTo", dateTo);
    searchParams.set("limit", "1000");

    const res = await fetch(`/api/admin/bookings?${searchParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const rows: Booking[] = data.bookings || [];

    const headers = ["날짜", "시간", "고객명", "전화번호", "지역", "주소", "인원", "사다리", "사다리금액", "품목수", "예상금액", "확정금액", "기사", "상태"];
    const csvRows = rows.map((b) => [
      b.date,
      b.confirmedTime || b.timeSlot,
      b.customerName,
      b.phone,
      b.area,
      `${b.address} ${b.addressDetail || ""}`.trim(),
      String(b.crewSize),
      b.needLadder ? "필요" : "",
      b.needLadder && b.ladderPrice ? String(b.ladderPrice) : "",
      String(b.items.length),
      b.estimateMin && b.estimateMax ? `${b.estimateMin}~${b.estimateMax}` : String(b.totalPrice),
      b.finalPrice != null ? String(b.finalPrice) : "",
      b.driverName || "",
      STATUS_LABELS[b.status] || b.status,
    ]);

    const BOM = "\uFEFF";
    const csv = BOM + [headers, ...csvRows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `커버링스팟_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    showToast("내보내기 실패", true);
  }
}
