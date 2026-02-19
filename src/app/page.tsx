import { Nav } from "@/components/layout/Nav";
import { Hero } from "@/components/sections/Hero";
import { TrustBar } from "@/components/sections/TrustBar";
import { ItemsCarousel } from "@/components/sections/ItemsCarousel";
import { Process } from "@/components/sections/Process";
import { Pricing } from "@/components/sections/Pricing";
import { ItemPrices } from "@/components/sections/ItemPrices";
import { Compare } from "@/components/sections/Compare";
import { FAQ } from "@/components/sections/FAQ";
import { CTASection } from "@/components/sections/CTASection";
import { AppDownload } from "@/components/sections/AppDownload";
import { Footer } from "@/components/layout/Footer";
import { FloatingCTA } from "@/components/layout/FloatingCTA";
import { Splash } from "@/components/Splash";

import { carouselItems } from "@/data/carousel-items";
import { priceCategories } from "@/data/price-data";
import { faqItems } from "@/data/faq-data";

export default function Page() {
  return (
    <Splash>
      <Nav />
      <section className="hero-section" id="hero">
        <Hero />
      </section>
      <TrustBar />
      <ItemsCarousel items={carouselItems} />
      <Process />
      <Pricing />
      <ItemPrices categories={priceCategories} />
      <Compare />
      <FAQ items={faqItems} />
      <CTASection />
      <AppDownload />
      <Footer />
      <FloatingCTA />
    </Splash>
  );
}
