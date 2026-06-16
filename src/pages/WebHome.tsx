import GNB from '../components/layout/GNB'
import Footer from '../components/layout/Footer'
import HeroSection from '../components/sections/HeroSection'
import StatBar from '../components/web/StatBar'
import IntroSection from '../components/web/IntroSection'
import BASplitSection from '../components/web/BASplitSection'
import FeaturesGrid from '../components/web/FeaturesGrid'
import BrandsSection from '../components/web/BrandsSection'
import TargetSection from '../components/web/TargetSection'
import ScheduleSection from '../components/web/ScheduleSection'
import JoinSection from '../components/web/JoinSection'
import ContactForm from '../components/web/ContactForm'
import CareerSection from '../components/web/CareerSection'
import CTASection from '../components/web/CTASection'

export default function WebHome() {
  return (
    <>
      <GNB />
      <main>
        <HeroSection />
        <StatBar />
        <IntroSection />
        <BASplitSection />
        <FeaturesGrid />
        <BrandsSection />
        <TargetSection />
        <ScheduleSection />
        <JoinSection />
        <ContactForm />
        <CareerSection />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
