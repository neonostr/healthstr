// Nostr utility functions and SimplePool setup

import { SimplePool } from "nostr-tools/pool";
import { nip19, finalizeEvent, getPublicKey } from "nostr-tools";
import type { Event } from "nostr-tools";

export type NostrEvent = Event & {
  kind: number;
  content: string;
  tags: string[][];
};

// Default relays
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

export const getWriteRelays = async (): Promise<string[]> => {
  try {
    const nostr = (window as any).nostr;
    const relaysObj = await nostr?.getRelays?.();
    if (relaysObj && typeof relaysObj === "object") {
      const urls = Object.entries(relaysObj)
        .filter(([, conf]: any) => conf && conf.write === true)
        .map(([url]) => url as string);
      const merged = Array.from(new Set([...(urls as string[]), ...RELAYS]));
      return merged.slice(0, 12);
    }
  } catch {}
  return RELAYS;
};

export const hasNip07 = () => typeof (window as any).nostr !== "undefined";

export const getNip07PublicKey = async (): Promise<string> => {
  const nostr = (window as any).nostr;
  if (!nostr) {
    throw new Error("NIP-07 provider not found. Please install/enable a Nostr extension.");
  }
  return await nostr.getPublicKey();
};

export const npubFromHex = (pubkey: string): string => {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
  }
};

// ---- Signing ----

/**
 * Sign an event using either NIP-07 extension OR a local secret key if provided.
 */
export const signEvent = async (
  event: Omit<NostrEvent, "id" | "sig" | "pubkey">,
  sk?: string
): Promise<NostrEvent> => {
  if (sk) {
    // Local signing
    const pubkey = getPublicKey(sk);
    return finalizeEvent({ ...event, pubkey }, sk) as NostrEvent;
  }

  // NIP-07
  const nostr = (window as any).nostr;
  if (!nostr?.signEvent) throw new Error("NIP-07 signEvent not available");
  const pubkey = await getNip07PublicKey();
  const signed = await nostr.signEvent({ ...event, pubkey });
  return signed as NostrEvent;
};

// ---- Publishing ----

export const publishEvent = async (event: NostrEvent): Promise<void> => {
  try {
    const relays = await getWriteRelays();
    console.log("[nostr] Publishing event:", { id: event.id, kind: event.kind, relays });

    const pub = pool.publish(relays, event);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn("[nostr] Publish timed out (no relay ack within 6s)");
        resolve();
      }, 6000);

      let settled = false;

      const onOk = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          console.log("[nostr] ✅ Event accepted");
          resolve();
        }
      };

      const onFail = (reason: any) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          console.error("[nostr] ❌ All relays failed", reason);
          reject(reason);
        }
      };

      pub.on("ok", onOk);
      pub.on("seen", onOk);
      pub.on("failed", onFail);
    });
  } catch (err) {
    console.error("[nostr] publishEvent error:", err);
    throw err;
  }
};

export const confirmEventSeen = async (id: string, attempts = 5, delayMs = 1000): Promise<boolean> => {
  for (let i = 0; i < attempts; i++) {
    try {
      const events = await pool.list(RELAYS, [{ ids: [id], limit: 1 }]);
      if (events && events.length > 0) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
};

// ---- Poll helpers ----

export type ParsedPoll = {
  id: string;
  question: string;
  options: string[];
  category?: string;
  authorPubkey: string;
  created_at: number;
};

export const parsePollEvent = (e: NostrEvent): ParsedPoll | null => {
  if (!e || e.kind !== 30001) return null;
  const options = (e.tags as string[][])
    .filter((t) => t[0] === "option" && t[1])
    .map((t) => t[1]);
  if (options.length < 2) return null;
  const category =
    (e.tags as string[][]).find((t) => t[0] === "t")?.[1] ??
    (e.tags as string[][]).find((t) => t[0] === "category")?.[1];
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
  const events = await pool.list(RELAYS, [{ kinds: [30001], limit }]);
  return events.map(parsePollEvent).filter(Boolean) as ParsedPoll[];
};

export const fetchPollsByAuthors = async (authors: string[], limit = 50): Promise<ParsedPoll[]> => {
  if (!authors.length) return [];
  const events = await pool.list(RELAYS, [{ kinds: [30001], authors, limit }]);
  return events.map(parsePollEvent).filter(Boolean) as ParsedPoll[];
};

export const buildPollEvent = (args: {
  question: string;
  options: string[];
  category?: string;
}): Omit<NostrEvent, "id" | "sig" | "pubkey"> => {
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

export const voteOnPoll = async (pollId: string, choiceIndex: number, sk?: string): Promise<void> => {
  const event: Omit<NostrEvent, "id" | "sig" | "pubkey"> = {
    kind: 30002,
    created_at: Math.floor(Date.now() / 1000),
    content: "",
    tags: [
      ["e", pollId],
      ["k", "poll_vote"],
      ["choice", String(choiceIndex)],
    ],
  };
  const signed = await signEvent(event, sk);
  await publishEvent(signed);
};

export const fetchVotesForPoll = async (pollId: string): Promise<number[]> => {
  const events = await pool.list(RELAYS, [{ kinds: [30002], "#e": [pollId] }]);
  const counts: Record<number, number> = {};
  for (const e of events) {
    const choiceTag = (e.tags as string[][]).find((t) => t[0] === "choice");
    const idx = choiceTag ? parseInt(choiceTag[1], 10) : NaN;
    if (!Number.isNaN(idx)) counts[idx] = (counts[idx] ?? 0) + 1;
  }
  const maxIndex = Math.max(-1, ...Object.keys(counts).map((k) => parseInt(k, 10)));
  return Array.from({ length: maxIndex + 1 }, (_, i) => counts[i] ?? 0);
};

// ---- Social graph helpers ----

export const fetchFollowingAuthors = async (pubkey: string): Promise<string[]> => {
  const contacts = await pool.list(RELAYS, [{ kinds: [3], authors: [pubkey], limit: 1 }]);
  const latest = contacts.sort((a, b) => b.created_at - a.created_at)[0];
  if (!latest) return [];
  const follows = (latest.tags as string[][]).filter((t) => t[0] === "p").map((t) => t[1]);
  return Array.from(new Set(follows));
};

export const fetchNetworkAuthors = async (pubkey: string, maxPerFollow = 50): Promise<string[]> => {
  const follows = await fetchFollowingAuthors(pubkey);
  if (!follows.length) return [];
  const contacts = await pool.list(RELAYS, [{ kinds: [3], authors: follows, limit: 1 }]);
  const second = new Set<string>();
  for (const c of contacts) {
    (c.tags as string[][]).forEach((t) => {
      if (t[0] === "p" && t[1]) second.add(t[1]);
    });
  }
  const combined = new Set<string>([...follows, ...Array.from(second)]);
  return Array.from(combined).slice(0, maxPerFollow);
};

// ---- Utils ----

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