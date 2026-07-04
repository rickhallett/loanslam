import applicationJourneyRaw from '../../../site/src/data/site-copy/application-journey.json';
import applyRaw from '../../../site/src/data/site-copy/apply.json';
import chromeRaw from '../../../site/src/data/site-copy/chrome.json';
import contactRaw from '../../../site/src/data/site-copy/contact.json';
import faqPageRaw from '../../../site/src/data/site-copy/faq-page.json';
import homeRaw from '../../../site/src/data/site-copy/home.json';
import instalmentLoanRaw from '../../../site/src/data/site-copy/instalment-loan.json';
import newsRaw from '../../../site/src/data/site-copy/news.json';
import notFoundRaw from '../../../site/src/data/site-copy/not-found.json';

type UnknownRecord = Record<string, unknown>;

export interface LinkItem {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href?: string;
  children?: LinkItem[];
}

export interface Cta extends LinkItem {}

export interface TextCard {
  title: string;
  body: string;
}

export interface PageHead {
  crumbHtml: string;
  title: string;
  body?: string;
  bodyHtml?: string;
}

export interface SideCta {
  title: string;
  body: string;
  cta: Cta;
}

export interface SiteChromeCopy {
  applyUrl: string;
  loginUrl: string;
  brand: {
    logoAlt: string;
    footerName: string;
    tagline: string;
  };
  accessibility: {
    skipLinkLabel: string;
  };
  header: {
    menuLabel: string;
    navigationLabel: string;
    items: NavItem[];
    actions: {
      loginLabel: string;
      applyLabel: string;
    };
  };
  footer: {
    columns: { heading: string; links: LinkItem[] }[];
    legalParagraphsHtml: string[];
    copyright: string;
    policyLinks: LinkItem[];
    watermark: string;
  };
}

export interface HomeCopy {
  hero: {
    overline: string;
    titleHtml: string;
    body: string;
    ctas: Cta[];
    fineprint: string;
  };
  quote: {
    title: string;
    amountLabel: string;
    amountDefault: string;
    amountMinLabel: string;
    amountMaxLabel: string;
    termLabel: string;
    termDefault: string;
    termMinLabel: string;
    termMaxLabel: string;
    monthlyLabel: string;
    monthlyDefault: string;
    totalLabel: string;
    totalDefault: string;
    illustrativeNote: string;
    cta: Cta;
    representativeExample: string;
  };
  trustSignals: { html: string; href?: string }[];
  trustSignalsLabel: string;
  why: {
    overline: string;
    titleHtml: string;
    paragraphsHtml: string[];
    cta: Cta;
  };
  stats: { valueHtml: string; label: string }[];
  statsFootnote: string;
  eligibility: {
    overline: string;
    title: string;
    items: TextCard[];
  };
  process: {
    overline: string;
    title: string;
    lede: string;
    items: TextCard[];
    cta: Cta;
  };
  review: {
    quote: string;
    ratingLabel: string;
    link: LinkItem;
    note: string;
  };
  news: {
    overline: string;
    title: string;
    allGuides: Cta;
    featuredLabel: string;
  };
}

export interface ContactCopy {
  head: PageHead;
  routeFinder: {
    overline: string;
    title: string;
    body: string;
    assistant: {
      title: string;
      body: string;
      ctaLabel: string;
      prompt: string;
    };
    options: {
      id: string;
      eyebrow: string;
      title: string;
      body: string;
      actionLabel: string;
      prompt: string;
      href?: string;
      reveal?: string;
      opensAssistant: boolean;
    }[];
    directContacts: {
      overline: string;
      title: string;
      body: string;
    };
  };
  channels: {
    type: string;
    eyebrow: string;
    title: string;
    phone: string;
    sms: string;
    email: string;
    note: string;
  }[];
  channelLabels: {
    phone: string;
    sms: string;
    email: string;
  };
  debtAdvice: {
    title: string;
    bodyHtml: string;
  };
}

export interface FaqPageCopy {
  head: PageHead;
  groups: { number: string; title: string }[];
  sideCta: SideCta;
}

export interface InstalmentLoanCopy {
  applyUrl: string;
  head: PageHead;
  cards: TextCard[];
  applyBand: {
    title: string;
    steps: string[];
    cta: Cta;
  };
  faqTitle: string;
  faqLinkHtml: string;
  noticeHtml: string;
}

export interface NewsCopy {
  index: {
    title: string;
    description: string;
    head: PageHead;
    featuredLabel: string;
    cardLabel: string;
  };
  article: {
    backLabel: string;
    readTimeSuffix: string;
    sideCta: SideCta;
  };
  genericPage: {
    tocLabel: string;
    sideCta: SideCta;
  };
}

export interface NotFoundCopy {
  title: string;
  head: PageHead;
}

export interface ApplyCopy {
  title: string;
  description: string;
  head: {
    crumbHtml: string;
    body: string;
    signals: string[];
  };
}

