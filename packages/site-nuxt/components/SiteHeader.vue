<template>
  <header class="site-header">
    <aside class="demo-notice" :aria-label="demoNotice.ariaLabel">
      <div class="container demo-notice__inner">
        <span class="demo-notice__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 3 2.8 20h18.4L12 3Z" />
            <path d="M12 8.2v5.7M12 17.2v.1" />
          </svg>
        </span>
        <strong>{{ demoNotice.label }}</strong>
        <span class="demo-notice__message">{{ demoNotice.body }}</span>
      </div>
    </aside>

    <div class="container bar">
      <a class="brand" href="/">
        <img src="/logo.png" :alt="brand.logoAlt" width="132" height="51" />
      </a>

      <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-hidden="true" />
      <label for="nav-toggle" class="burger" :aria-label="header.menuLabel">
        <span></span><span></span><span></span>
      </label>

      <nav class="nav" :aria-label="header.navigationLabel">
        <ul>
          <template v-for="item in header.items" :key="item.label">
            <li v-if="item.children" class="has-drop">
              <details>
                <summary>{{ item.label }}</summary>
                <ul class="drop">
                  <li v-for="c in item.children" :key="c.href">
                    <a :href="c.href">{{ c.label }}</a>
                  </li>
                </ul>
              </details>
            </li>
            <li v-else>
              <a :href="item.href">{{ item.label }}</a>
            </li>
          </template>
        </ul>
        <div class="actions">
          <a class="btn btn--ghost" :href="loginUrl">{{ header.actions.loginLabel }}</a>
          <a class="btn btn--apply" :href="applyUrl">{{ header.actions.applyLabel }}</a>
        </div>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { siteChrome } from '../lib/site-copy';

const { applyUrl, brand, demoNotice, header, loginUrl } = siteChrome;
</script>

<style scoped>
  .site-header {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }

  .demo-notice {
    background: #fff4d6;
    border-bottom: 2px solid var(--amber-500);
    box-shadow: inset 0 3px 0 var(--amber-400);
    color: var(--ink-950);
    font-size: 0.84rem;
    line-height: 1.4;
  }

  .demo-notice__inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    min-height: 46px;
    padding-block: 0.55rem;
    text-align: center;
  }

  .demo-notice__icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    color: var(--ink-950);
  }

  .demo-notice__icon svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .demo-notice__icon path:first-child {
    fill: var(--amber-400);
    stroke: currentColor;
    stroke-linejoin: round;
    stroke-width: 1.5;
  }

  .demo-notice__icon path:last-child {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-width: 1.8;
  }

  .demo-notice strong {
    flex: none;
    border-radius: 999px;
    background: var(--ink-950);
    color: #fff;
    font-family: var(--font-display);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    line-height: 1;
    padding: 0.42rem 0.58rem;
    text-transform: uppercase;
  }

  .demo-notice__message {
    font-weight: 650;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    min-height: 76px;
  }

  .brand {
    flex: none;
    display: flex;
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    margin-left: auto;
  }

  .nav > ul {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .nav a:not(.btn),
  .nav summary {
    display: block;
    padding: 0.5rem 0.8rem;
    color: var(--ink);
    font-weight: 600;
    font-size: 0.97rem;
    text-decoration: none;
    border-radius: 8px;
    cursor: pointer;
  }

  .nav a:not(.btn):hover,
  .nav summary:hover {
    background: var(--teal-50);
    color: var(--teal-500);
  }

  .has-drop {
    position: relative;
  }

  .has-drop summary {
    list-style: none;
  }

  .has-drop summary::-webkit-details-marker {
    display: none;
  }

  .has-drop summary::after {
    content: ' ▾';
    font-size: 0.7em;
    color: var(--teal-500);
  }

  .drop {
    list-style: none;
    margin: 0;
    padding: 0.4rem;
  }

  .actions {
    display: flex;
    gap: 0.6rem;
  }

  .actions .btn {
    padding: 0.6rem 1.25rem;
    font-size: 0.95rem;
  }

  .nav-toggle,
  .burger {
    display: none;
  }

  @media (min-width: 921px) {
    .drop {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      min-width: 220px;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: var(--shadow-md);
    }
  }

  @media (max-width: 920px) {
    .demo-notice__inner {
      display: grid;
      grid-template-columns: auto 1fr;
      text-align: left;
    }

    .demo-notice__icon {
      grid-row: 1 / span 2;
    }

    .demo-notice strong {
      justify-self: start;
    }

    .burger {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-left: auto;
      padding: 0.6rem;
      cursor: pointer;
    }

    .burger span {
      width: 22px;
      height: 2px;
      background: var(--ink);
      border-radius: 2px;
    }

    .nav {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      flex-direction: column;
      align-items: stretch;
      background: #fff;
      border-bottom: 1px solid var(--line);
      box-shadow: var(--shadow-md);
      padding: 1rem clamp(1.25rem, 4vw, 2rem) 1.5rem;
      margin: 0;
    }

    .nav-toggle:checked ~ .nav {
      display: flex;
    }

    .nav > ul {
      flex-direction: column;
      align-items: stretch;
      gap: 0;
    }

    .actions {
      flex-direction: column;
      margin-top: 1rem;
    }
  }
</style>
