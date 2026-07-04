<template>
  <div>
    <!-- Hero -->
    <section class="hero">
      <div class="ripples"></div>
      <div class="container hero-grid">
        <div class="hero-copy">
          <span class="overline">{{ homeCopy.hero.overline }}</span>
          <h1 v-html="homeCopy.hero.titleHtml" />
          <p class="lede">{{ homeCopy.hero.body }}</p>
          <div class="hero-ctas">
            <a
              v-for="(cta, index) in homeCopy.hero.ctas"
              :key="cta.href"
              :class="`btn ${index === 0 ? 'btn--apply' : 'btn--ghost-dark'}`"
              :href="cta.href"
            >
              {{ cta.label }}
            </a>
          </div>
          <p class="hero-fineprint">{{ homeCopy.hero.fineprint }}</p>
        </div>

        <!-- Quote card: representative example without JS, sliders with -->
        <div class="quote-card">
          <img class="quote-duck" src="/duck.png" alt="" width="118" height="133" />
          <p class="quote-title">{{ homeCopy.quote.title }}</p>
          <div class="calc" id="calc">
            <label>
              <span class="calc-label">{{ homeCopy.quote.amountLabel }}</span>
              <output id="amt-out">{{ homeCopy.quote.amountDefault }}</output>
              <input type="range" id="amt" min="1000" max="5000" step="100" value="2500" />
              <span class="calc-range"><i>{{ homeCopy.quote.amountMinLabel }}</i><i>{{ homeCopy.quote.amountMaxLabel }}</i></span>
            </label>
            <label>
              <span class="calc-label">{{ homeCopy.quote.termLabel }}</span>
              <output id="term-out">{{ homeCopy.quote.termDefault }}</output>
              <input type="range" id="term" min="9" max="36" step="3" value="24" />
              <span class="calc-range"><i>{{ homeCopy.quote.termMinLabel }}</i><i>{{ homeCopy.quote.termMaxLabel }}</i></span>
            </label>
            <div class="calc-result">
              <div>
                <span class="calc-label">{{ homeCopy.quote.monthlyLabel }}</span>
                <strong id="monthly" class="calc-figure">{{ homeCopy.quote.monthlyDefault }}</strong>
              </div>
              <div>
                <span class="calc-label">{{ homeCopy.quote.totalLabel }}</span>
                <strong id="total" class="calc-figure calc-figure--sub">{{ homeCopy.quote.totalDefault }}</strong>
              </div>
            </div>
            <p class="small">{{ homeCopy.quote.illustrativeNote }}</p>
          </div>
          <a class="btn btn--apply btn-block" :href="homeCopy.quote.cta.href">{{ homeCopy.quote.cta.label }}</a>
          <p class="small rep-example">{{ homeCopy.quote.representativeExample }}</p>
        </div>
      </div>
      <svg class="wave wave--hero" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0,48 C240,88 480,8 720,38 C960,68 1200,18 1440,52 L1440,90 L0,90 Z"
          fill="var(--ink-950)"
        ></path>
      </svg>
    </section>

    <!-- Trust ticker -->
    <aside class="ticker" :aria-label="homeCopy.trustSignalsLabel">
      <div class="ticker-track">
        <div v-for="n in [0, 1]" :key="n" class="ticker-item" :aria-hidden="true">
          <template v-for="(signal, i) in homeCopy.trustSignals" :key="i">
            <a v-if="signal.href" :href="signal.href" v-html="signal.html" />
            <span v-else v-html="signal.html" />
            <span class="ticker-dot">●</span>
          </template>
        </div>
      </div>
    </aside>

    <!-- Why MAL / big stats -->
    <section class="section">
      <div class="container">
        <div class="why-grid reveal">
          <div>
            <span class="overline">{{ homeCopy.why.overline }}</span>
            <h2 v-html="homeCopy.why.titleHtml" />
          </div>
          <div class="why-copy">
            <p v-for="(paragraph, i) in homeCopy.why.paragraphsHtml" :key="i" v-html="paragraph" />
            <a class="btn btn--ghost" :href="homeCopy.why.cta.href">{{ homeCopy.why.cta.label }}</a>
          </div>
        </div>

        <dl class="stats reveal">
          <div v-for="stat in homeCopy.stats" :key="stat.label">
            <dd v-html="stat.valueHtml" />
            <dt>{{ stat.label }}</dt>
          </div>
        </dl>
        <p class="small">{{ homeCopy.statsFootnote }}</p>
      </div>
    </section>

    <!-- Eligibility -->
    <section class="section section--white elig">
      <div class="container">
        <div class="elig-head reveal">
          <span class="overline">{{ homeCopy.eligibility.overline }}</span>
          <h2>{{ homeCopy.eligibility.title }}</h2>
        </div>
        <ol class="elig-list">
          <li v-for="(item, i) in homeCopy.eligibility.items" :key="item.title" class="reveal">
            <span class="ghost-num">{{ String(i + 1).padStart(2, '0') }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.body }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- How it works -->
    <section class="section section--dark steps-section">
      <div class="ripples"></div>
      <div class="container">
        <div class="steps-head reveal">
          <span class="overline">{{ homeCopy.process.overline }}</span>
          <h2>{{ homeCopy.process.title }}</h2>
          <p class="lede">{{ homeCopy.process.lede }}</p>
        </div>
        <ol class="steps">
          <li v-for="(step, i) in homeCopy.process.items" :key="step.title" class="reveal">
            <span class="step-num">{{ i + 1 }}</span>
            <h3>{{ step.title }}</h3>
            <p>{{ step.body }}</p>
          </li>
        </ol>
        <a class="btn btn--apply reveal" :href="homeCopy.process.cta.href">{{ homeCopy.process.cta.label }}</a>
      </div>
    </section>

    <!-- Review -->
    <section class="section review-section">
      <div class="container review reveal">
        <span class="big-quote" aria-hidden="true">“</span>
        <blockquote>{{ homeCopy.review.quote }}</blockquote>
        <div class="tp-row">
          <span class="tp-stars" :aria-label="homeCopy.review.ratingLabel">
            <i></i><i></i><i></i><i></i><i></i>
          </span>
          <a :href="homeCopy.review.link.href">{{ homeCopy.review.link.label }}</a>
        </div>
        <p class="small">{{ homeCopy.review.note }}</p>
      </div>
    </section>

    <!-- Guides / news -->
    <section class="section section--white">
      <div class="container">
        <div class="news-head reveal">
          <div>
            <span class="overline">{{ homeCopy.news.overline }}</span>
            <h2>{{ homeCopy.news.title }}</h2>
          </div>
          <a class="btn btn--ghost" :href="homeCopy.news.allGuides.href">{{ homeCopy.news.allGuides.label }}</a>
        </div>
        <div class="news-grid reveal">
          <a class="news-feature" :href="`/news/${featured.slug}/`">
            <time class="small" :datetime="featured.date ?? undefined">{{ formatDate(featured.date) }}</time>
            <h3>{{ featured.title }}</h3>
            <p>{{ featured.seo_description }}</p>
            <span class="news-more">{{ homeCopy.news.featuredLabel }}</span>
          </a>
          <div class="news-list">
            <a v-for="post in rest.slice(0, 4)" :key="post.slug" :href="`/news/${post.slug}/`">
              <time class="small" :datetime="post.date ?? undefined">{{ formatDate(post.date) }}</time>
              <span class="news-list-title">{{ post.title }}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { formatDate, page, posts } from '../lib/content';
