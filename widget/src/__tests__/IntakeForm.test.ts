import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { FormConfig } from '@loanslam/contracts';
import IntakeForm from '../components/IntakeForm.vue';

const form: FormConfig = {
  formId: 'account-handoff',
  title: 'Connect you to our team',
  description: 'Share a few details so an agent can find your account.',
  submitLabel: 'Send to support',
  fields: [
    { name: 'full_name', label: 'Full name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'context', label: 'Anything else?', type: 'textarea', required: false },
  ],
};

describe('IntakeForm', () => {
  it('shows the no-bank-details safety note', () => {
    const wrapper = mount(IntakeForm, { props: { form, loading: false } });
    expect(wrapper.text()).toContain('We never ask for bank or card details here.');
  });

  it('emits the entered values and RETAINS them until the parent resolves submit', async () => {
    const wrapper = mount(IntakeForm, { props: { form, loading: false } });

    const nameInput = wrapper.get('#intake-full_name');
    const emailInput = wrapper.get('#intake-email');
    const contextInput = wrapper.get('#intake-context');

    await nameInput.setValue('Jordan Example');
    await emailInput.setValue('jordan@example.com');
    await contextInput.setValue('Need help with an application.');

    await wrapper.get('form').trigger('submit.prevent');

    const submitted = wrapper.emitted('submit');
    expect(submitted).toBeTruthy();
    expect(submitted?.[0]?.[0]).toEqual({
      full_name: 'Jordan Example',
      email: 'jordan@example.com',
      context: 'Need help with an application.',
    });

    // The form must NOT wipe values on submit. On success the parent unmounts
    // this form (clearing it via v-if); on a backend rejection it stays mounted
    // so the customer keeps their typed details to correct them. Values persist
    // while the component is mounted.
    expect((nameInput.element as HTMLInputElement).value).toBe('Jordan Example');
    expect((emailInput.element as HTMLInputElement).value).toBe('jordan@example.com');
    expect((contextInput.element as HTMLTextAreaElement).value).toBe(
      'Need help with an application.',
    );
  });

  it('blocks submit and shows errors when required fields are empty', async () => {
    const wrapper = mount(IntakeForm, { props: { form, loading: false } });

    await wrapper.get('form').trigger('submit.prevent');

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('Full name is required.');
    expect(wrapper.text()).toContain('Email is required.');
  });
});
