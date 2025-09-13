import { Button } from "@/components/ui/button";
import { Heart, Plus, User } from "lucide-react";

const Header = () => {
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
            <Button variant="ghost" size="sm">
              Global
            </Button>
            <Button variant="ghost" size="sm">
              Following
            </Button>
            <Button variant="ghost" size="sm">
              Network
            </Button>
          </nav>
          
          <div className="flex items-center space-x-2">
            <Button size="sm" className="bg-health-primary hover:bg-health-primary/90">
              <Plus className="h-4 w-4 mr-1" />
              Create Poll
            </Button>
            <Button variant="outline" size="sm">
              <User className="h-4 w-4 mr-1" />
              Connect Nostr
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;