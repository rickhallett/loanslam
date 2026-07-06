<template>
  <div>
    <div class="page-head">
      <div class="ripples"></div>
      <div class="container" style="position: relative">
        <p class="crumb" v-html="contactCopy.head.crumbHtml" />
        <h1>{{ contactCopy.head.title }}</h1>
        <p>{{ contactCopy.head.body }}</p>
      </div>
    </div>

    <div class="container section contact-section">
      <section class="route-finder reveal" aria-labelledby="route-finder-heading">
        <div class="assistant-first">
          <div class="assistant-first__copy">
            <span class="overline">{{ contactCopy.routeFinder.overline }}</span>
            <h2 id="route-finder-heading">{{ contactCopy.routeFinder.title }}</h2>
            <p>{{ contactCopy.routeFinder.body }}</p>
            <button class="assistant-primary-action" type="button" @click="openRouteFinder()">
              {{ contactCopy.routeFinder.assistant.ctaLabel }}
            </button>
          </div>

          <div class="assistant-console" aria-label="MAL Loans assistant route finder">
            <div class="assistant-console__chrome">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div class="assistant-console__body">
              <p class="assistant-console__kicker">MAL Loans assistant</p>
              <h3>{{ contactCopy.routeFinder.assistant.title }}</h3>
              <p class="assistant-console__message">{{ contactCopy.routeFinder.assistant.body }}</p>
              <div class="assistant-prompts" aria-label="Assistant starting points">
                <button
                  v-for="option in contactCopy.routeFinder.options"
                  :key="option.id"
                  class="assistant-prompt"
                  :data-choice="option.id"
                  type="button"
                  @click="startAssistantChoice(option)"
                >
                  <span>{{ option.eyebrow }}</span>
                  <strong>{{ option.title }}</strong>
                  <small>{{ option.body }}</small>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="contact-intro reveal" aria-labelledby="contact-routes-heading">
        <span class="overline">{{ contactCopy.routeFinder.directContacts.overline }}</span>
        <h2 id="contact-routes-heading">{{ contactCopy.routeFinder.directContacts.title }}</h2>
        <p>{{ contactCopy.routeFinder.directContacts.body }}</p>
      </section>

      <div class="contact-routes" id="contact-section" aria-label="Contact routes">
        <article v-for="(c, i) in contactCopy.channels" :key="c.type" class="contact-route" :data-type="c.type">
          <div class="route-index" aria-hidden="true">
            {{ String(i + 1).padStart(2, '0') }}
          </div>
          <div class="route-body">
            <p class="route-kicker">{{ c.eyebrow }}</p>
            <h3 class="route-title">{{ c.title }}</h3>
            <ul class="channel-list">
              <li>
                <span>{{ contactCopy.channelLabels.phone }}</span>
                <a :href="`tel:${c.phone.replaceAll(' ', '')}`">{{ c.phone }}</a>
              </li>
              <li>
                <span>{{ contactCopy.channelLabels.sms }}</span>
                <a :href="`sms:${c.sms.replaceAll(' ', '')}`">{{ c.sms }}</a>
              </li>
              <li>
                <span>{{ contactCopy.channelLabels.email }}</span>
                <a :href="`mailto:${c.email}`">{{ c.email }}</a>
              </li>
            </ul>
            <p class="small">{{ c.note }}</p>
          </div>
        </article>
      </div>

      <aside class="debt-advice" :aria-label="contactCopy.debtAdvice.title">
        <p class="debt-advice__title">{{ contactCopy.debtAdvice.title }}</p>
        <p v-html="contactCopy.debtAdvice.bodyHtml" />
      </aside>
    </div>
  </div>
  <!-- The chat launcher is mounted at layout level (app.vue); the full
       assistant panel loads only after customer intent (D045). -->
</template>

<script setup lang="ts">
// The sm-devtools engine-internals panel ships verbatim (gated behind
// ?devtools=true); the native ChatWidget feeds it the same content-free
// telemetry the iframe widget posted after the lazy panel is open (D043).
import reviewHostDevtools from '../../review-host/public/devtools.js?raw';
import { page } from '../lib/content';
import { contactCopy, type ContactCopy } from '../lib/site-copy';

