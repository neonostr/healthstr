import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Heart, Zap } from "lucide-react";
import CreatePollModal from "./CreatePollModal";

const HeroSection = () => {
  return (
    <section className="relative py-16 md:py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero opacity-5" />
      
      <div className="container relative">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 bg-health-primary/10 px-4 py-2 rounded-full">
            <Zap className="h-4 w-4 text-health-primary" />
            <span className="text-sm font-medium text-health-primary">
              Powered by Nostr Network
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Crowdsource Health Knowledge{" "}
            <span className="text-health-primary">Transparently</span>
          </h1>
          
          <p className="text-xl text-muted-foreground leading-relaxed">
            Create and vote on health polls in a decentralized network. Get insights from real people 
            about supplements, treatments, and wellness topics that matter to you.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <CreatePollModal />
            <Button variant="outline" size="lg" className="border-health-primary/20">
              Explore Polls
            </Button>
          </div>
        </div>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center space-y-3 p-6 rounded-xl bg-card shadow-soft">
            <div className="w-12 h-12 mx-auto bg-health-primary/10 rounded-lg flex items-center justify-center">
              <Heart className="h-6 w-6 text-health-primary" />
            </div>
            <h3 className="font-semibold text-lg">Health-Focused</h3>
            <p className="text-muted-foreground">
              Dedicated platform for health and wellness discussions
            </p>
          </div>
          
          <div className="text-center space-y-3 p-6 rounded-xl bg-card shadow-soft">
            <div className="w-12 h-12 mx-auto bg-health-secondary/10 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-health-secondary" />
            </div>
            <h3 className="font-semibold text-lg">Community Driven</h3>
            <p className="text-muted-foreground">
              Real experiences from people you trust and follow
            </p>
          </div>
          
          <div className="text-center space-y-3 p-6 rounded-xl bg-card shadow-soft">
            <div className="w-12 h-12 mx-auto bg-health-accent/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-health-accent" />
            </div>
            <h3 className="font-semibold text-lg">Transparent Results</h3>
            <p className="text-muted-foreground">
              Open data on the decentralized Nostr network
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;