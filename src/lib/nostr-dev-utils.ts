// Development utilities for testing Nostr functionality
import { pool, RELAYS } from './nostr';
import { getWriteRelays, hasNip07, signEvent } from './nostr';

// Test basic connectivity to relays
export const testRelayConnectivity = async (): Promise<void> => {
  console.log("🔧 Testing relay connectivity...");
  
  for (const relay of RELAYS) {
    try {
      const testSub = pool.subscribeMany([relay], [{
        kinds: [1],
        limit: 1
      }], {
        onevent: () => {
          console.log(`✓ ${relay}: Connected and receiving events`);
        },
        oneose: () => {
          console.log(`✓ ${relay}: EOSE received`);
        }
      });
      
      // Close subscription after brief test
      setTimeout(() => testSub.close(), 2000);
    } catch (error) {
      console.error(`✗ ${relay}: Connection failed`, error);
    }
  }
};

// Test NIP-07 extension functionality
export const testNip07 = async (): Promise<void> => {
  console.log("🔧 Testing NIP-07 extension...");
  
  if (!hasNip07()) {
    console.error("✗ NIP-07 extension not detected");
    return;
  }
  
  try {
    const pubkey = await (window as any).nostr?.getPublicKey();
    console.log(`✓ NIP-07 public key: ${pubkey}`);
    
    // Test signing a simple event
    const testEvent = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["test", "dev-utility"]],
      content: "Test event for development purposes"
    };
    
    const signed = await signEvent(testEvent);
    console.log(`✓ NIP-07 signing successful: ${signed.id}`);
    
  } catch (error) {
    console.error("✗ NIP-07 test failed:", error);
  }
};

// Publish a simple test note (kind 1) to verify publishing works
export const publishTestNote = async (): Promise<void> => {
  console.log("🔧 Publishing test note...");
  
  if (!hasNip07()) {
    console.error("✗ NIP-07 extension required for test note");
    return;
  }
  
  try {
    const testNote = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["t", "healthpolls-test"]],
      content: `Test note from HealthPolls dev tools - ${new Date().toISOString()}`
    };
    
    const signed = await signEvent(testNote);
    
    // Use the same publish logic as the main app
    const { publishEvent } = await import('./nostr');
    await publishEvent(signed);
    
    console.log("✓ Test note published successfully:", signed.id);
  } catch (error) {
    console.error("✗ Test note publishing failed:", error);
  }
};

// Run all development tests
export const runDevTests = async (): Promise<void> => {
  console.log("🔧 Running development tests...");
  await testRelayConnectivity();
  await testNip07();
  console.log("🔧 Development tests completed");
};

// Make dev utils available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).nostrDevUtils = {
    testRelayConnectivity,
    testNip07,
    publishTestNote,
    runDevTests
  };
  
  console.log("🔧 Nostr dev utils loaded. Use window.nostrDevUtils in console");
}