// The iframe loader/devtools are replaced by the native lazy chat surface on this
// page (D042); the Astro contact page keeps its own iframe machinery.
const contact = page('contact');
type RouteFinderOption = ContactCopy['routeFinder']['options'][number];
type RouteFinderTopic = Pick<RouteFinderOption, 'eyebrow' | 'title'>;

function openRouteFinder(topic?: RouteFinderTopic): void {
  window.dispatchEvent(new CustomEvent('mal:open-route-finder', { detail: { topic } }));
}

function startAssistantChoice(option: RouteFinderOption): void {
  openRouteFinder({ eyebrow: option.eyebrow, title: option.title });
}

useHead({
  title: contact.seo_title ?? contact.title,
  meta: contact.seo_description ? [{ name: 'description', content: contact.seo_description }] : [],
  link: [
    // Poppins matches the review-widget chrome the iframe version loads.
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap',
    },
  ],
  script: [{ innerHTML: reviewHostDevtools, tagPosition: 'bodyClose' }],
});
</script>

<style>
  .contact-section {
    display: grid;
    gap: clamp(2.4rem, 5vw, 3.8rem);
  }

  .route-finder {
    display: grid;
  }

  .assistant-first {
    display: grid;
    grid-template-columns: minmax(0, 0.82fr) minmax(22rem, 1.18fr);
    gap: clamp(1rem, 3vw, 1.6rem);
    align-items: stretch;
  }

  .assistant-first__copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 31rem;
    padding: clamp(1.45rem, 3.4vw, 2.25rem);
    border-radius: var(--radius);
    background: var(--ink-900);
    color: var(--on-dark);
    box-shadow: var(--shadow-md);
  }

  .assistant-first__copy .overline {
    color: var(--teal-300);
  }

  .assistant-first__copy h2 {
    color: #fff;
    margin-bottom: 0.8rem;
  }

  .assistant-first__copy p {
    max-width: 36rem;
    color: rgba(255, 255, 255, 0.78);
    font-size: 1.08rem;
  }

  .assistant-primary-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: flex-start;
    min-height: 2.9rem;
    margin-top: 1.4rem;
    padding: 0.78rem 1.12rem;
    border: 1px solid var(--amber-400);
    border-radius: 999px;
    background: var(--amber-400);
    color: var(--ink-950);
    font: inherit;
    font-size: 0.95rem;
    font-weight: 800;
    line-height: 1.1;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      transform 0.15s ease;
  }

  .assistant-primary-action:hover {
    border-color: var(--amber-500);
    background: var(--amber-500);
    transform: translateY(-1px);
  }

  .assistant-console {
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--line-cool);
    border-radius: var(--radius);
    background: #fff;
    box-shadow: var(--shadow-md);
  }

  .assistant-console__chrome {
    display: flex;
    gap: 0.42rem;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--line-cool);
    background: #f7fbf9;
  }

  .assistant-console__chrome span {
    width: 0.62rem;
    height: 0.62rem;
    border-radius: 50%;
    background: var(--teal-200);
  }

  .assistant-console__body {
    display: grid;
    gap: 1rem;
    padding: clamp(1.15rem, 2.7vw, 1.65rem);
  }

  .assistant-console__kicker {
    margin: 0;
    color: var(--teal-500);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .assistant-console h3 {
    margin: -0.45rem 0 0;
  }

  .assistant-console__message {
    margin: 0;
    padding: 0.9rem 1rem;
    border: 1px solid #d7e5df;
    border-radius: var(--radius);
    background: #f2f7f4;
    color: var(--ink);
    line-height: 1.55;
  }

  .assistant-prompts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .assistant-prompt {
    display: grid;
    gap: 0.35rem;
    min-height: 7.6rem;
    padding: 0.85rem;
    border: 1px solid var(--line-cool);
    border-radius: var(--radius);
    background: #fff;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.15s ease;
  }

  .assistant-prompt:hover,
  .assistant-prompt:focus-visible {
    border-color: rgba(0, 135, 155, 0.5);
    box-shadow: 0 14px 32px -26px rgba(0, 135, 155, 0.85);
    transform: translateY(-1px);
    outline: none;
  }

  .assistant-prompt span {
    color: var(--teal-500);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .assistant-prompt strong {
    font-family: var(--font-display);
    font-size: 1rem;
    line-height: 1.25;
  }

  .assistant-prompt small {
    color: var(--body);
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .contact-intro {
    max-width: 42rem;
    margin-bottom: -1.8rem;
  }

  .contact-intro h2 {
    margin-bottom: 0.55rem;
  }

  .contact-intro p {
    color: var(--body);
    font-size: 1.02rem;
  }

  .contact-routes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }

  .contact-route {
    position: relative;
    display: grid;
    gap: 0.7rem;
    align-items: start;
    min-height: 0;
    padding: clamp(1rem, 2.4vw, 1.25rem);
    border: 1px solid var(--line-cool);
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.78);
    box-shadow: var(--shadow-sm);
    transition:
      border-color 0.24s ease,
      box-shadow 0.24s ease,
      filter 0.24s ease,
      opacity 0.24s ease,
      transform 0.24s ease;
  }

  .route-index {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1rem;
    line-height: 1;
    color: var(--teal-200);
  }

  .route-kicker {
    margin: 0 0 0.35rem;
    color: var(--teal-500);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .route-title {
    margin-bottom: 0.75rem;
    font-size: 1.05rem;
  }

  .channel-list {
    display: grid;
    gap: 0.25rem;
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
  }

  .channel-list li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.8rem;
    padding-block: 0.42rem;
    border-bottom: 1px solid var(--line-cool);
  }

  .channel-list span {
    flex: none;
    width: 3.2rem;
    font-size: 0.76rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    padding-top: 0.2rem;
  }

  .channel-list a {
    font-family: var(--font-display);
    font-weight: 700;
    text-decoration: none;
    color: var(--ink);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .channel-list a:hover {
    color: var(--teal-500);
  }

  .debt-advice {
    max-width: 58rem;
    margin-top: 0.5rem;
    padding-top: 1.15rem;
    border-top: 1px solid var(--line-cool);
    color: var(--muted);
    font-size: 0.95rem;
  }

  .debt-advice p {
    margin: 0;
  }

  .debt-advice__title {
    color: var(--ink);
    font-weight: 800;
  }

  .debt-advice a {
    color: var(--ink);
    font-weight: 800;
    text-decoration-thickness: 1.5px;
    text-underline-offset: 3px;
  }

  .debt-advice a:hover {
    color: var(--teal-500);
  }

  @media (max-width: 920px) {
    .assistant-first,
    .contact-routes {
      grid-template-columns: 1fr;
    }

    .assistant-first__copy {
      min-height: 0;
    }
  }

  @media (max-width: 640px) {
    .assistant-prompts {
      grid-template-columns: 1fr;
    }

    .assistant-prompt {
      min-height: 0;
    }

    .contact-intro {
      margin-bottom: -1.3rem;
    }
  }

  #sm-devtools {
  --sm-teal: var(--teal-500);
  --sm-amber: var(--amber-500);
  --sm-rose: #cf5168;
  --sm-plum: #8d6fb0;
  --sm-slate: var(--muted);
  --sm-line: var(--line-cool);
  --sm-ink: var(--ink);
  position: fixed;
  left: 24px;
  top: 96px;
  bottom: 24px;
  right: 540px;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
  border: 1px solid var(--line-cool);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  color: var(--sm-ink);
  font-family: var(--font-body);
  overflow: hidden;
  }

  .sm-head {
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--line-cool);
  }

  .sm-eyebrow {
  display: block;
  margin-bottom: 4px;
  color: var(--sm-teal);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  }

  .sm-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  }

  .sm-title-row h2 {
  margin: 0;
  color: var(--ink);
  font-size: 18px;
  font-weight: 800;
  }

  .sm-turn {
  color: var(--sm-slate);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  }

  .sm-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 12px 16px 0;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.3;
  }

  .sm-banner-idle {
  background: var(--teal-50);
  color: var(--sm-slate);
  }

  .sm-banner-aligned {
  background: rgba(0, 135, 155, 0.1);
  color: var(--sm-teal);
  }

  .sm-banner-changed {
  background: rgba(207, 81, 104, 0.1);
  color: var(--sm-rose);
  }

  .sm-banner-tag {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  }

  .sm-banner-flow {
  color: var(--sm-ink);
  font-weight: 800;
  }

  .sm-banner-flow em {
  padding: 0 2px;
  font-style: normal;
  opacity: 0.55;
  }

  .sm-banner-reason {
  color: var(--sm-ink);
  opacity: 0.78;
  }

  .sm-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 0;
  }

  .sm-serving {
  font-size: 12px;
  font-weight: 800;
  }

  .sm-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  }

  .sm-flag {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(207, 81, 104, 0.12);
  color: var(--sm-rose);
  font-size: 11px;
  font-weight: 700;
  }

  .sm-flag-none {
  background: var(--teal-50);
  color: var(--sm-slate);
  }

  .sm-serving.tone-teal {
  color: var(--sm-teal);
  }

  .sm-serving.tone-amber {
  color: var(--sm-amber);
  }

  .sm-serving.tone-plum {
  color: var(--sm-plum);
  }

  .sm-serving.tone-rose {
  color: var(--sm-rose);
  }

  .sm-serving.tone-slate {
  color: var(--sm-slate);
  }

  .sm-body {
  flex: 1;
  min-height: 0;
  padding: 8px 12px 4px;
  }

  .sm-body.sm-flash {
  animation: sm-flash 0.5s ease;
  }

  @keyframes sm-flash {
  from {
  background: rgba(0, 135, 155, 0.06);
  }

  to {
  background: transparent;
  }
  }

  .sm-svg {
  display: block;
  width: 100%;
  height: 100%;
  }

  .sm-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 8px 16px 12px;
  border-top: 1px solid var(--line-cool);
  color: var(--sm-slate);
  font-size: 11px;
  }

  .sm-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 5px;
  border-radius: 3px;
  vertical-align: middle;
  }

  .sm-rect {
  fill: #fff;
  stroke: var(--sm-line);
  stroke-width: 1.5;
  transition:
  stroke 0.25s,
  fill 0.25s;
  }

  .sm-title {
  fill: var(--sm-ink);
  font-size: 14px;
  font-weight: 700;
  text-anchor: middle;
  }

  .sm-sub {
  fill: var(--sm-slate);
  font-size: 11.5px;
  text-anchor: middle;
  }

  .sm-node.sm-idle .sm-rect {
  fill: #fbfdfd;
  stroke: var(--sm-line);
  }

  .sm-node.sm-idle .sm-title {
  fill: #9aabb1;
  }

  .sm-node.sm-idle .sm-sub {
  fill: #b3c1c5;
  }

  .sm-node.sm-active.tone-teal .sm-rect {
  fill: rgba(0, 135, 155, 0.08);
  stroke: var(--sm-teal);
  }

  .sm-node.sm-active.tone-amber .sm-rect {
  fill: rgba(238, 143, 15, 0.1);
  stroke: var(--sm-amber);
  }

  .sm-node.sm-active.tone-rose .sm-rect {
  fill: rgba(207, 81, 104, 0.09);
  stroke: var(--sm-rose);
  }

  .sm-node.sm-active.tone-plum .sm-rect {
  fill: rgba(141, 111, 176, 0.1);
  stroke: var(--sm-plum);
  }

  .sm-node.sm-active.tone-slate .sm-rect {
  fill: rgba(100, 129, 138, 0.07);
  stroke: var(--sm-slate);
  }

  .sm-term .sm-title {
  font-size: 13px;
  }

  .sm-term.sm-active .sm-rect {
  stroke-width: 2;
  }

  .sm-term.sm-active.tone-teal .sm-rect {
  filter: drop-shadow(0 0 6px rgba(0, 135, 155, 0.4));
  }

  .sm-term.sm-active.tone-amber .sm-rect {
  filter: drop-shadow(0 0 6px rgba(238, 143, 15, 0.4));
  }

  .sm-term.sm-active.tone-rose .sm-rect {
  filter: drop-shadow(0 0 6px rgba(207, 81, 104, 0.4));
  }

  .sm-term.sm-active.tone-plum .sm-rect {
  filter: drop-shadow(0 0 6px rgba(141, 111, 176, 0.4));
  }

  .sm-term.sm-active .sm-title {
  fill: var(--sm-ink);
  font-weight: 800;
  }

  .sm-band {
  fill: var(--teal-50);
  stroke: var(--line-cool);
  stroke-width: 1.2;
  }

  .sm-band-label {
  fill: var(--sm-slate);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  }

  .sm-chip {
  fill: #fff;
  stroke: var(--sm-line);
  stroke-width: 1.3;
  transition:
  stroke 0.25s,
  fill 0.25s;
  }

  .sm-chip-label {
  fill: #8194a0;
  font-size: 11.5px;
  font-weight: 700;
  text-anchor: middle;
  }

  .sm-guard.sm-idle .sm-chip {
  fill: #fbfdfd;
  stroke: var(--line-cool);
  }

  .sm-guard.sm-fired .sm-chip-label {
  fill: var(--sm-ink);
  font-weight: 800;
  }

  .sm-guard.sm-fired.tone-rose .sm-chip {
  fill: rgba(207, 81, 104, 0.12);
  stroke: var(--sm-rose);
  animation: sm-pulse 1.1s ease-in-out infinite;
  }

  .sm-guard.sm-fired.tone-amber .sm-chip {
  fill: rgba(238, 143, 15, 0.12);
  stroke: var(--sm-amber);
  animation: sm-pulse 1.1s ease-in-out infinite;
  }

  .sm-guard.sm-fired.tone-plum .sm-chip {
  fill: rgba(141, 111, 176, 0.12);
  stroke: var(--sm-plum);
  animation: sm-pulse 1.1s ease-in-out infinite;
  }

  .sm-guard.sm-fired.tone-slate .sm-chip {
  fill: rgba(100, 129, 138, 0.1);
  stroke: var(--sm-slate);
  }

  .sm-guard.sm-fired.tone-teal .sm-chip {
  fill: rgba(0, 135, 155, 0.1);
  stroke: var(--sm-teal);
  }

  @keyframes sm-pulse {
  0%,
  100% {
  opacity: 1;
  }

  50% {
  opacity: 0.55;
  }
  }

  .sm-edge {
  fill: none;
  stroke: #d7e1e4;
  stroke-width: 1.6;
  transition: stroke 0.25s;
  }

  .sm-edge.sm-idle {
  stroke: #e3ebed;
  }

  .sm-edge.sm-active {
  stroke-width: 2;
  stroke-dasharray: 5 5;
  animation: sm-flow 0.8s linear infinite;
  }

  .sm-edge.sm-active.tone-teal {
  stroke: var(--sm-teal);
  }

  .sm-edge.sm-active.tone-amber {
  stroke: var(--sm-amber);
  }

  .sm-edge.sm-active.tone-rose {
  stroke: var(--sm-rose);
  }

  .sm-edge.sm-active.tone-plum {
  stroke: var(--sm-plum);
  }

  .sm-edge.sm-active.tone-slate {
  stroke: var(--sm-slate);
  }

  @keyframes sm-flow {
  to {
  stroke-dashoffset: -20;
  }
  }

  @media (max-width: 1180px) {
  #sm-devtools {
  right: auto;
  width: min(92vw, 680px);
  }
  }

  @media (max-width: 760px) {
  .contact-route {
  grid-template-columns: 1fr;
  min-height: 0;
  }

  .route-index {
  font-size: 2.4rem;
  }

  #sm-devtools {
  left: 12px;
  right: 12px;
  top: 88px;
  bottom: 12px;
  width: auto;
  }
  }
</style>
