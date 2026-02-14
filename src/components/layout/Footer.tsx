export function Footer() {
  return (
    <footer className="bg-bg border-t border-border py-12 text-[13px] text-text-muted leading-[1.8]">
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5 flex justify-between items-start max-md:flex-col max-md:gap-4">
        <div className="flex items-center gap-2 font-bold text-[15px] text-text-sub">
          <div className="w-[26px] h-[26px] bg-primary rounded-[7px] grid place-items-center text-white text-xs font-extrabold">
            C
          </div>
          커버링 스팟
        </div>
        <div className="text-right max-md:text-left">
          사업자등록번호 000-00-00000 | 서울특별시 강남구 테헤란로 11, 1114호
          <br />
          대표: 홍길동 | 전화번호: 02-1234-5678
        </div>
      </div>
    </footer>
  );
}