import { homeCopy } from '../lib/site-copy';

const home = page('home');
const [featured, ...rest] = posts;
if (!featured) {
  throw new Error('home page requires at least one news post');
}

useHead({
  title: home.seo_title ?? home.title,
  meta: home.seo_description
    ? [{ name: 'description', content: home.seo_description }]
    : [],
});

onMounted(() => {
  // Progressive enhancement: static representative example without JS;
  // sliders calibrated to it (flat 24.1% p.a. -> £2,500/24mo = £154.38/mo).
  const RATE = 0.241;
  const amt = document.getElementById('amt') as HTMLInputElement;
  const term = document.getElementById('term') as HTMLInputElement;
  const monthly = document.getElementById('monthly')!;
  const total = document.getElementById('total')!;
  const gbp = (n: number) =>
    n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
  const roundPennies = (n: number) => Math.round(n * 100) / 100;

  function paintTrack(input: HTMLInputElement) {
    const pct =
      ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
    input.style.setProperty('--fill', `${pct}%`);
  }

  function update({ pulse = true }: { pulse?: boolean } = {}) {
    const principal = Number(amt.value);
    const months = Number(term.value);
    const totalDue = principal + principal * RATE * (months / 12);
    const monthlyDue = roundPennies(totalDue / months);
    const roundedTotalDue = roundPennies(monthlyDue * months);
    document.getElementById('amt-out')!.textContent = gbp(principal).replace('.00', '');
    document.getElementById('term-out')!.textContent = `${months} months`;
    monthly.textContent = gbp(monthlyDue);
    total.textContent = gbp(roundedTotalDue);
    if (pulse) {
      for (const el of [monthly, total]) {
        el.classList.remove('pulse');
        void el.offsetWidth; // restart animation
        el.classList.add('pulse');
      }
    }
    paintTrack(amt);
    paintTrack(term);
  }

  amt.addEventListener('input', () => update());
  term.addEventListener('input', () => update());
  update({ pulse: false });
});
</script>

