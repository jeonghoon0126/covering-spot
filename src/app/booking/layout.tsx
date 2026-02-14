import Link from "next/link";

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-warm">
      <header className="sticky top-0 z-50 bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-primary">
            커버링 스팟
          </Link>
          <Link
            href="/"
            className="text-sm text-text-sub hover:text-text-primary"
          >
            홈으로
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
      <footer className="border-t border-border-light py-6 text-center text-sm text-text-muted">
        <p>더블유에이치 | 대표 강성현</p>
      </footer>
    </div>
  );
}
