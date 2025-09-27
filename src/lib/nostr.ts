// Nostr utility functions and SimplePool setup

import { SimplePool } from "nostr-tools/pool";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import * as nip19 from "nostr-tools/nip19";

export type NostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
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
    // Local signing with hex-encoded secret key
    const { hexToBytes } = await import("@noble/hashes/utils");
    const skBytes = hexToBytes(sk);
    return finalizeEvent(event as any, skBytes) as unknown as NostrEvent;
  }

  // NIP-07 with enhanced validation
  const nostr = (window as any).nostr;
  if (!nostr?.signEvent) {
    throw new Error("NIP-07 extension not available - please install a Nostr wallet extension");
  }

  try {
    // Get pubkey to validate NIP-07 connection
    const pubkey = await nostr.getPublicKey();
    if (!pubkey) {
      throw new Error("Failed to get public key from NIP-07 extension");
    }

    // Sign the event
    const signedEvent = await nostr.signEvent(event);
    
    // Validate the signed event structure
    if (!signedEvent.id || !signedEvent.sig || !signedEvent.pubkey) {
      throw new Error("Invalid signed event from NIP-07 extension");
    }

    // Verify the pubkey matches
    if (signedEvent.pubkey !== pubkey) {
      throw new Error("Pubkey mismatch in signed event");
    }

    console.log("Successfully signed event:", signedEvent.id);
    return signedEvent as NostrEvent;
  } catch (error) {
    console.error("NIP-07 signing failed:", error);
    throw new Error(`Failed to sign event: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// ---- Publishing ----

export const publishEvent = async (event: NostrEvent): Promise<void> => {
  try {
    const relays = await getWriteRelays();
    console.log(`[nostr] Publishing event ${event.id} (kind ${event.kind}) to ${relays.length} relays:`, relays);

    const publishPromises = relays.map(async (relay) => {
      try {
        const pub = pool.publish([relay], event);

        // Wait for explicit ACKs with timeout
        const ackPromise = new Promise<{ relay: string; success: true }>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error(`Timeout publishing to ${relay}`)), 8000);
          try {
            (pub as any).on?.('ok', () => {
              clearTimeout(timeout);
              resolve({ relay, success: true });
            });
            (pub as any).on?.('failed', (reason: any) => {
              clearTimeout(timeout);
              reject(new Error(typeof reason === 'string' ? reason : 'Publish failed'));
            });
          } catch (e) {
            clearTimeout(timeout);
            reject(e instanceof Error ? e : new Error('Unknown publish error'));
          }
        });

        const result = await ackPromise;
        console.log(`[nostr] ✓ Successfully published to ${relay}`);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[nostr] ✗ Failed to publish to ${relay}:`, errorMsg);
        return { relay, success: false as const, error: errorMsg } as any;
      }
    });

    const results = await Promise.allSettled(publishPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    if (successful === 0) {
      const failureReasons = results
        .filter(r => r.status === 'fulfilled' && !r.value.success)
        .map(r => r.status === 'fulfilled' ? r.value.error : 'Unknown error')
        .slice(0, 3); // Show up to 3 specific errors
      
      console.error("[nostr] All relays failed. Reasons:", failureReasons);
      throw new Error(`All ${relays.length} relays failed. Examples: ${failureReasons.join(', ')}`);
    }

    console.log(`[nostr] ✅ Event published: ${successful}/${relays.length} relays succeeded`);
    if (failed > 0) {
      console.warn(`[nostr] ${failed} relays failed, but event was published successfully`);
    }
  } catch (err) {
    console.error("[nostr] ❌ Publishing failed:", err);
    throw err;
  }
};

