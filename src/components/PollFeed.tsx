import { useEffect, useMemo, useState } from "react";
import PollCard from "./PollCard";
import { Badge } from "@/components/ui/badge";
import { Filter, TrendingUp } from "lucide-react";
import { fetchGlobalPolls, fetchVotesForPoll, npubFromHex, timeAgo, type ParsedPoll } from "@/lib/nostr";

interface UIPollOption {
  id: string;
  text: string;
  votes: number;
}
interface UIPoll {
  id: string;
  question: string;
  options: UIPollOption[];
  totalVotes: number;
  category: string;
  author: string;
  timeAgo: string;
  comments: number;
  created_at: number;
}

const toUIPoll = (p: ParsedPoll): UIPoll => ({
  id: p.id,
  question: p.question,
  options: p.options.map((text, idx) => ({ id: `${p.id}-${idx}` , text, votes: 0 })),
  totalVotes: 0,
  category: p.category ?? "General",
  author: npubFromHex(p.authorPubkey).slice(0, 12) + "…",
  timeAgo: timeAgo(p.created_at),
  comments: 0,
  created_at: p.created_at,
});

const PollFeed = () => {
  const [polls, setPolls] = useState<UIPoll[]>([]);
  const sorted = useMemo(() => polls.sort((a, b) => b.created_at - a.created_at), [polls]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const parsed = await fetchGlobalPolls(30);
        if (!alive) return;
        const ui = parsed.map(toUIPoll);
        setPolls(ui);
        // Fetch votes in background and update
        parsed.forEach(async (p, idx) => {
          try {
            const counts = await fetchVotesForPoll(p.id);
            if (!alive) return;
            setPolls((prev) => {
              const next = [...prev];
              const i = next.findIndex((x) => x.id === p.id);
              if (i >= 0) {
                const total = counts.reduce((a, b) => a + b, 0);
                next[i] = {
                  ...next[i],
                  options: next[i].options.map((opt, j) => ({ ...opt, votes: counts[j] ?? 0 })),
                  totalVotes: total,
                };
              }
              return next;
            });
          } catch {}
        });
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  // Listen to locally-created polls and prepend immediately
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ParsedPoll>;
      const parsed = ce.detail;
      if (!parsed) return;
      setPolls((prev) => [toUIPoll(parsed), ...prev]);
    };
    window.addEventListener("poll-created", handler as EventListener);
    return () => window.removeEventListener("poll-created", handler as EventListener);
  }, []);

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
          {sorted.map((poll) => (
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