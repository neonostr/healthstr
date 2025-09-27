import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNostr } from "@/context/NostrContext";

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface PollCardProps {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  category: string;
  author: string;
  timeAgo: string;
  comments: number;
}

const PollCard = ({ 
  id,
  question, 
  options, 
  totalVotes, 
  category, 
  author, 
  timeAgo, 
  comments 
}: PollCardProps) => {
  const { voteOnPoll, connected, connect } = useNostr();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  // Optimistic local counts
  const [optimisticVotes, setOptimisticVotes] = useState<number[] | null>(null);
  const [optimisticTotal, setOptimisticTotal] = useState<number | null>(null);

  // Reset optimistic counts when props change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setOptimisticVotes(null);
    setOptimisticTotal(null);
  }, [id, options, totalVotes]);

  const displayedVotes = optimisticVotes ?? options.map(o => o.votes);
  const displayedTotal = optimisticTotal ?? totalVotes;

  const handleVote = async (choiceIndex: number) => {
    setSelectedIndex(choiceIndex);
    setHasVoted(true);
    try {
      if (!connected) await connect();
      await voteOnPoll(id, choiceIndex);
      // Optimistically update UI
      setOptimisticVotes((prev) => {
        const base = prev ?? options.map(o => o.votes);
        const next = [...base];
        next[choiceIndex] = (next[choiceIndex] ?? 0) + 1;
        return next;
      });
      setOptimisticTotal((prev) => (prev ?? totalVotes) + 1);
    } catch (e) {
      // noop, errors are toasted by context
    }
  };

  const getPercentage = (votes: number) => {
    return displayedTotal > 0 ? Math.round((votes / displayedTotal) * 100) : 0;
  };
  return (
    <Card className="w-full shadow-soft hover:shadow-medium transition-all duration-300 bg-gradient-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-health-primary/10 text-health-primary border-health-primary/20">
              {category}
            </Badge>
            <span className="text-sm text-muted-foreground">by {author}</span>
            <span className="text-sm text-muted-foreground">• {timeAgo}</span>
          </div>
        </div>
        <CardTitle className="text-lg leading-relaxed">{question}</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {options.map((option, idx) => (
          <div key={option.id} className="space-y-2">
            {!hasVoted ? (
              <Button
                variant="outline"
                className="w-full h-auto p-3 text-left justify-start hover:bg-health-primary/5 hover;border-health-primary/30 transition-all duration-200"
                onClick={() => handleVote(idx)}
              >
                {option.text}
              </Button>
            ) : (
              <div className="relative overflow-hidden rounded-lg border bg-card p-3">
                <div className="flex justify-between items-center relative z-10">
                  <span className="font-medium">{option.text}</span>
                  <span className="text-sm font-semibold text-health-primary">
                    {getPercentage(displayedVotes[idx] ?? 0)}%
                  </span>
                </div>
                <div className="absolute inset-0 bg-health-primary/10 origin-left scale-x-0 animate-pulse-glow"
                     style={{ 
                       transform: `scaleX(${getPercentage(displayedVotes[idx] ?? 0) / 100})`,
                       transition: 'transform 1s ease-out'
                     }} />
                {selectedIndex === idx && (
                  <div className="absolute inset-0 bg-health-secondary/20 origin-left"
                       style={{ 
                         transform: `scaleX(${getPercentage(displayedVotes[idx] ?? 0) / 100})`,
                         transition: 'transform 1s ease-out'
                       }} />
                )}
              </div>
            )}
          </div>
        ))}
        
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>{displayedTotal} votes</span>
            </div>
            <div className="flex items-center space-x-1">
              <MessageCircle className="h-4 w-4" />
              <span>{comments} comments</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-health-primary hover:text-health-primary/80">
            <TrendingUp className="h-4 w-4 mr-1" />
            View Results
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PollCard;