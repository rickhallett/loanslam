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

    <div class="container section">
      <section class="contact-intro reveal" aria-labelledby="contact-routes-heading">
        <span class="overline">Choose the right route</span>
        <h2 id="contact-routes-heading">Tell us what you need help with.</h2>
        <p>
          If you are not sure which team you need, open the assistant and it will point you to the
          right contact route.
        </p>
      </section>

      <div class="contact-routes" id="contact-section" aria-label="Contact routes">
        <article
          v-for="(c, i) in contactCopy.channels"
          :key="c.type"
          class="contact-route"
          :data-type="c.type"
        >
          <div class="route-index" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</div>
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
  <!-- The ChatWidget is mounted at layout level (app.vue) so chat state
       survives navigation between /contact/ and /apply/ (D045). -->
</template>

<script setup lang="ts">
// The sm-devtools engine-internals panel ships verbatim (gated behind
// ?devtools=true); the native ChatWidget feeds it the same content-free
// telemetry the iframe widget posted (D043).
import reviewHostDevtools from '../../review-host/public/devtools.js?raw';
import { page } from '../lib/content';
import { contactCopy } from '../lib/site-copy';

// The iframe loader/devtools are replaced by the native ChatWidget on this
// page (D042); the Astro contact page keeps its own iframe machinery.
const contact = page('contact');

useHead({
  title: contact.seo_title ?? contact.title,
  meta: contact.seo_description
    ? [{ name: 'description', content: contact.seo_description }]
    : [],
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
  .contact-intro {
    max-width: 46rem;
    margin-bottom: 2rem;
  }

  .contact-intro h2 {
    margin-bottom: 0.55rem;
  }

  .contact-intro p {
    color: var(--body);
    font-size: 1.08rem;
  }

  .contact-routes {
    display: grid;
    gap: 1rem;
    max-width: 58rem;
  }

  .contact-route {
    position: relative;
    display: grid;
    grid-template-columns: clamp(3.8rem, 8vw, 5.5rem) minmax(0, 1fr);
    gap: clamp(1rem, 3vw, 1.6rem);
    align-items: start;
    min-height: 11rem;
    padding: clamp(1.25rem, 3.5vw, 1.8rem);
    border: 1px solid var(--line-cool);
    border-radius: var(--radius);
    background: #fff;
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
    font-size: clamp(2.4rem, 6vw, 3.7rem);
    line-height: 1;
    color: var(--teal-100);
  }

  .route-kicker {
    margin: 0 0 0.35rem;
    color: var(--teal-500);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .route-title {
    margin-bottom: 0.85rem;
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
    font-size: 0.78rem;
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
    margin-top: 2.25rem;
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

  #contact-section[data-revealed] .contact-route {
    opacity: 0.42;
    filter: grayscale(0.22);
  }

  #contact-section[data-revealed='vulnerability'] .contact-route[data-type='vulnerability'],
  #contact-section[data-revealed='handoff'] .contact-route[data-type='update-settle'],
  #contact-section[data-revealed='general'] .contact-route[data-type='new-loan'] {
    opacity: 1;
    filter: none;
    border-color: rgba(0, 135, 155, 0.48);
    box-shadow: 0 24px 50px -28px rgba(0, 135, 155, 0.7);
    transform: translateY(-2px);
  }

  #contact-section[data-revealed='vulnerability']
    .contact-route[data-type='vulnerability']
    .route-title::before,
  #contact-section[data-revealed='handoff']
    .contact-route[data-type='update-settle']
    .route-title::before,
  #contact-section[data-revealed='general']
    .contact-route[data-type='new-loan']
    .route-title::before {
    content: 'Relevant to your query';
    display: block;
    margin-bottom: 0.28rem;
    color: var(--teal-500);
    font-family: var(--font-body);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  #contact-section[data-revealed='vulnerability']
    .contact-route[data-type='vulnerability']
    .route-index,
  #contact-section[data-revealed='handoff']
    .contact-route[data-type='update-settle']
    .route-index,
  #contact-section[data-revealed='general'] .contact-route[data-type='new-loan'] .route-index {
    color: var(--amber-400);
  }

  #mal-launcher {
    animation: launcher-glow 2.8s ease-in-out infinite;
  }

  @keyframes launcher-glow {
    0%,
    100% {
      box-shadow:
        0 4px 20px rgba(4, 33, 41, 0.26),
        0 0 6px 0 rgba(0, 135, 155, 0.48);
    }

    50% {
      box-shadow:
        0 4px 20px rgba(4, 33, 41, 0.26),
        0 0 22px 7px rgba(0, 135, 155, 0.16);
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
