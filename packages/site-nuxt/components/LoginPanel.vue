<template>
  <section class="login-section">
    <div class="container login-grid">
      <div class="login-copy">
        <span class="overline">Existing customers</span>
        <h2>Manage your Loans by MAL account</h2>
        <p class="lede">
          Existing customers can find account entry, repayment support, and contact routes in the
          same calm Loans by MAL experience.
        </p>
        <ul class="checklist">
          <li>Account and repayment support</li>
          <li>Help if circumstances change</li>
          <li>Clear routes to the customer care team</li>
        </ul>
      </div>

      <div class="login-card" aria-labelledby="login-title">
        <img src="/duck.png" alt="" width="60" height="68" loading="lazy" />
        <h3 id="login-title">Log in to your account</h3>
        <div class="login-form" role="form" aria-describedby="login-note">
          <label>
            <span>Email address</span>
            <input type="email" name="email" autocomplete="email" />
          </label>
          <label>
            <span>Password</span>
            <input type="password" name="password" autocomplete="current-password" />
          </label>
          <button class="btn btn--apply" type="button" aria-disabled="true">Log in</button>
          <button class="text-button" type="button" aria-disabled="true">Forgotten password?</button>
        </div>
        <p id="login-note" class="small">
          Need help with your account? Our customer care team can support you.
        </p>
      </div>
    </div>

    <div class="container support-row" aria-label="Account support links">
      <a v-for="link in supportLinks" :key="link.href" class="support-card" :href="link.href">
        <span>{{ link.label }}</span>
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
const supportLinks = [
  { label: 'Existing customer support', href: '/existing-customers/' },
  { label: 'Contact us', href: '/contact/' },
  { label: 'Complaints', href: '/complaints/' },
];
</script>

<style scoped>
  .login-section {
    background:
      linear-gradient(180deg, rgba(233, 246, 248, 0.78), rgba(250, 247, 241, 0) 34rem),
      var(--sand-50);
    padding-block: clamp(3rem, 7vw, 5.5rem);
  }

  .login-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 430px);
    gap: clamp(2rem, 6vw, 5rem);
    align-items: start;
  }

  .login-copy {
    max-width: 42rem;
  }

  .login-card {
    background: #fff;
    border: 1px solid var(--line-cool);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    padding: clamp(1.4rem, 4vw, 2rem);
  }

  .login-card h3 {
    font-size: clamp(1.55rem, 3vw, 2rem);
    margin-top: 0.55rem;
  }

  .login-form {
    display: grid;
    gap: 1rem;
    margin-top: 1.4rem;
  }

  label {
    display: grid;
    gap: 0.35rem;
    color: var(--ink);
    font-weight: 750;
  }

  label span {
    font-size: 0.96rem;
  }

  input {
    width: 100%;
    min-height: 3rem;
    border: 1px solid #b8cfd5;
    border-radius: 8px;
    background: #fff;
    color: var(--ink);
    font: inherit;
    padding: 0.65rem 0.75rem;
  }

  input:focus {
    border-color: var(--teal-500);
    outline: 3px solid rgba(0, 135, 155, 0.18);
  }

  .login-form .btn {
    width: 100%;
    margin-top: 0.25rem;
  }

  .text-button {
    justify-self: center;
    border: 0;
    background: transparent;
    color: var(--teal-500);
    font: inherit;
    font-weight: 800;
    padding: 0.25rem;
    cursor: default;
  }

  .support-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .support-card {
    display: flex;
    min-height: 5rem;
    align-items: center;
    border: 1px solid var(--line-cool);
    border-radius: var(--radius);
    background: #fff;
    color: var(--ink);
    font-weight: 800;
    text-decoration: none;
    padding: 1.1rem 1.25rem;
    box-shadow: var(--shadow-sm);
  }

  .support-card:hover {
    color: var(--teal-500);
    transform: translateY(-2px);
  }

  @media (max-width: 820px) {
    .login-grid,
    .support-row {
      grid-template-columns: 1fr;
    }
  }
</style>
