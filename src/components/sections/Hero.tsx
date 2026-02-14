import Link from "next/link";
import { CTALink } from "@/components/ui/CTALink";
import { KakaoIcon } from "@/components/ui/KakaoIcon";

export function Hero() {
  return (
    <section className="pt-[140px] pb-20 bg-bg-warm max-md:pt-[120px] max-md:pb-16">
      <div className="max-w-[1200px] mx-auto px-20 max-lg:px-10 max-sm:px-5">
        <div className="grid grid-cols-[1fr_400px] items-center gap-16 max-lg:grid-cols-[1fr_340px] max-lg:gap-10 max-md:grid-cols-1 max-md:text-center">
          {/* Left: Text */}
          <div>
            <div className="inline-flex items-center gap-2 bg-bg border border-border rounded-full px-4 py-2 text-sm font-semibold text-text-sub mb-7">
              <span className="w-2 h-2 bg-[#22C55E] rounded-full shrink-0" />
              서울 · 경기 · 인천 전 지역 | 주 7일 운영
            </div>
            <h1 className="text-[48px] font-extrabold leading-[1.2] tracking-[-1.5px] mb-5 max-lg:text-[40px] max-md:text-[32px] max-sm:text-[28px] max-md:tracking-[-1px]">
              대형/대량 폐기물,
              <br />
              <span className="text-primary">이제 쉽고 간편하게</span>
            </h1>
            <p className="text-[17px] text-text-sub leading-[1.7] mb-9 max-md:text-[15px]">
              소량부터 대량까지, 카톡 한 번이면 끝
              <br />
              사전 견적 = 최종 금액, 추가 비용 없는 투명한 가격
            </p>
            <div className="flex gap-3 max-md:justify-center max-md:flex-col max-md:items-center">
              <CTALink
                location="hero"
                className="inline-flex items-center gap-2 bg-kakao text-text-primary text-base font-bold py-[15px] px-7 rounded-[12px] hover:bg-kakao-hover active:scale-[0.98] transition-all max-md:w-full max-md:max-w-[320px] max-md:justify-center"
              >
                <KakaoIcon />
                <span>무료 견적 받기</span>
              </CTALink>
              <Link
                href="/booking"
                className="inline-flex items-center bg-primary text-white text-base font-semibold py-[15px] px-7 rounded-[12px] hover:bg-primary/90 active:scale-[0.98] transition-all max-md:w-full max-md:max-w-[320px] max-md:justify-center"
              >
                온라인 예약하기
              </Link>
            </div>
          </div>

          {/* Right: Chat Mockup */}
          <div className="w-full max-w-[380px] bg-white rounded-[16px] border border-border overflow-hidden max-md:max-w-[320px] max-md:mx-auto">
            <div className="bg-bg-warm px-5 py-4 flex items-center gap-3 border-b border-border">
              <div className="w-9 h-9 rounded-[10px] bg-primary grid place-items-center text-white text-sm font-extrabold">
                C
              </div>
              <div>
                <div className="text-[15px] font-bold">커버링 스팟</div>
                <div className="text-[11px] text-text-muted mt-px">
                  보통 3분 내 응답
                </div>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-2.5">
              <div className="flex justify-end">
                <span className="text-[11px] text-text-muted self-end mx-1.5">
                  오후 2:03
                </span>
                <div className="max-w-[250px] px-3.5 py-2.5 text-[13px] leading-[1.55] break-keep bg-kakao rounded-[14px_14px_4px_14px]">
                  침대, 책상, 의류박스 2개
                  <br />
                  수거 가능한가요?
                </div>
              </div>
              <div className="flex">
                <div className="max-w-[250px] px-3.5 py-2.5 text-[13px] leading-[1.55] break-keep bg-bg-warm2 rounded-[14px_14px_14px_4px]">
                  네! 바로 견적 드릴게요 😊
                  <br />
                  <br />
                  침대 세트: 50,000원
                  <br />
                  책상: 37,000원
                  <br />
                  박스 2개: 10,000원
                  <br />
                  출장비: 47,000원
                  <br />
                  <strong className="font-bold">총 144,000원</strong>
                </div>
                <span className="text-[11px] text-text-muted self-end mx-1.5">
                  오후 2:05
                </span>
              </div>
              <div className="flex justify-end">
                <span className="text-[11px] text-text-muted self-end mx-1.5">
                  오후 2:06
                </span>
                <div className="max-w-[250px] px-3.5 py-2.5 text-[13px] leading-[1.55] break-keep bg-kakao rounded-[14px_14px_4px_14px]">
                  오 깔끔하다! 토요일 가능해요?
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