export interface ApplicationJourneyCopy {
  trustStrip: string;
  homeAriaLabel: string;
  logoAlt: string;
  progressAriaLabel: string;
  applicantNameFallback: string;
  steps: { id: string; label: string }[];
  details: {
    title: string;
    body: string;
    bullets: string[];
    incomeHelpHtml: string;
    partTimeWarning: string;
    retiredWarning: string;
    dobHelp: string;
    mobileHelp: string;
    postcodeHelp: string;
    acceptTermsHtml: string;
    smsMarketing: string;
  };
  borrow: {
    titleBeforeAmount: string;
    titleAfterAmount: string;
    body: string;
    repaymentDateLabel: string;
    firstRepaymentDate: string;
    firstPaymentExample: string;
    firstRepaymentTemplate: string;
    futurePaymentsTemplate: string;
  };
  offer: {
    title: string;
    bodyHtml: string;
    rows: string[];
    changeTerm: string;
    continueNote: string;
  };
  sign: {
    title: string;
    body: string;
    documents: { key: string; title: string }[];
    done: string;
    required: string;
    signatureLabel: string;
    accept: string;
  };
  bank: {
    title: string;
    bullets: string[];
    authorisationTitle: string;
    repaymentDateHtml: string;
    accountHolderConfirmed: string;
    multiAuthoriser: string;
    directDebitTitle: string;
    directDebitRows: { label: string; value: string }[];
    directDebitBody: string;
    guaranteeTitle: string;
    guaranteeBullets: string[];
    gocardlessHtml: string;
  };
  affordability: {
    title: string;
    noticeTitle: string;
    noticeBullets: string[];
    monthlyIncomeHelp: string;
    lowContributionPlaceholder: string;
    transportLegend: string;
    transportOptions: string[];
    acceptTerms: string;
  };
  card: {
    title: string;
    body: string;
    bullets: string[];
    paymentTitle: string;
    help: string;
    skip: string;
  };
  openBanking: {
    title: string;
    body: string;
    bullets: string[];
    bodyHtml: string;
    trustedHtml: string;
    bankGrid: string[];
  };
  verify: {
    title: string;
    body: string;
    button: string;
    help: string;
    finalChecks: string;
    bullets: string[];
  };
  footer: {
    reviews: string;
    legalHtml: string;
    navigationLabel: string;
    links: LinkItem[];
    version: string;
  };
  addressModal: {
    title: string;
    closeLabel: string;
    placeholder: string;
    options: string[];
    selectedAddress: {
      postcode: string;
      line1: string;
      city: string;
    };
    manual: string;
    select: string;
  };
  actions: {
    back: string;
    continue: string;
  };
  fields: Record<string, string>;
  placeholders: Record<string, string>;
  buttons: Record<string, string>;
  employmentStatuses: string[];
  employmentStatusRules: Record<string, string>;
  loanPurposeOptions: string[];
  lowContributionReasons: Record<string, string[]>;
  validation: Record<string, string>;
}

function objectAt(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid site copy at ${path}: expected object`);
  }
  return value as UnknownRecord;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid site copy at ${path}: expected non-empty string`);
  }
  return value;
}

