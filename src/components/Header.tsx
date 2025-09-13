import { Button } from "@/components/ui/button";
import { Heart, Plus, User } from "lucide-react";
import { useNostr } from "@/context/NostrContext";
import { useNavigate, useSearchParams } from "react-router-dom";

const Header = () => {
  const { connected, npub, connect, disconnect } = useNostr();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const feed = params.get("feed") || "global";

  const setFeed = (value: string) => navigate(`/?feed=${value}`);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <a className="mr-6 flex items-center space-x-2" href="/">
            <Heart className="h-6 w-6 text-health-primary" />
            <span className="font-bold text-lg">HealthPolls</span>
          </a>
        </div>
        
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="flex items-center space-x-2">
            <Button variant={feed === "global" ? "secondary" : "ghost"} size="sm" onClick={() => setFeed("global")}>Global</Button>
            <Button variant={feed === "following" ? "secondary" : "ghost"} size="sm" onClick={() => setFeed("following")}>Following</Button>
            <Button variant={feed === "network" ? "secondary" : "ghost"} size="sm" onClick={() => setFeed("network")}>Network</Button>
          </nav>
          
          <div className="flex items-center space-x-2">
            <Button size="sm" className="bg-health-primary hover:bg-health-primary/90" onClick={() => document.getElementById("create-poll-trigger")?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}>
              <Plus className="h-4 w-4 mr-1" />
              Create Poll
            </Button>
            {!connected ? (
              <Button variant="outline" size="sm" onClick={connect}>
                <User className="h-4 w-4 mr-1" />
                Connect Nostr
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" title={npub || undefined}>
                  {npub?.slice(0, 10)}…
                </Button>
                <Button variant="ghost" size="sm" onClick={disconnect}>Disconnect</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;