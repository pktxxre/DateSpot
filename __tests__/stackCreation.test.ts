import { scheduleNewStack, consumeNewStack } from '../lib/stackCreation';

describe('stackCreation', () => {
  beforeEach(() => {
    // Drain any pending state from a previous test
    consumeNewStack();
  });

  it('consumeNewStack returns false when nothing scheduled', () => {
    expect(consumeNewStack()).toBe(false);
  });

  it('consumeNewStack returns true after scheduleNewStack', () => {
    scheduleNewStack();
    expect(consumeNewStack()).toBe(true);
  });

  it('consumeNewStack resets to false after consuming', () => {
    scheduleNewStack();
    consumeNewStack();
    expect(consumeNewStack()).toBe(false);
  });
});
