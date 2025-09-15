// Nostr utility functions and SimplePool setup
// Minimal types to avoid tight coupling with nostr-tools internal types
export type NostrEvent = {
  id?: string;
  kind: number;
  pubkey?: string;
  created_at: number;
  content: string;
  tags: string[][];
  sig?: string;
};

// Import only what we need from nostr-tools
import { SimplePool } from "nostr-tools/pool";
import { nip19 } from "nostr-tools";

export const RELAYS: string[] = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://eden.nostr.land",
  "wss://nostr.wine",
  "wss://relayable.org",
  "wss://nostr.fmt.wiz.biz",
  "wss://no.str.cr",
  "wss://nostr.mom",
];

export const pool = new SimplePool();

export const hasNip07 = () => typeof (window as any).nostr !== "undefined";

export const getPublicKey = async (): Promise<string> => {
  const nostr = (window as any).nostr;
  if (!nostr) throw new Error("NIP-07 provider not found. Please install/enable a Nostr extension.");
  return await nostr.getPublicKey();
};

export const npubFromHex = (pubkey: string): string => {
  try {
    return nip19.npubEncode(pubkey);
  } catch (e) {
    return pubkey;
  }
};

export const signEvent = async (event: Omit<NostrEvent, "id" | "sig" | "pubkey">): Promise<NostrEvent> => {
  const nostr = (window as any).nostr;
  if (!nostr?.signEvent) throw new Error("NIP-07 signEvent not available");
  return await nostr.signEvent(event);
};

export const publishEvent = async (event: NostrEvent): Promise<void> => {
  try {
    console.log("[nostr] Publishing event:", { id: event.id, kind: event.kind, tags: event.tags });

    const pubs: any = (pool as any).publish(RELAYS, event as any);

    // Normalize to array of Pub-like objects with .on()
    const pubArray: any[] = Array.isArray(pubs)
      ? pubs
      : pubs && typeof pubs[Symbol.iterator] === 'function'
        ? Array.from(pubs)
        : pubs
        ? [pubs]
        : [];

    // If no pubs returned, nothing we can wait for (fire-and-forget)
    if (pubArray.length === 0) {
      console.warn("[nostr] No Pub objects returned from pool.publish; continuing");
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settledOk = false;
      let failed = 0;
      const total = pubArray.length;
      const timeout = setTimeout(() => {
        if (!settledOk) {
          console.warn("[nostr] Publish timed out waiting for relay ACKs");
          resolve();
        }
      }, 6000);

      const onOk = () => {
        if (!settledOk) {
          settledOk = true;
          clearTimeout(timeout);
          resolve();
        }
      };
      const onFail = () => {
        failed++;
        if (failed >= total && !settledOk) {
          clearTimeout(timeout);
          reject(new Error("All relays failed to accept event"));
        }
      };

      pubArray.forEach((pub, i) => {
        try {
          if (pub && typeof pub.on === 'function') {
            pub.on('ok', onOk);
            pub.on('seen', onOk);
            pub.on('failed', (reason: any) => {
              console.warn(`[nostr] Relay ${i} failed:`, reason);
              onFail();
            });
          } else {
            console.warn(`[nostr] Unexpected pub object at index ${i}`);
            onFail();
          }
        } catch (err) {
          console.warn(`[nostr] Error attaching listeners to pub ${i}:`, err);
          onFail();
        }
      });
    });
  } catch (err) {
    console.error("[nostr] publishEvent error:", err);
    throw err;
  }
};

