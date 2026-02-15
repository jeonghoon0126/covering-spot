const services = [
  { name: "런치", href: "https://www.covering.app/lunch" },
  { name: "빌딩", href: "https://www.covering.app/building" },
  { name: "오피스", href: "https://www.covering.app/office" },
];

const links = [
  { name: "이용약관", href: "https://covering.notion.site/2025-01-10-1665e589dc9f80d3b12eec6dfb6fb15d?pvs=4" },
  { name: "개인정보처리방침", href: "https://covering.notion.site/2025-01-10-1665e589dc9f8027bcb1cf230b5f4c85?pvs=4" },
  { name: "질문과 답변", href: "https://qna.covering.app/" },
  { name: "채용", href: "https://career.covering.app/" },
];

export function Footer() {
  return (
    <footer className="bg-[#0F172A] text-[#94A3B8] pt-16 pb-10">
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5">
        {/* Top */}
        <div className="flex justify-between items-start gap-12 pb-10 border-b border-white/10 max-md:flex-col max-md:gap-10">
          {/* Logo + Desc */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary rounded-[9px] grid place-items-center text-white text-[15px] font-extrabold">
                C
              </div>
              <span className="text-white font-bold text-[17px]">커버링 스팟</span>
            </div>
            <p className="text-sm leading-relaxed max-w-[280px]">
              대형/대량 폐기물 수거 전문<br />
              서울 · 경기 · 인천 전 지역
            </p>
          </div>

          {/* Links Grid */}
          <div className="flex gap-16 max-sm:gap-8 max-sm:flex-wrap">
            <div>
              <div className="text-white text-[13px] font-bold mb-4">서비스</div>
              <div className="flex flex-col gap-2.5">
                {services.map((s) => (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] hover:text-white transition-colors"
                  >
                    {s.name}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <div className="text-white text-[13px] font-bold mb-4">고객지원</div>
              <div className="flex flex-col gap-2.5">
                <a href="mailto:support@covering.app" className="text-[13px] hover:text-white transition-colors">
                  support@covering.app
                </a>
                {links.slice(2).map((l) => (
                  <a
                    key={l.name}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] hover:text-white transition-colors"
                  >
                    {l.name}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <div className="text-white text-[13px] font-bold mb-4">법적고지</div>
              <div className="flex flex-col gap-2.5">
                {links.slice(0, 2).map((l) => (
                  <a
                    key={l.name}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] hover:text-white transition-colors"
                  >
                    {l.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 flex justify-between items-end gap-8 max-md:flex-col max-md:items-start max-md:gap-4">
          <div className="text-[12px] leading-[1.8] text-[#64748B]">
            서울특별시 종로구 새문안로5길 13, 1104호<br />
            사업자등록번호 621-87-01772 | 통신판매업 제 2024-서울중구-1863 호
          </div>
          <div className="text-[12px] text-[#64748B]">
            Copyright &copy; 2024 Covering Co. Ltd. | 누구나 처리를 간편하게
          </div>
        </div>
      </div>
    </footer>
  );
}
