/**
 * Simple standalone test for StateAwareEvent utility
 */

import { StateAwareEvent } from '../../../utilities/pageUtils';

interface TestEvent {
  message: string;
  timestamp: number;
}

console.log('🧪 Testing StateAwareEvent utility...');

// Test 1: Normal subscription before firing
console.log('\n📋 Test 1: Normal subscription before firing');
const event1 = new StateAwareEvent<TestEvent>();

let normalSubscriptionReceived = false;
event1.event(data => {
  normalSubscriptionReceived = true;
  console.log('  ✓ Normal subscriber received:', data.message);
});

event1.fire({ message: 'First event', timestamp: Date.now() });

if (normalSubscriptionReceived) {
  console.log('  ✅ Test 1 passed');
} else {
  console.error('  ❌ Test 1 failed');
}

// Test 2: Late subscription after firing (the key test!)
console.log('\n📋 Test 2: Late subscription after firing');
const event2 = new StateAwareEvent<TestEvent>();

// Fire first
event2.fire({ message: 'Already fired event', timestamp: Date.now() });

// Then subscribe (should immediately receive the event)
let lateSubscriptionReceived = false;
setTimeout(() => {
  event2.event(data => {
    lateSubscriptionReceived = true;
    console.log('  🎯 Late subscriber received:', data.message);
  });

  // Check result after a brief delay
  setTimeout(() => {
    if (lateSubscriptionReceived) {
      console.log('  ✅ Test 2 passed: Late subscription works!');
    } else {
      console.error('  ❌ Test 2 failed: Late subscription not working');
    }

    // Test 3: Reset functionality
    console.log('\n📋 Test 3: Reset functionality');
    event2.reset();

    if (!event2.hasFired) {
      console.log('  ✅ Test 3 passed: Reset works correctly');
    } else {
      console.error('  ❌ Test 3 failed: Reset not working');
    }

    console.log('\n🎉 StateAwareEvent utility testing complete!');

    // Cleanup
    event1.dispose();
    event2.dispose();
  }, 50);
}, 10);
