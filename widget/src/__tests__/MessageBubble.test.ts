import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Reply } from '@loanslam/contracts';
import MessageBubble from '../components/MessageBubble.vue';
import type { ChatMessage } from '../state/useChat.js';

function botMessage(reply: Reply): ChatMessage {
  return { id: 'm1', author: 'bot', text: reply.text, reply };
}

describe('MessageBubble', () => {
  it("renders an 'answer' reply's text and its citation question under Sources", () => {
    const reply: Reply = {
      mode: 'answer',
      text: 'You can apply to see what you could borrow.',
      citations: [{ itemId: 'how-much-can-i-borrow', question: 'How much can I borrow?', score: 0.92 }],
      links: [{ label: 'Apply now', href: 'https://example.test/apply' }],
    };
    const wrapper = mount(MessageBubble, { props: { message: botMessage(reply) } });

    expect(wrapper.text()).toContain('You can apply to see what you could borrow.');
    expect(wrapper.text()).toContain('Sources');
    expect(wrapper.text()).toContain('How much can I borrow?');
    const link = wrapper.get('a[href="https://example.test/apply"]');
    expect(link.text()).toBe('Apply now');
  });

  it("renders a 'vulnerability' reply's support links prominently", () => {
    const reply: Reply = {
      mode: 'vulnerability',
      text: 'We understand this is a difficult time. Support is available.',
      links: [
        { label: 'StepChange Debt Charity', href: 'https://www.stepchange.org' },
        { label: 'MoneyHelper', href: 'https://www.moneyhelper.org.uk' },
      ],
      ticketRef: 'tkt_abc123',
    };
    const wrapper = mount(MessageBubble, { props: { message: botMessage(reply) } });

    expect(wrapper.text()).toContain('Support is available.');
    const support = wrapper.get('.bubble__support');
    expect(support.text()).toContain('StepChange Debt Charity');
    expect(support.text()).toContain('MoneyHelper');
    expect(support.find('a[href="https://www.stepchange.org"]').exists()).toBe(true);
    expect(support.find('a[href="https://www.moneyhelper.org.uk"]').exists()).toBe(true);
  });

  it("shows the ticket reference on a 'handoff' reply", () => {
    const reply: Reply = {
      mode: 'handoff',
      text: 'I have passed this to our team.',
      ticketRef: 'tkt_xyz789',
    };
    const wrapper = mount(MessageBubble, { props: { message: botMessage(reply) } });
    expect(wrapper.text()).toContain('tkt_xyz789');
  });

  it('styles a customer message distinctly and shows no Sources line', () => {
    const wrapper = mount(MessageBubble, {
      props: { message: { id: 'c1', author: 'customer', text: 'Hello' } },
    });
    expect(wrapper.get('.bubble').classes()).toContain('bubble--customer');
    expect(wrapper.text()).not.toContain('Sources');
  });
});
