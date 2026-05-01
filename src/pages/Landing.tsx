import { useReveal } from "@/hooks/use-reveal";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { RoiCompare } from "@/components/landing/RoiCompare";
import { PainSolution } from "@/components/landing/PainSolution";
import { Modules } from "@/components/landing/Modules";
import { SocialProof } from "@/components/landing/SocialProof";
import { Pricing } from "@/components/landing/Pricing";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";

export default function Landing() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <div ref={ref} className="relative min-h-screen overflow-x-hidden bg-background">
      <Navbar />
      <main>
        <Hero />
        <RoiCompare />
        <PainSolution />
        <Modules />
        <SocialProof />
        <Pricing />
        <FinalCTA />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
