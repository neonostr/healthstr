import PollCard from "./PollCard";
import { Badge } from "@/components/ui/badge";
import { Filter, TrendingUp } from "lucide-react";

// Mock data for demonstration
const mockPolls = [
  {
    id: "1",
    question: "Which magnesium supplement form do you find most effective for sleep quality?",
    options: [
      { id: "1a", text: "Magnesium Glycinate", votes: 45 },
      { id: "1b", text: "Magnesium Oxide", votes: 12 },
      { id: "1c", text: "Magnesium Citrate", votes: 28 },
      { id: "1d", text: "Magnesium L-Threonate", votes: 15 }
    ],
    totalVotes: 100,
    category: "Supplements",
    author: "healthseeker.npub",
    timeAgo: "2h",
    comments: 23
  },
  {
    id: "2", 
    question: "What's your preferred method for tracking daily protein intake?",
    options: [
      { id: "2a", text: "MyFitnessPal app", votes: 67 },
      { id: "2b", text: "Manual food diary", votes: 23 },
      { id: "2c", text: "Don't track", votes: 45 },
      { id: "2d", text: "Other app", votes: 18 }
    ],
    totalVotes: 153,
    category: "Nutrition",
    author: "fitnessguru.npub", 
    timeAgo: "4h",
    comments: 31
  },
  {
    id: "3",
    question: "How many hours of sleep do you typically get per night?",
    options: [
      { id: "3a", text: "Less than 6 hours", votes: 34 },
      { id: "3b", text: "6-7 hours", votes: 89 },
      { id: "3c", text: "7-8 hours", votes: 156 },
      { id: "3d", text: "More than 8 hours", votes: 43 }
    ],
    totalVotes: 322,
    category: "Sleep",
    author: "sleepcoach.npub",
    timeAgo: "6h", 
    comments: 67
  },
  {
    id: "4",
    question: "Which meditation app has helped you the most with stress management?",
    options: [
      { id: "4a", text: "Headspace", votes: 78 },
      { id: "4b", text: "Calm", votes: 92 },
      { id: "4c", text: "Insight Timer", votes: 54 },
      { id: "4d", text: "Don't use apps", votes: 38 }
    ],
    totalVotes: 262,
    category: "Mental Health",
    author: "mindfulness.npub",
    timeAgo: "8h",
    comments: 45
  }
];

const PollFeed = () => {
  return (
    <section className="py-12">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold">Latest Health Polls</h2>
            <Badge variant="outline" className="bg-health-success/10 text-health-success border-health-success/20">
              <TrendingUp className="h-3 w-3 mr-1" />
              Trending
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Global Feed</span>
          </div>
        </div>
        
        <div className="grid gap-6">
          {mockPolls.map((poll) => (
            <PollCard key={poll.id} {...poll} />
          ))}
        </div>
        
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Connect your Nostr key to see personalized feeds from people you follow
          </p>
          <Badge variant="outline" className="bg-health-primary/10 text-health-primary border-health-primary/20">
            🔒 Decentralized & Private
          </Badge>
        </div>
      </div>
    </section>
  );
};

export default PollFeed;