<style scoped>
  /* ── Hero ── */
  .hero {
    position: relative;
    background:
      radial-gradient(50rem 26rem at 78% 8%, rgba(0, 135, 155, 0.35), transparent 70%),
      var(--ink-900);
    color: var(--on-dark);
    padding-top: clamp(3rem, 7vw, 5.5rem);
  }

  .hero-grid {
    position: relative;
    display: grid;
    grid-template-columns: 1.12fr 0.88fr;
    gap: clamp(2rem, 5vw, 4.5rem);
    align-items: start;
    padding-bottom: clamp(3.5rem, 7vw, 6rem);
  }

  .hero-copy h1 {
    color: #fff;
  }

  /* NOTE: dead rule, reproduced faithfully. Astro scopes this to
     em[data-astro-cid], which the injected titleHtml <em> never carries, so
     the accent never renders on the Astro site either. Do not "fix" without
     a human parity-deviation decision (D041). */
  .hero-copy h1 em {
    font-style: normal;
    color: var(--teal-300);
    position: relative;
  }

  .hero-copy h1 em::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0.04em;
    height: 0.14em;
    background: var(--amber-400);
    border-radius: 99px;
    opacity: 0.9;
  }

  .hero-copy .lede {
    color: var(--on-dark);
  }

  .hero-ctas {
    display: flex;
    flex-wrap: wrap;
    gap: 0.9rem;
    margin-block: 1.8rem 1.2rem;
  }

  .hero-fineprint {
    font-size: 0.85rem;
    color: var(--on-dark-muted);
  }

  /* ── Quote card ── */
  .quote-card {
    position: relative;
    background: #fff;
    border-radius: var(--radius-lg);
    padding: 2.1rem;
    box-shadow: var(--shadow-md);
    /* clearance so the duck (-106px overhang) never slides under the sticky header */
    margin-top: 3rem;
  }

  .quote-duck {
    position: absolute;
    top: -106px;
    right: 26px;
    filter: drop-shadow(0 10px 14px rgba(4, 33, 41, 0.35));
  }

  .quote-title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.3rem;
    color: var(--ink);
    margin-bottom: 1.3rem;
  }

  .calc label {
    display: block;
    margin-bottom: 1.35rem;
  }

  .calc-label {
    display: block;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .calc output {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.7rem;
    color: var(--ink);
    line-height: 1.2;
  }

  .calc input[type='range'] {
    --fill: 37.5%;
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    height: 8px;
    margin-top: 0.55rem;
    border-radius: 99px;
    background: linear-gradient(
      to right,
      var(--teal-500) var(--fill),
      var(--teal-50) var(--fill)
    );
    outline-offset: 4px;
  }

  .calc input[type='range']::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--amber-400);
    border: 3px solid #fff;
    box-shadow: 0 2px 8px rgba(4, 33, 41, 0.35);
    cursor: grab;
  }

  .calc input[type='range']::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--amber-400);
    border: 3px solid #fff;
    box-shadow: 0 2px 8px rgba(4, 33, 41, 0.35);
    cursor: grab;
  }

  .calc-range {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--muted);
    margin-top: 0.2rem;
  }

  .calc-range i {
    font-style: normal;
  }

  .calc-result {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 1rem;
    background: var(--ink-900);
    border-radius: var(--radius);
    padding: 1.15rem 1.4rem;
    margin-bottom: 0.9rem;
  }

  .calc-result .calc-label {
    color: var(--on-dark-muted);
  }

  .calc-figure {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 2rem;
    color: #fff;
    line-height: 1.15;
  }

  .calc-figure--sub {
    font-size: 1.35rem;
    color: var(--teal-300);
    align-self: end;
  }

  :global(.calc-figure.pulse) {
    animation: pulse 0.35s ease;
  }

  @keyframes pulse {
    40% {
      transform: scale(1.06);
      color: var(--amber-400);
    }
  }

  .btn-block {
    width: 100%;
  }

  .rep-example {
    margin: 1.1rem 0 0;
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .wave--hero {
    margin-bottom: -1px;
  }

  /* ── Why / stats ── */
  .why-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(2rem, 5vw, 4.5rem);
    align-items: start;
    margin-bottom: clamp(2.5rem, 6vw, 4.5rem);
  }

  .why-copy {
    padding-top: 0.6rem;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.4rem;
    margin: 0 0 0.8rem;
    padding-top: 2.2rem;
    border-top: 2px solid var(--line);
  }

  .stats dd {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: clamp(2.6rem, 5vw, 4rem);
    color: var(--teal-500);
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .stat-unit {
    font-size: 0.55em;
  }

  .stats dt {
    margin-top: 0.5rem;
    font-size: 0.92rem;
    color: var(--muted);
    max-width: 13rem;
  }

  /* ── Eligibility ── */
  .elig-head {
    max-width: 34rem;
    margin-bottom: 3rem;
  }

  .elig-list {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: clamp(1.4rem, 3vw, 2.5rem);
    padding: 0;
    margin: 0;
  }

  .elig-list li {
    border-top: 2px solid var(--ink);
    padding-top: 1.1rem;
  }

  .ghost-num {
    display: block;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: clamp(2.8rem, 5vw, 4rem);
    line-height: 1;
    color: var(--teal-100);
    margin-bottom: 0.7rem;
  }

  .elig-list p {
    font-size: 0.95rem;
    margin: 0;
  }

  /* ── Steps ── */
  .steps-section {
    position: relative;
  }

  .steps-head {
    max-width: 36rem;
    margin-bottom: 3.2rem;
  }

  .steps {
    list-style: none;
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: clamp(1.6rem, 4vw, 3rem);
    padding: 0;
    margin: 0 0 2.6rem;
  }

  .steps li {
    position: relative;
  }

  .steps li::before {
    content: '';
    position: absolute;
    top: 1.55rem;
    left: 3.6rem;
    right: -1.5rem;
    border-top: 2px dashed rgba(255, 255, 255, 0.18);
  }

  .steps li:last-child::before {
    display: none;
  }

  .step-num {
    position: relative;
    display: inline-grid;
    place-items: center;
    width: 3.1rem;
    height: 3.1rem;
    border-radius: 50%;
    background: var(--amber-400);
    color: var(--ink-950);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.35rem;
    margin-bottom: 1.1rem;
  }

  .steps p {
    color: var(--on-dark);
    font-size: 0.97rem;
    margin: 0;
  }

  /* ── Review ── */
  .review-section {
    padding-block: clamp(4rem, 9vw, 7rem);
  }

  .review {
    position: relative;
    max-width: 52rem;
    text-align: center;
  }

  .big-quote {
    position: absolute;
    top: -4.5rem;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 11rem;
    line-height: 1;
    color: var(--teal-100);
    pointer-events: none;
  }

  .review blockquote {
    position: relative;
    margin: 0 0 1.6rem;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(1.5rem, 3.2vw, 2.3rem);
    line-height: 1.3;
    color: var(--ink);
    letter-spacing: -0.01em;
  }

  .tp-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.9rem;
    margin-bottom: 0.6rem;
  }

  .tp-stars {
    display: inline-flex;
    gap: 3px;
  }

  .tp-stars i {
    width: 1.5rem;
    height: 1.5rem;
    background: #00b67a;
    display: grid;
    place-items: center;
  }

  .tp-stars i::before {
    content: '★';
    color: #fff;
    font-size: 0.95rem;
    font-style: normal;
  }

  .tp-row a {
    font-weight: 700;
    color: var(--ink);
  }

  /* ── News ── */
  .news-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 2.4rem;
  }

  .news-grid {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: clamp(1.5rem, 4vw, 3rem);
  }

  .news-feature {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    text-decoration: none;
    background: var(--ink-900);
    border-radius: var(--radius-lg);
    padding: clamp(1.6rem, 3.5vw, 2.6rem);
    min-height: 21rem;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }

  .news-feature:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
  }

  .news-feature time {
    color: var(--teal-300);
  }

  .news-feature h3 {
    color: #fff;
    font-size: clamp(1.4rem, 2.4vw, 1.9rem);
    margin: 0.5rem 0 0.6rem;
  }

  .news-feature p {
    color: var(--on-dark);
    font-size: 0.95rem;
    margin-bottom: 1rem;
  }

  .news-more {
    color: var(--amber-400);
    font-weight: 800;
  }

  .news-list {
    display: flex;
    flex-direction: column;
  }

  .news-list a {
    text-decoration: none;
    padding: 1.15rem 0.2rem;
    border-bottom: 1px solid var(--line-cool);
    transition: padding-left 0.18s ease;
  }

  .news-list a:first-child {
    padding-top: 0.3rem;
  }

  .news-list a:hover {
    padding-left: 0.7rem;
  }

  .news-list-title {
    display: block;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.12rem;
    color: var(--ink);
    line-height: 1.3;
  }

  .news-list a:hover .news-list-title {
    color: var(--teal-500);
  }

  /* ── Responsive ── */
  @media (max-width: 980px) {
    .hero-grid,
    .why-grid,
    .news-grid {
      grid-template-columns: 1fr;
    }

    .quote-card {
      margin-top: 7rem;
    }

    .stats,
    .elig-list {
      grid-template-columns: 1fr 1fr;
      row-gap: 2.2rem;
    }

    .steps {
      grid-template-columns: 1fr;
      gap: 1.8rem;
    }

    .steps li::before {
      display: none;
    }
  }

  @media (max-width: 560px) {
    .stats,
    .elig-list {
      grid-template-columns: 1fr;
    }

    .news-head {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
