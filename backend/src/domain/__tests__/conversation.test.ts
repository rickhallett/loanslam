import { describe, expect, it } from 'vitest';
import { initialConversationState } from '../conversation.js';

describe('initialConversationState', () => {
  it('starts anonymous with no journey and no slot-collection progress', () => {
    const state = initialConversationState();
    expect(state.phase).toBe('anonymous_active');
    expect(state.journey).toBeNull();
    expect(state.slots).toBeNull();
    // Slot *values* keep their single home in `collected` (DD-0001 insurance).
    expect(state.collected).toEqual({});
  });
});