function optionalStringAt(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  return stringAt(value, path);
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid site copy at ${path}: expected non-empty array`);
  }
  return value;
}

function stringArrayAt(value: unknown, path: string): string[] {
  return arrayAt(value, path).map((item, index) => stringAt(item, `${path}[${index}]`));
}

function stringRecordAt(value: unknown, path: string): Record<string, string> {
  const record = objectAt(value, path);
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, stringAt(item, `${path}.${key}`)]),
  );
}

function stringArrayRecordAt(value: unknown, path: string): Record<string, string[]> {
  const record = objectAt(value, path);
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, stringArrayAt(item, `${path}.${key}`)]),
  );
}

function hrefAt(value: unknown, path: string): string {
  const href = stringAt(value, path);
  if (!/^(\/|https?:\/\/|mailto:|tel:)/.test(href)) {
    throw new Error(`Invalid site copy at ${path}: expected local path or absolute URL`);
  }
  return href;
}

function linkAt(value: unknown, path: string): LinkItem {
  const item = objectAt(value, path);
  return {
    label: stringAt(item.label, `${path}.label`),
    href: hrefAt(item.href, `${path}.href`),
  };
}

function ctaAt(value: unknown, path: string): Cta {
  return linkAt(value, path);
}

function linkArrayAt(value: unknown, path: string): LinkItem[] {
  return arrayAt(value, path).map((item, index) => linkAt(item, `${path}[${index}]`));
}

function textCardAt(value: unknown, path: string): TextCard {
  const item = objectAt(value, path);
  return {
    title: stringAt(item.title, `${path}.title`),
    body: stringAt(item.body, `${path}.body`),
  };
}

function textCardsAt(value: unknown, path: string): TextCard[] {
  return arrayAt(value, path).map((item, index) => textCardAt(item, `${path}[${index}]`));
}

function pageHeadAt(value: unknown, path: string): PageHead {
  const item = objectAt(value, path);
  const body = optionalStringAt(item.body, `${path}.body`);
  const bodyHtml = optionalStringAt(item.bodyHtml, `${path}.bodyHtml`);
  if (!body && !bodyHtml) {
    throw new Error(`Invalid site copy at ${path}: expected body or bodyHtml`);
  }
  return {
    crumbHtml: stringAt(item.crumbHtml, `${path}.crumbHtml`),
    title: stringAt(item.title, `${path}.title`),
    body,
    bodyHtml,
  };
}

function sideCtaAt(value: unknown, path: string): SideCta {
  const item = objectAt(value, path);
  return {
    title: stringAt(item.title, `${path}.title`),
    body: stringAt(item.body, `${path}.body`),
    cta: ctaAt(item.cta, `${path}.cta`),
  };
}

function validateChrome(raw: unknown): SiteChromeCopy {
  const root = objectAt(raw, 'chrome');
  const brand = objectAt(root.brand, 'chrome.brand');
  const accessibility = objectAt(root.accessibility, 'chrome.accessibility');
  const header = objectAt(root.header, 'chrome.header');
  const headerActions = objectAt(header.actions, 'chrome.header.actions');
  const footer = objectAt(root.footer, 'chrome.footer');
  return {
    applyUrl: hrefAt(root.applyUrl, 'chrome.applyUrl'),
    loginUrl: hrefAt(root.loginUrl, 'chrome.loginUrl'),
    brand: {
      logoAlt: stringAt(brand.logoAlt, 'chrome.brand.logoAlt'),
      footerName: stringAt(brand.footerName, 'chrome.brand.footerName'),
      tagline: stringAt(brand.tagline, 'chrome.brand.tagline'),
    },
    accessibility: {
      skipLinkLabel: stringAt(accessibility.skipLinkLabel, 'chrome.accessibility.skipLinkLabel'),
    },
    header: {
      menuLabel: stringAt(header.menuLabel, 'chrome.header.menuLabel'),
      navigationLabel: stringAt(header.navigationLabel, 'chrome.header.navigationLabel'),
      items: arrayAt(header.items, 'chrome.header.items').map((item, index) => {
        const nav = objectAt(item, `chrome.header.items[${index}]`);
        const children = nav.children
          ? linkArrayAt(nav.children, `chrome.header.items[${index}].children`)
          : undefined;
        const href = nav.href ? hrefAt(nav.href, `chrome.header.items[${index}].href`) : undefined;
        if (!href && !children) {
          throw new Error(`Invalid site copy at chrome.header.items[${index}]: expected href or children`);
        }
        return {
          label: stringAt(nav.label, `chrome.header.items[${index}].label`),
          href,
          children,
        };
      }),
      actions: {
        loginLabel: stringAt(headerActions.loginLabel, 'chrome.header.actions.loginLabel'),
        applyLabel: stringAt(headerActions.applyLabel, 'chrome.header.actions.applyLabel'),
      },
    },
    footer: {
      columns: arrayAt(footer.columns, 'chrome.footer.columns').map((item, index) => {
        const column = objectAt(item, `chrome.footer.columns[${index}]`);
        return {
          heading: stringAt(column.heading, `chrome.footer.columns[${index}].heading`),
          links: linkArrayAt(column.links, `chrome.footer.columns[${index}].links`),
        };
      }),
      legalParagraphsHtml: stringArrayAt(footer.legalParagraphsHtml, 'chrome.footer.legalParagraphsHtml'),
      copyright: stringAt(footer.copyright, 'chrome.footer.copyright'),
      policyLinks: linkArrayAt(footer.policyLinks, 'chrome.footer.policyLinks'),
      watermark: stringAt(footer.watermark, 'chrome.footer.watermark'),
    },
  };
}

function validateHome(raw: unknown): HomeCopy {
  const root = objectAt(raw, 'home');
  const hero = objectAt(root.hero, 'home.hero');
  const quote = objectAt(root.quote, 'home.quote');
  const why = objectAt(root.why, 'home.why');
  const eligibility = objectAt(root.eligibility, 'home.eligibility');
  const processCopy = objectAt(root.process, 'home.process');
  const review = objectAt(root.review, 'home.review');
  const news = objectAt(root.news, 'home.news');
  return {
    hero: {
      overline: stringAt(hero.overline, 'home.hero.overline'),
      titleHtml: stringAt(hero.titleHtml, 'home.hero.titleHtml'),
      body: stringAt(hero.body, 'home.hero.body'),
      ctas: arrayAt(hero.ctas, 'home.hero.ctas').map((item, index) => ctaAt(item, `home.hero.ctas[${index}]`)),
      fineprint: stringAt(hero.fineprint, 'home.hero.fineprint'),
    },
    quote: {
      title: stringAt(quote.title, 'home.quote.title'),
      amountLabel: stringAt(quote.amountLabel, 'home.quote.amountLabel'),
      amountDefault: stringAt(quote.amountDefault, 'home.quote.amountDefault'),
      amountMinLabel: stringAt(quote.amountMinLabel, 'home.quote.amountMinLabel'),
      amountMaxLabel: stringAt(quote.amountMaxLabel, 'home.quote.amountMaxLabel'),
      termLabel: stringAt(quote.termLabel, 'home.quote.termLabel'),
      termDefault: stringAt(quote.termDefault, 'home.quote.termDefault'),
      termMinLabel: stringAt(quote.termMinLabel, 'home.quote.termMinLabel'),
      termMaxLabel: stringAt(quote.termMaxLabel, 'home.quote.termMaxLabel'),
      monthlyLabel: stringAt(quote.monthlyLabel, 'home.quote.monthlyLabel'),
      monthlyDefault: stringAt(quote.monthlyDefault, 'home.quote.monthlyDefault'),
      totalLabel: stringAt(quote.totalLabel, 'home.quote.totalLabel'),
      totalDefault: stringAt(quote.totalDefault, 'home.quote.totalDefault'),
      illustrativeNote: stringAt(quote.illustrativeNote, 'home.quote.illustrativeNote'),
      cta: ctaAt(quote.cta, 'home.quote.cta'),
      representativeExample: stringAt(quote.representativeExample, 'home.quote.representativeExample'),
    },
    trustSignals: arrayAt(root.trustSignals, 'home.trustSignals').map((item, index) => {
      const signal = objectAt(item, `home.trustSignals[${index}]`);
      return {
        html: stringAt(signal.html, `home.trustSignals[${index}].html`),
        href: signal.href ? hrefAt(signal.href, `home.trustSignals[${index}].href`) : undefined,
      };
    }),
    trustSignalsLabel: stringAt(root.trustSignalsLabel, 'home.trustSignalsLabel'),
    why: {
      overline: stringAt(why.overline, 'home.why.overline'),
      titleHtml: stringAt(why.titleHtml, 'home.why.titleHtml'),
      paragraphsHtml: stringArrayAt(why.paragraphsHtml, 'home.why.paragraphsHtml'),
      cta: ctaAt(why.cta, 'home.why.cta'),
    },
    stats: arrayAt(root.stats, 'home.stats').map((item, index) => {
      const stat = objectAt(item, `home.stats[${index}]`);
      return {
        valueHtml: stringAt(stat.valueHtml, `home.stats[${index}].valueHtml`),
        label: stringAt(stat.label, `home.stats[${index}].label`),
      };
    }),
    statsFootnote: stringAt(root.statsFootnote, 'home.statsFootnote'),
    eligibility: {
      overline: stringAt(eligibility.overline, 'home.eligibility.overline'),
      title: stringAt(eligibility.title, 'home.eligibility.title'),
      items: textCardsAt(eligibility.items, 'home.eligibility.items'),
    },
    process: {
      overline: stringAt(processCopy.overline, 'home.process.overline'),
      title: stringAt(processCopy.title, 'home.process.title'),
      lede: stringAt(processCopy.lede, 'home.process.lede'),
      items: textCardsAt(processCopy.items, 'home.process.items'),
      cta: ctaAt(processCopy.cta, 'home.process.cta'),
    },
    review: {
      quote: stringAt(review.quote, 'home.review.quote'),
      ratingLabel: stringAt(review.ratingLabel, 'home.review.ratingLabel'),
      link: linkAt(review.link, 'home.review.link'),
      note: stringAt(review.note, 'home.review.note'),
    },
    news: {
      overline: stringAt(news.overline, 'home.news.overline'),
      title: stringAt(news.title, 'home.news.title'),
      allGuides: ctaAt(news.allGuides, 'home.news.allGuides'),
      featuredLabel: stringAt(news.featuredLabel, 'home.news.featuredLabel'),
    },
  };
}

function validateContact(raw: unknown): ContactCopy {
  const root = objectAt(raw, 'contact');
  const routeFinder = objectAt(root.routeFinder, 'contact.routeFinder');
  const routeFinderAssistant = objectAt(routeFinder.assistant, 'contact.routeFinder.assistant');
  const directContacts = objectAt(routeFinder.directContacts, 'contact.routeFinder.directContacts');
  const channelLabels = objectAt(root.channelLabels, 'contact.channelLabels');
  const debtAdvice = objectAt(root.debtAdvice, 'contact.debtAdvice');
  return {
    head: pageHeadAt(root.head, 'contact.head'),
    routeFinder: {
      overline: stringAt(routeFinder.overline, 'contact.routeFinder.overline'),
      title: stringAt(routeFinder.title, 'contact.routeFinder.title'),
      body: stringAt(routeFinder.body, 'contact.routeFinder.body'),
      assistant: {
        title: stringAt(routeFinderAssistant.title, 'contact.routeFinder.assistant.title'),
        body: stringAt(routeFinderAssistant.body, 'contact.routeFinder.assistant.body'),
        ctaLabel: stringAt(routeFinderAssistant.ctaLabel, 'contact.routeFinder.assistant.ctaLabel'),
        prompt: stringAt(routeFinderAssistant.prompt, 'contact.routeFinder.assistant.prompt'),
      },
      options: arrayAt(routeFinder.options, 'contact.routeFinder.options').map((item, index) => {
        const option = objectAt(item, `contact.routeFinder.options[${index}]`);
        const href = option.href ? hrefAt(option.href, `contact.routeFinder.options[${index}].href`) : undefined;
        const reveal = option.reveal ? stringAt(option.reveal, `contact.routeFinder.options[${index}].reveal`) : undefined;
        const opensAssistant = option.opensAssistant === true;
        if (!href && !reveal && !opensAssistant) {
          throw new Error(`Invalid site copy at contact.routeFinder.options[${index}]: expected href, reveal, or opensAssistant`);
        }
        return {
          id: stringAt(option.id, `contact.routeFinder.options[${index}].id`),
          eyebrow: stringAt(option.eyebrow, `contact.routeFinder.options[${index}].eyebrow`),
          title: stringAt(option.title, `contact.routeFinder.options[${index}].title`),
          body: stringAt(option.body, `contact.routeFinder.options[${index}].body`),
          actionLabel: stringAt(option.actionLabel, `contact.routeFinder.options[${index}].actionLabel`),
          prompt: stringAt(option.prompt, `contact.routeFinder.options[${index}].prompt`),
          href,
          reveal,
          opensAssistant,
        };
      }),
      directContacts: {
        overline: stringAt(directContacts.overline, 'contact.routeFinder.directContacts.overline'),
        title: stringAt(directContacts.title, 'contact.routeFinder.directContacts.title'),
        body: stringAt(directContacts.body, 'contact.routeFinder.directContacts.body'),
      },
    },
    channels: arrayAt(root.channels, 'contact.channels').map((item, index) => {
      const channel = objectAt(item, `contact.channels[${index}]`);
      return {
        type: stringAt(channel.type, `contact.channels[${index}].type`),
        eyebrow: stringAt(channel.eyebrow, `contact.channels[${index}].eyebrow`),
        title: stringAt(channel.title, `contact.channels[${index}].title`),
        phone: stringAt(channel.phone, `contact.channels[${index}].phone`),
        sms: stringAt(channel.sms, `contact.channels[${index}].sms`),
        email: stringAt(channel.email, `contact.channels[${index}].email`),
        note: stringAt(channel.note, `contact.channels[${index}].note`),
      };
    }),
    channelLabels: {
      phone: stringAt(channelLabels.phone, 'contact.channelLabels.phone'),
      sms: stringAt(channelLabels.sms, 'contact.channelLabels.sms'),
      email: stringAt(channelLabels.email, 'contact.channelLabels.email'),
    },
    debtAdvice: {
      title: stringAt(debtAdvice.title, 'contact.debtAdvice.title'),
      bodyHtml: stringAt(debtAdvice.bodyHtml, 'contact.debtAdvice.bodyHtml'),
    },
  };
}

function validateFaqPage(raw: unknown): FaqPageCopy {
  const root = objectAt(raw, 'faqPage');
  return {
    head: pageHeadAt(root.head, 'faqPage.head'),
    groups: arrayAt(root.groups, 'faqPage.groups').map((item, index) => {
      const group = objectAt(item, `faqPage.groups[${index}]`);
      return {
        number: stringAt(group.number, `faqPage.groups[${index}].number`),
        title: stringAt(group.title, `faqPage.groups[${index}].title`),
      };
    }),
    sideCta: sideCtaAt(root.sideCta, 'faqPage.sideCta'),
  };
}

function validateInstalmentLoan(raw: unknown): InstalmentLoanCopy {
  const root = objectAt(raw, 'instalmentLoan');
  const applyBand = objectAt(root.applyBand, 'instalmentLoan.applyBand');
  return {
    applyUrl: hrefAt(root.applyUrl, 'instalmentLoan.applyUrl'),
    head: pageHeadAt(root.head, 'instalmentLoan.head'),
    cards: textCardsAt(root.cards, 'instalmentLoan.cards'),
    applyBand: {
      title: stringAt(applyBand.title, 'instalmentLoan.applyBand.title'),
      steps: stringArrayAt(applyBand.steps, 'instalmentLoan.applyBand.steps'),
      cta: ctaAt(applyBand.cta, 'instalmentLoan.applyBand.cta'),
    },
    faqTitle: stringAt(root.faqTitle, 'instalmentLoan.faqTitle'),
    faqLinkHtml: stringAt(root.faqLinkHtml, 'instalmentLoan.faqLinkHtml'),
    noticeHtml: stringAt(root.noticeHtml, 'instalmentLoan.noticeHtml'),
  };
}

function validateNews(raw: unknown): NewsCopy {
  const root = objectAt(raw, 'news');
  const index = objectAt(root.index, 'news.index');
  const article = objectAt(root.article, 'news.article');
  const genericPage = objectAt(root.genericPage, 'news.genericPage');
  return {
    index: {
      title: stringAt(index.title, 'news.index.title'),
      description: stringAt(index.description, 'news.index.description'),
      head: pageHeadAt(index.head, 'news.index.head'),
      featuredLabel: stringAt(index.featuredLabel, 'news.index.featuredLabel'),
      cardLabel: stringAt(index.cardLabel, 'news.index.cardLabel'),
    },
    article: {
      backLabel: stringAt(article.backLabel, 'news.article.backLabel'),
      readTimeSuffix: stringAt(article.readTimeSuffix, 'news.article.readTimeSuffix'),
      sideCta: sideCtaAt(article.sideCta, 'news.article.sideCta'),
    },
    genericPage: {
      tocLabel: stringAt(genericPage.tocLabel, 'news.genericPage.tocLabel'),
      sideCta: sideCtaAt(genericPage.sideCta, 'news.genericPage.sideCta'),
    },
  };
}

function validateNotFound(raw: unknown): NotFoundCopy {
  const root = objectAt(raw, 'notFound');
  return {
    title: stringAt(root.title, 'notFound.title'),
    head: pageHeadAt(root.head, 'notFound.head'),
  };
}

function validateApply(raw: unknown): ApplyCopy {
  const root = objectAt(raw, 'apply');
  const head = objectAt(root.head, 'apply.head');
  return {
    title: stringAt(root.title, 'apply.title'),
    description: stringAt(root.description, 'apply.description'),
    head: {
      crumbHtml: stringAt(head.crumbHtml, 'apply.head.crumbHtml'),
      body: stringAt(head.body, 'apply.head.body'),
      signals: stringArrayAt(head.signals, 'apply.head.signals'),
    },
  };
}

function keyedItemsAt(value: unknown, path: string): { key: string; title: string }[] {
  return arrayAt(value, path).map((item, index) => {
    const record = objectAt(item, `${path}[${index}]`);
    return {
      key: stringAt(record.key, `${path}[${index}].key`),
      title: stringAt(record.title, `${path}[${index}].title`),
    };
  });
}

function labelValueRowsAt(value: unknown, path: string): { label: string; value: string }[] {
  return arrayAt(value, path).map((item, index) => {
    const record = objectAt(item, `${path}[${index}]`);
    return {
      label: stringAt(record.label, `${path}[${index}].label`),
      value: stringAt(record.value, `${path}[${index}].value`),
    };
  });
}

function validateApplicationJourney(raw: unknown): ApplicationJourneyCopy {
  const root = objectAt(raw, 'applicationJourney');
  const details = objectAt(root.details, 'applicationJourney.details');
  const borrow = objectAt(root.borrow, 'applicationJourney.borrow');
  const offer = objectAt(root.offer, 'applicationJourney.offer');
  const sign = objectAt(root.sign, 'applicationJourney.sign');
  const bank = objectAt(root.bank, 'applicationJourney.bank');
  const affordability = objectAt(root.affordability, 'applicationJourney.affordability');
  const card = objectAt(root.card, 'applicationJourney.card');
  const openBanking = objectAt(root.openBanking, 'applicationJourney.openBanking');
  const verify = objectAt(root.verify, 'applicationJourney.verify');
  const footer = objectAt(root.footer, 'applicationJourney.footer');
  const addressModal = objectAt(root.addressModal, 'applicationJourney.addressModal');
  const selectedAddress = objectAt(
    addressModal.selectedAddress,
    'applicationJourney.addressModal.selectedAddress',
  );
  const actions = objectAt(root.actions, 'applicationJourney.actions');
  return {
    trustStrip: stringAt(root.trustStrip, 'applicationJourney.trustStrip'),
    homeAriaLabel: stringAt(root.homeAriaLabel, 'applicationJourney.homeAriaLabel'),
    logoAlt: stringAt(root.logoAlt, 'applicationJourney.logoAlt'),
    progressAriaLabel: stringAt(root.progressAriaLabel, 'applicationJourney.progressAriaLabel'),
    applicantNameFallback: stringAt(root.applicantNameFallback, 'applicationJourney.applicantNameFallback'),
    steps: arrayAt(root.steps, 'applicationJourney.steps').map((item, index) => {
      const step = objectAt(item, `applicationJourney.steps[${index}]`);
      return {
        id: stringAt(step.id, `applicationJourney.steps[${index}].id`),
        label: stringAt(step.label, `applicationJourney.steps[${index}].label`),
      };
    }),
    details: {
      title: stringAt(details.title, 'applicationJourney.details.title'),
      body: stringAt(details.body, 'applicationJourney.details.body'),
      bullets: stringArrayAt(details.bullets, 'applicationJourney.details.bullets'),
      incomeHelpHtml: stringAt(details.incomeHelpHtml, 'applicationJourney.details.incomeHelpHtml'),
      partTimeWarning: stringAt(details.partTimeWarning, 'applicationJourney.details.partTimeWarning'),
      retiredWarning: stringAt(details.retiredWarning, 'applicationJourney.details.retiredWarning'),
      dobHelp: stringAt(details.dobHelp, 'applicationJourney.details.dobHelp'),
      mobileHelp: stringAt(details.mobileHelp, 'applicationJourney.details.mobileHelp'),
      postcodeHelp: stringAt(details.postcodeHelp, 'applicationJourney.details.postcodeHelp'),
      acceptTermsHtml: stringAt(details.acceptTermsHtml, 'applicationJourney.details.acceptTermsHtml'),
      smsMarketing: stringAt(details.smsMarketing, 'applicationJourney.details.smsMarketing'),
    },
    borrow: {
      titleBeforeAmount: stringAt(borrow.titleBeforeAmount, 'applicationJourney.borrow.titleBeforeAmount'),
      titleAfterAmount: stringAt(borrow.titleAfterAmount, 'applicationJourney.borrow.titleAfterAmount'),
      body: stringAt(borrow.body, 'applicationJourney.borrow.body'),
      repaymentDateLabel: stringAt(borrow.repaymentDateLabel, 'applicationJourney.borrow.repaymentDateLabel'),
      firstRepaymentDate: stringAt(borrow.firstRepaymentDate, 'applicationJourney.borrow.firstRepaymentDate'),
      firstPaymentExample: stringAt(borrow.firstPaymentExample, 'applicationJourney.borrow.firstPaymentExample'),
      firstRepaymentTemplate: stringAt(borrow.firstRepaymentTemplate, 'applicationJourney.borrow.firstRepaymentTemplate'),
      futurePaymentsTemplate: stringAt(borrow.futurePaymentsTemplate, 'applicationJourney.borrow.futurePaymentsTemplate'),
    },
    offer: {
      title: stringAt(offer.title, 'applicationJourney.offer.title'),
      bodyHtml: stringAt(offer.bodyHtml, 'applicationJourney.offer.bodyHtml'),
      rows: stringArrayAt(offer.rows, 'applicationJourney.offer.rows'),
      changeTerm: stringAt(offer.changeTerm, 'applicationJourney.offer.changeTerm'),
      continueNote: stringAt(offer.continueNote, 'applicationJourney.offer.continueNote'),
    },
    sign: {
      title: stringAt(sign.title, 'applicationJourney.sign.title'),
      body: stringAt(sign.body, 'applicationJourney.sign.body'),
      documents: keyedItemsAt(sign.documents, 'applicationJourney.sign.documents'),
      done: stringAt(sign.done, 'applicationJourney.sign.done'),
      required: stringAt(sign.required, 'applicationJourney.sign.required'),
      signatureLabel: stringAt(sign.signatureLabel, 'applicationJourney.sign.signatureLabel'),
      accept: stringAt(sign.accept, 'applicationJourney.sign.accept'),
    },
    bank: {
      title: stringAt(bank.title, 'applicationJourney.bank.title'),
      bullets: stringArrayAt(bank.bullets, 'applicationJourney.bank.bullets'),
      authorisationTitle: stringAt(bank.authorisationTitle, 'applicationJourney.bank.authorisationTitle'),
      repaymentDateHtml: stringAt(bank.repaymentDateHtml, 'applicationJourney.bank.repaymentDateHtml'),
      accountHolderConfirmed: stringAt(bank.accountHolderConfirmed, 'applicationJourney.bank.accountHolderConfirmed'),
      multiAuthoriser: stringAt(bank.multiAuthoriser, 'applicationJourney.bank.multiAuthoriser'),
      directDebitTitle: stringAt(bank.directDebitTitle, 'applicationJourney.bank.directDebitTitle'),
      directDebitRows: labelValueRowsAt(bank.directDebitRows, 'applicationJourney.bank.directDebitRows'),
      directDebitBody: stringAt(bank.directDebitBody, 'applicationJourney.bank.directDebitBody'),
      guaranteeTitle: stringAt(bank.guaranteeTitle, 'applicationJourney.bank.guaranteeTitle'),
      guaranteeBullets: stringArrayAt(bank.guaranteeBullets, 'applicationJourney.bank.guaranteeBullets'),
      gocardlessHtml: stringAt(bank.gocardlessHtml, 'applicationJourney.bank.gocardlessHtml'),
    },
    affordability: {
      title: stringAt(affordability.title, 'applicationJourney.affordability.title'),
      noticeTitle: stringAt(affordability.noticeTitle, 'applicationJourney.affordability.noticeTitle'),
      noticeBullets: stringArrayAt(affordability.noticeBullets, 'applicationJourney.affordability.noticeBullets'),
      monthlyIncomeHelp: stringAt(affordability.monthlyIncomeHelp, 'applicationJourney.affordability.monthlyIncomeHelp'),
      lowContributionPlaceholder: stringAt(
        affordability.lowContributionPlaceholder,
        'applicationJourney.affordability.lowContributionPlaceholder',
      ),
      transportLegend: stringAt(affordability.transportLegend, 'applicationJourney.affordability.transportLegend'),
      transportOptions: stringArrayAt(affordability.transportOptions, 'applicationJourney.affordability.transportOptions'),
      acceptTerms: stringAt(affordability.acceptTerms, 'applicationJourney.affordability.acceptTerms'),
    },
    card: {
      title: stringAt(card.title, 'applicationJourney.card.title'),
      body: stringAt(card.body, 'applicationJourney.card.body'),
      bullets: stringArrayAt(card.bullets, 'applicationJourney.card.bullets'),
      paymentTitle: stringAt(card.paymentTitle, 'applicationJourney.card.paymentTitle'),
      help: stringAt(card.help, 'applicationJourney.card.help'),
      skip: stringAt(card.skip, 'applicationJourney.card.skip'),
    },
    openBanking: {
      title: stringAt(openBanking.title, 'applicationJourney.openBanking.title'),
      body: stringAt(openBanking.body, 'applicationJourney.openBanking.body'),
      bullets: stringArrayAt(openBanking.bullets, 'applicationJourney.openBanking.bullets'),
      bodyHtml: stringAt(openBanking.bodyHtml, 'applicationJourney.openBanking.bodyHtml'),
      trustedHtml: stringAt(openBanking.trustedHtml, 'applicationJourney.openBanking.trustedHtml'),
      bankGrid: stringArrayAt(openBanking.bankGrid, 'applicationJourney.openBanking.bankGrid'),
    },
    verify: {
      title: stringAt(verify.title, 'applicationJourney.verify.title'),
      body: stringAt(verify.body, 'applicationJourney.verify.body'),
      button: stringAt(verify.button, 'applicationJourney.verify.button'),
      help: stringAt(verify.help, 'applicationJourney.verify.help'),
      finalChecks: stringAt(verify.finalChecks, 'applicationJourney.verify.finalChecks'),
      bullets: stringArrayAt(verify.bullets, 'applicationJourney.verify.bullets'),
    },
    footer: {
      reviews: stringAt(footer.reviews, 'applicationJourney.footer.reviews'),
      legalHtml: stringAt(footer.legalHtml, 'applicationJourney.footer.legalHtml'),
      navigationLabel: stringAt(footer.navigationLabel, 'applicationJourney.footer.navigationLabel'),
      links: linkArrayAt(footer.links, 'applicationJourney.footer.links'),
      version: stringAt(footer.version, 'applicationJourney.footer.version'),
    },
    addressModal: {
      title: stringAt(addressModal.title, 'applicationJourney.addressModal.title'),
      closeLabel: stringAt(addressModal.closeLabel, 'applicationJourney.addressModal.closeLabel'),
      placeholder: stringAt(addressModal.placeholder, 'applicationJourney.addressModal.placeholder'),
      options: stringArrayAt(addressModal.options, 'applicationJourney.addressModal.options'),
      selectedAddress: {
        postcode: stringAt(
          selectedAddress.postcode,
          'applicationJourney.addressModal.selectedAddress.postcode',
        ),
        line1: stringAt(selectedAddress.line1, 'applicationJourney.addressModal.selectedAddress.line1'),
        city: stringAt(selectedAddress.city, 'applicationJourney.addressModal.selectedAddress.city'),
      },
      manual: stringAt(addressModal.manual, 'applicationJourney.addressModal.manual'),
      select: stringAt(addressModal.select, 'applicationJourney.addressModal.select'),
    },
    actions: {
      back: stringAt(actions.back, 'applicationJourney.actions.back'),
      continue: stringAt(actions.continue, 'applicationJourney.actions.continue'),
    },
    fields: stringRecordAt(root.fields, 'applicationJourney.fields'),
    placeholders: stringRecordAt(root.placeholders, 'applicationJourney.placeholders'),
    buttons: stringRecordAt(root.buttons, 'applicationJourney.buttons'),
    employmentStatuses: stringArrayAt(root.employmentStatuses, 'applicationJourney.employmentStatuses'),
    employmentStatusRules: stringRecordAt(
      root.employmentStatusRules,
      'applicationJourney.employmentStatusRules',
    ),
    loanPurposeOptions: stringArrayAt(root.loanPurposeOptions, 'applicationJourney.loanPurposeOptions'),
    lowContributionReasons: stringArrayRecordAt(root.lowContributionReasons, 'applicationJourney.lowContributionReasons'),
    validation: stringRecordAt(root.validation, 'applicationJourney.validation'),
  };
}

export const siteChrome = validateChrome(chromeRaw);
export const homeCopy = validateHome(homeRaw);
export const contactCopy = validateContact(contactRaw);
export const faqPageCopy = validateFaqPage(faqPageRaw);
export const instalmentLoanCopy = validateInstalmentLoan(instalmentLoanRaw);
export const newsCopy = validateNews(newsRaw);
export const notFoundCopy = validateNotFound(notFoundRaw);
export const applyCopy = validateApply(applyRaw);
export const applicationJourneyCopy = validateApplicationJourney(applicationJourneyRaw);