export const confirmEventSeen = async (id: string, attempts = 5, delayMs = 1000): Promise<boolean> => {
  for (let i = 0; i < attempts; i++) {
    try {
      const evt = await pool.get(RELAYS, { ids: [id], limit: 1 } as any);
      if (evt) return true;
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
  // Support both standard kind 6969 and legacy kind 30001
  if (!e || (e.kind !== 6969 && e.kind !== 30001)) return null;
  
  // Parse options - support both new and legacy formats
  let options: string[] = [];
  if (e.kind === 6969) {
    // Standard format: ["poll_option", "0", "Option text"]
    options = (e.tags as string[][])
      .filter((t) => t[0] === "poll_option" && t[1] && t[2])
      .sort((a, b) => parseInt(a[1]) - parseInt(b[1]))
      .map((t) => t[2]);
  } else {
    // Legacy format: ["option", "Option text"]
    options = (e.tags as string[][])
      .filter((t) => t[0] === "option" && t[1])
      .map((t) => t[1]);
  }
  
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
  console.log("[nostr] Fetching global polls...");
  // Query both standard (6969) and legacy (30001) poll kinds for compatibility
  const events = await pool.querySync(RELAYS, { kinds: [6969, 30001], limit } as any);
  console.log(`[nostr] Found ${events.length} poll events`);
  return (events as any[]).map(parsePollEvent).filter(Boolean) as ParsedPoll[];
};

export const fetchPollsByAuthors = async (authors: string[], limit = 50): Promise<ParsedPoll[]> => {
  if (!authors.length) return [];
  // Query both standard (6969) and legacy (30001) poll kinds for compatibility
  const events = await pool.querySync(RELAYS, { kinds: [6969, 30001], authors, limit } as any);
  return (events as any[]).map(parsePollEvent).filter(Boolean) as ParsedPoll[];
};

export const buildPollEvent = (args: {
  question: string;
  options: string[];
  category?: string;
}): Omit<NostrEvent, "id" | "sig" | "pubkey"> => {
  const tags: string[][] = [
    ["t", "healthpoll"], // Health poll tag
    ["poll_question", args.question]
  ];
  
  // Add poll options in standard format: ["poll_option", "index", "text"]
  args.options.forEach((opt, i) => tags.push(["poll_option", i.toString(), opt]));
  
  if (args.category) {
    tags.push(["category", args.category]);
  }

  return {
    kind: 6969, // Standard Nostr poll event kind
    created_at: Math.floor(Date.now() / 1000),
    content: args.question,
    tags,
  };
};

export const voteOnPoll = async (pollId: string, choiceIndex: number, sk?: string): Promise<void> => {
  const event: Omit<NostrEvent, "id" | "sig" | "pubkey"> = {
    kind: 7, // Standard reaction/response event kind
    created_at: Math.floor(Date.now() / 1000),
    content: choiceIndex.toString(), // Include choice in content for compatibility
    tags: [
      ["e", pollId], // Reference to the poll event
      ["poll_response", choiceIndex.toString()], // Vote choice
    ],
  };
  const signed = await signEvent(event, sk);
  await publishEvent(signed);
};

export const fetchVotesForPoll = async (pollId: string): Promise<number[]> => {
  // Query both standard (7) and legacy (30002) vote kinds for compatibility
  const events = await pool.querySync(RELAYS, { kinds: [7, 30002], "#e": [pollId] } as any);
  const counts: Record<number, number> = {};
  
  for (const e of events as any[]) {
    let idx: number = NaN;
    
    // Check for standard poll_response tag (kind 7)
    const responseTag = (e.tags as string[][]).find((t) => t[0] === "poll_response");
    if (responseTag && responseTag[1]) {
      idx = parseInt(responseTag[1], 10);
    }
    // Fall back to legacy choice tag (kind 30002)
    else {
      const choiceTag = (e.tags as string[][]).find((t) => t[0] === "choice");
      if (choiceTag && choiceTag[1]) {
        idx = parseInt(choiceTag[1], 10);
      }
      // Also check content as fallback for compatibility
      else if (e.content && !isNaN(parseInt(e.content))) {
        idx = parseInt(e.content, 10);
      }
    }
    
    if (!Number.isNaN(idx)) {
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
  }
  
  const maxIndex = Math.max(-1, ...Object.keys(counts).map((k) => parseInt(k, 10)));
  return Array.from({ length: maxIndex + 1 }, (_, i) => counts[i] ?? 0);
};

// ---- Social graph helpers ----

export const fetchFollowingAuthors = async (pubkey: string): Promise<string[]> => {
  const contacts = await pool.querySync(RELAYS, { kinds: [3], authors: [pubkey], limit: 1 } as any);
  const latest = (contacts as any[]).sort((a, b) => b.created_at - a.created_at)[0];
  if (!latest) return [];
  const follows = (latest.tags as string[][]).filter((t) => t[0] === "p").map((t) => t[1]);
  return Array.from(new Set(follows));
};

export const fetchNetworkAuthors = async (pubkey: string, maxPerFollow = 50): Promise<string[]> => {
  const follows = await fetchFollowingAuthors(pubkey);
  if (!follows.length) return [];
  const contacts = await pool.querySync(RELAYS, { kinds: [3], authors: follows, limit: 1 } as any);
  const second = new Set<string>();
  for (const c of contacts as any[]) {
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