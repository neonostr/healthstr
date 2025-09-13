import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import PollFeed from "@/components/PollFeed";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <PollFeed />
      </main>
    </div>
  );
};

export default Index;
