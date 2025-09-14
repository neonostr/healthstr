import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { hasNip07, getPublicKey as getPk, npubFromHex, buildPollEvent, signEvent, publishEvent, voteOnPoll as vote, RELAYS } from "@/lib/nostr";
import { toast } from "@/components/ui/use-toast";

export type NostrContextType = {
  connected: boolean;
  pubkey: string | null;
  npub: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  publishPoll: (args: { question: string; options: string[]; category?: string }) => Promise<string | null>;
  voteOnPoll: (pollId: string, choiceIndex: number) => Promise<void>;
  relays: string[];
};

const NostrContext = createContext<NostrContextType | undefined>(undefined);

export const NostrProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pubkey, setPubkey] = useState<string | null>(null);

  const connect = useCallback(async () => {
    try {
      if (!hasNip07()) {
        toast({ title: "Nostr extension not found", description: "Install/enable a NIP-07 extension (e.g., Alby, nos2x)." });
        return;
      }
      const pk = await getPk();
      setPubkey(pk);
      toast({ title: "Connected to Nostr", description: `${npubFromHex(pk).slice(0, 12)}…` });
    } catch (e: any) {
      toast({ title: "Connection failed", description: e?.message ?? String(e) });
    }
  }, []);

  const disconnect = useCallback(() => {
    setPubkey(null);
    toast({ title: "Disconnected" });
  }, []);

  const publishPoll: NostrContextType["publishPoll"] = useCallback(async ({ question, options, category }) => {
    try {
      if (!pubkey) {
        toast({ title: "Connect Nostr", description: "You must connect a Nostr key to create polls." });
        return null;
      }
      const unsigned = buildPollEvent({ question, options, category });
      const signed = await signEvent(unsigned);
      await publishEvent(signed);
      const eventId = signed.id;
      toast({ 
        title: "Poll published successfully! 🎉", 
        description: (
          <div className="space-y-2">
            <p className="text-sm">Event ID: <code className="bg-muted px-1 rounded text-xs">{eventId}</code></p>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Verify on:</p>
              <div className="flex gap-2">
                <a 
                  href={`https://njump.me/e/${eventId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  njump
                </a>
                <a 
                  href={`https://nostr.band/e/${eventId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  nostr.band
                </a>
              </div>
            </div>
          </div>
        )
      });
      return eventId ?? null;
    } catch (e: any) {
      toast({ title: "Failed to publish poll", description: e?.message ?? String(e) });
      return null;
    }
  }, [pubkey]);

  const voteOnPoll = useCallback(async (pollId: string, choiceIndex: number) => {
    try {
      if (!pubkey) {
        toast({ title: "Connect Nostr", description: "You must connect a Nostr key to vote." });
        return;
      }
      await vote(pollId, choiceIndex);
      toast({ title: "Vote published" });
    } catch (e: any) {
      toast({ title: "Failed to vote", description: e?.message ?? String(e) });
    }
  }, [pubkey]);

  const value = useMemo<NostrContextType>(() => ({
    connected: !!pubkey,
    pubkey,
    npub: pubkey ? npubFromHex(pubkey) : null,
    connect,
    disconnect,
    publishPoll,
    voteOnPoll,
    relays: RELAYS,
  }), [pubkey, connect, disconnect, publishPoll, voteOnPoll]);

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>;
};

export const useNostr = () => {
  const ctx = useContext(NostrContext);
  if (!ctx) throw new Error("useNostr must be used within NostrProvider");
  return ctx;
};
