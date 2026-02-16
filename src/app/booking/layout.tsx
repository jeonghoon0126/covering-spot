import Link from "next/link";

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-warm">
      <header className="sticky top-0 z-50 bg-white border-b border-border">
        <div className="max-w-[42rem] mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/images/logo.png" alt="커버링" className="w-7 h-7 rounded-[8px]" />
            <span className="text-lg font-bold text-primary">커버링 방문 수거</span>
          </Link>
          <Link
            href="/booking/manage"
            className="text-sm text-text-sub hover:text-text-primary"
          >
            신청 조회
          </Link>
        </div>
      </header>
      <main className="max-w-[42rem] mx-auto px-4 py-8">{children}</main>
      <footer className="border-t border-border-light py-6 text-center text-xs text-text-muted space-y-1">
        <p>서울특별시 종로구 새문안로5길 13, 1104호</p>
        <p>사업자등록번호 621-87-01772 | 통신판매업 제 2024-서울중구-1863 호</p>
        <p>Copyright &copy; 2024 Covering Co. Ltd.</p>
      </footer>
    </div>
  );
}