export const confirmEventSeen = async (id: string, attempts = 5, delayMs = 1000): Promise<boolean> => {
  for (let i = 0; i < attempts; i++) {
    try {
      const events = await (pool as any).list(RELAYS, [{ ids: [id], limit: 1 }] as any);
      if (events && events.length > 0) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
};

export type ParsedPoll = {
  id: string;
  question: string;
  options: string[];
  category?: string;
  authorPubkey: string;
  created_at: number;
};

export const parsePollEvent = (e: any): ParsedPoll | null => {
  if (!e || e.kind !== 30001) return null;
  const options = (e.tags as string[][])
    .filter((t) => t[0] === "option" && t[1])
    .map((t) => t[1]);
  if (options.length < 2) return null;
  const category = (e.tags as string[][]).find((t) => t[0] === "t")?.[1]
    ?? (e.tags as string[][]).find((t) => t[0] === "category")?.[1];
  return {
    id: e.id,
    question: e.content,
    options,
    category,
    authorPubkey: e.pubkey,
    created_at: e.created_at,
  };
};

export const fetchGlobalPolls = async (limit = 50): Promise<ParsedPoll[]> => {
  const events = await (pool as any).list(RELAYS, [{ kinds: [30001], limit }] as any);
  return events
    .map(parsePollEvent)
    .filter(Boolean) as ParsedPoll[];
};

export const fetchPollsByAuthors = async (authors: string[], limit = 50): Promise<ParsedPoll[]> => {
  if (!authors.length) return [];
  const events = await (pool as any).list(RELAYS, [{ kinds: [30001], authors, limit }] as any);
  return events
    .map(parsePollEvent)
    .filter(Boolean) as ParsedPoll[];
};

export const buildPollEvent = (args: { question: string; options: string[]; category?: string }): Omit<NostrEvent, "id" | "sig" | "pubkey"> => {
  const d = `poll-${Math.floor(Date.now() / 1000)}-${Math.random().toString(36).slice(2, 8)}`;
  const tags: string[][] = [["d", d]];
  if (args.category) tags.push(["t", args.category]);
  args.options.forEach((opt) => tags.push(["option", opt]));
  return {
    kind: 30001,
    created_at: Math.floor(Date.now() / 1000),
    content: args.question,
    tags,
  };
};

export const voteOnPoll = async (pollId: string, choiceIndex: number): Promise<void> => {
  const event: Omit<NostrEvent, "id" | "sig" | "pubkey"> = {
    kind: 30002,
    created_at: Math.floor(Date.now() / 1000),
    content: "",
    tags: [["e", pollId], ["k", "poll_vote"], ["choice", String(choiceIndex)]],
  };
  const signed = await signEvent(event);
  await publishEvent(signed);
};

export const fetchVotesForPoll = async (pollId: string): Promise<number[]> => {
  const events = await (pool as any).list(RELAYS, [{ kinds: [30002], '#e': [pollId] }] as any);
  // Aggregate by choice index
  const counts: Record<number, number> = {};
  for (const e of events) {
    const choiceTag = (e.tags as string[][]).find((t) => t[0] === "choice");
    const idx = choiceTag ? parseInt(choiceTag[1], 10) : NaN;
    if (!Number.isNaN(idx)) counts[idx] = (counts[idx] ?? 0) + 1;
  }
  const maxIndex = Math.max(-1, ...Object.keys(counts).map((k) => parseInt(k, 10)));
  return Array.from({ length: maxIndex + 1 }, (_, i) => counts[i] ?? 0);
};

export const fetchFollowingAuthors = async (pubkey: string): Promise<string[]> => {
  const contacts = await (pool as any).list(RELAYS, [{ kinds: [3], authors: [pubkey], limit: 1 }] as any);
  const latest = contacts.sort((a, b) => b.created_at - a.created_at)[0];
  if (!latest) return [];
  const follows = (latest.tags as string[][]).filter((t) => t[0] === "p").map((t) => t[1]);
  return Array.from(new Set(follows));
};

export const fetchNetworkAuthors = async (pubkey: string, maxPerFollow = 50): Promise<string[]> => {
  const follows = await fetchFollowingAuthors(pubkey);
  if (!follows.length) return [];
  const contacts = await (pool as any).list(RELAYS, [{ kinds: [3], authors: follows, limit: 1 }] as any);
  const second = new Set<string>();
  for (const c of contacts) {
    (c.tags as string[][]).forEach((t) => {
      if (t[0] === "p" && t[1]) second.add(t[1]);
    });
  }
  // Combine direct + second-degree
  const combined = new Set<string>([...follows, ...Array.from(second)]);
  return Array.from(combined).slice(0, maxPerFollow);
};

export const timeAgo = (ts: number): string => {
  const s = Math.max(1, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
};
