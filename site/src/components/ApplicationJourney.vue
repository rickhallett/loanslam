<script setup>
import { computed, reactive, ref } from 'vue';
import { applicationJourneyCopy } from '../lib/site-copy';

const copy = applicationJourneyCopy;
const maxLoan = 4600;
const minLoan = 1000;
const steps = copy.steps;

const activeStep = ref(0);
const attempted = reactive({});
const addressModalOpen = ref(false);

const applicant = reactive({
  monthlyIncome: '',
  employmentStatus: '',
  firstName: '',
  lastName: '',
  dob: '',
  mobile: '',
  email: '',
  postcode: '',
  line1: '',
  line2: '',
  line3: '',
  city: '',
  county: '',
  acceptTerms: false,
  smsMarketing: false,
});

const loan = reactive({
  amount: 2500,
  term: 24,
});

const documents = reactive({
  explanation: false,
  preContract: false,
  terms: false,
  agreement: false,
});

const signature = ref('');
const agreementAccepted = ref(false);

const bank = reactive({
  accountHolder: '',
  sort1: '',
  sort2: '',
  sort3: '',
  accountNumber: '',
  accountHolderConfirmed: false,
  multiAuthoriser: false,
});

const affordability = reactive({
  loanPurpose: '',
  dependants: '',
  monthlyIncome: '',
  rent: '',
  rentReason: '',
  councilTax: '',
  councilTaxReason: '',
  energy: '',
  energyReason: '',
  food: '',
  foodReason: '',
  media: '',
  mediaReason: '',
  clothing: '',
  clothingReason: '',
  transport: '',
  vehicle: '',
  vehicleReason: '',
  publicTransport: '',
  publicTransportReason: '',
  acceptTerms: false,
});

const card = reactive({
  number: '',
  expiry: '',
  cvv: '',
  name: '',
  issueNumber: '',
  skipped: false,
});

const current = computed(() => steps[activeStep.value]);
const applicantName = computed(() => {
  const name = `${applicant.firstName} ${applicant.lastName}`.trim();
  return name || copy.applicantNameFallback;
});

const firstRepaymentDate = copy.borrow.firstRepaymentDate;
const firstPaymentExample = copy.borrow.firstPaymentExample;
const loanPurposeOptions = copy.loanPurposeOptions;
const lowContributionReasons = copy.lowContributionReasons;
const docs = copy.sign.documents;
const validation = copy.validation;

const monthlyRepayment = computed(() => {
  const monthlyRate = 0.0201;
  const principal = Number(loan.amount) || 0;
  const term = Number(loan.term) || 1;
  const repayment = principal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -term)));
  return repayment;
});

const offerRows = computed(() => {
  const total = monthlyRepayment.value * loan.term;
  const interest = total - Number(loan.amount);
  const values = [
    money(loan.amount),
    money(monthlyRepayment.value),
    String(loan.term),
    money(total),
    '24.10%',
    money(interest),
    '49.60%',
  ];
  return copy.offer.rows.map((label, index) => [label, values[index]]);
});

const progressWidth = computed(() => {
  if (steps.length <= 1) return '0%';
  return `${(activeStep.value / (steps.length - 1)) * 100}%`;
});

const firstRepaymentHtml = computed(() =>
  copy.borrow.firstRepaymentTemplate.replace('{date}', `<b>${firstPaymentExample}</b>`),
);
const futurePaymentsHtml = computed(() =>
  copy.borrow.futurePaymentsTemplate.replace('{date}', `<b>${firstRepaymentDate}</b>`),
);
const bankBullets = computed(() =>
  copy.bank.bullets.map((bullet) => bullet.replace('{date}', firstPaymentExample)),
);

function money(value) {
  return Number(value || 0).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function visibleError(id) {
  return attempted[current.value.id] ? errors.value[id] : '';
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isMobile(value) {
  return /^07\d{9}$/.test(value);
}

function errorsForDetails() {
  const out = {};
  if (!applicant.monthlyIncome) out.monthlyIncome = validation.monthlyIncomeRequired;
  else if (Number(applicant.monthlyIncome) < 1300)
    out.monthlyIncome = validation.monthlyIncomeMinimum;
  if (!applicant.employmentStatus) out.employmentStatus = validation.employmentStatusRequired;
  if (applicant.employmentStatus === copy.employmentStatusRules.benefits)
    out.employmentStatus = validation.benefitsEmployment;
  if (!applicant.firstName.trim()) out.firstName = validation.nameRequired;
  if (!applicant.lastName.trim()) out.lastName = validation.nameRequired;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(applicant.dob))
    out.dob = validation.dateOfBirth;
  if (!isMobile(applicant.mobile))
    out.mobile = validation.mobile;
  if (!isEmail(applicant.email)) out.email = validation.email;
  if (!applicant.postcode.trim()) out.postcode = validation.postcode;
  if (!applicant.line1.trim()) out.line1 = validation.addressLine1;
  if (!applicant.city.trim()) out.city = validation.city;
  if (!applicant.acceptTerms)
    out.acceptTerms = validation.acceptTerms;
  return out;
}

function errorsForBorrow() {
  const amount = Number(loan.amount);
  const out = {};
  if (!amount) out.amount = validation.loanAmountRequired;
  else if (amount < minLoan) out.amount = validation.loanAmountMinimum;
  else if (amount > maxLoan)
    out.amount = validation.loanAmountMaximum;
  else if (amount % 100 !== 0) out.amount = validation.loanAmountMultiple;
  return out;
}

function errorsForSign() {
  const out = {};
  if (!Object.values(documents).every(Boolean)) out.documents = validation.documents;
  if (!agreementAccepted.value) out.signature = validation.signature;
  return out;
}

function errorsForBank() {
  const out = {};
  if (!bank.accountHolder.trim()) out.accountHolder = validation.accountHolder;
  if (![bank.sort1, bank.sort2, bank.sort3].every((part) => /^\d{2}$/.test(part)))
    out.sortCode = validation.sortCode;
  if (!/^\d{8}$/.test(bank.accountNumber)) out.accountNumber = validation.accountNumber;
  if (!bank.accountHolderConfirmed) out.accountHolderConfirmed = validation.accountHolderConfirmed;
  return out;
}

function errorsForAffordability() {
  const out = {};
  const requiredAmounts = ['rent', 'councilTax', 'energy', 'food', 'media', 'clothing'];
  if (!affordability.loanPurpose) out.loanPurpose = validation.loanPurpose;
  if (affordability.dependants === '') out.dependants = validation.dependants;
  if (!affordability.monthlyIncome) out.monthlyIncome = validation.monthlyIncomeRequired;
  for (const field of requiredAmounts) {
    if (affordability[field] === '') out[field] = validation.amount;
  }
  if (!affordability.transport) out.transport = validation.transport;
  if (affordability.transport === 'Yes' && affordability.vehicle === '')
    out.vehicle = validation.vehicle;
  if (affordability.publicTransport === '') out.publicTransport = validation.publicTransport;
  if (!affordability.acceptTerms)
    out.affordabilityTerms = validation.affordabilityTerms;
  return out;
}

function errorsForCard() {
  if (card.skipped) return {};
  const out = {};
  if (!card.number.trim()) out.cardNumber = validation.cardNumber;
  if (!card.expiry.trim()) out.expiry = validation.expiry;
  if (!card.cvv.trim()) out.cvv = validation.cvv;
  if (!card.name.trim()) out.cardName = validation.cardName;
  return out;
}

const errors = computed(() => {
  if (current.value.id === 'details') return errorsForDetails();
  if (current.value.id === 'borrow') return errorsForBorrow();
  if (current.value.id === 'sign') return errorsForSign();
  if (current.value.id === 'bank') return errorsForBank();
  if (current.value.id === 'affordability') return errorsForAffordability();
  if (current.value.id === 'card') return errorsForCard();
  return {};
});

function findAddress() {
  addressModalOpen.value = true;
}

function selectAddress() {
  applicant.postcode = copy.addressModal.selectedAddress.postcode;
  applicant.line1 = copy.addressModal.selectedAddress.line1;
  applicant.city = copy.addressModal.selectedAddress.city;
  addressModalOpen.value = false;
}

function enterAddressManually() {
  addressModalOpen.value = false;
  applicant.line1 = applicant.line1 || '';
  applicant.city = applicant.city || '';
}

function markDocument(key) {
  documents[key] = true;
}

function acceptAgreement() {
  if (signature.value.trim()) agreementAccepted.value = true;
}

function canSubmit() {
  attempted[current.value.id] = true;
  return Object.keys(errors.value).length === 0;
}

function nextStep() {
  if (!canSubmit()) return;
  if (activeStep.value < steps.length - 1) {
    activeStep.value += 1;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function previousStep() {
  if (activeStep.value > 0) {
    activeStep.value -= 1;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function goToStep(index) {
  if (index <= activeStep.value) {
    activeStep.value = index;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function skipCard() {
  card.skipped = true;
  nextStep();
}
</script>

<template>
  <div class="application">
    <div class="trust-strip">
      <span>{{ copy.trustStrip }}</span>
    </div>

    <header class="application-header">
      <a href="/" :aria-label="copy.homeAriaLabel">
        <img src="/logo.png" :alt="copy.logoAlt" width="132" height="51" />
      </a>
    </header>

    <section class="application-stage">
      <aside class="progress-panel" :aria-label="copy.progressAriaLabel">
        <div class="progress-meter" aria-hidden="true">
          <span :style="{ width: progressWidth }"></span>
        </div>
        <ol>
          <li v-for="(step, index) in steps" :key="step.id">
            <button
              type="button"
              :class="{ active: index === activeStep, done: index < activeStep }"
              :disabled="index > activeStep"
              @click="goToStep(index)"
            >
              <span>{{ index + 1 }}</span>
              {{ step.label }}
            </button>
          </li>
        </ol>
      </aside>

      <form class="application-panel" novalidate @submit.prevent="nextStep">
        <section v-if="current.id === 'details'" class="step-grid">
          <div class="step-copy">
            <h1>{{ copy.details.title }}</h1>
            <p>{{ copy.details.body }}</p>
            <ul class="tick-list">
              <li v-for="bullet in copy.details.bullets" :key="bullet">{{ bullet }}</li>
            </ul>
          </div>

          <div class="field-grid">
            <label>
              <span>{{ copy.fields.monthlyIncome }} <b>*</b></span>
              <span class="money-input">
                <span>£</span>
                <input v-model="applicant.monthlyIncome" name="monthlyIncome" type="number" inputmode="decimal" autocomplete="off" />
              </span>
              <small v-html="copy.details.incomeHelpHtml"></small>
              <em v-if="visibleError('monthlyIncome')">{{ visibleError('monthlyIncome') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.employmentStatus }} <b>*</b></span>
              <select v-model="applicant.employmentStatus" name="employmentStatus">
                <option value="">{{ copy.placeholders.selectOne }}</option>
                <option v-for="status in copy.employmentStatuses" :key="status">{{ status }}</option>
              </select>
              <small v-if="applicant.employmentStatus === copy.employmentStatusRules.partTime">
                {{ copy.details.partTimeWarning }}
              </small>
              <small v-if="applicant.employmentStatus === copy.employmentStatusRules.retired">
                {{ copy.details.retiredWarning }}
              </small>
              <em v-if="visibleError('employmentStatus')">{{ visibleError('employmentStatus') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.firstName }} <b>*</b></span>
              <input v-model="applicant.firstName" name="firstName" autocomplete="given-name" />
              <em v-if="visibleError('firstName')">{{ visibleError('firstName') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.lastName }} <b>*</b></span>
              <input v-model="applicant.lastName" name="lastName" autocomplete="family-name" />
              <em v-if="visibleError('lastName')">{{ visibleError('lastName') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.dob }} <b>*</b></span>
              <input v-model="applicant.dob" name="dob" :placeholder="copy.placeholders.dateOfBirth" inputmode="numeric" autocomplete="off" />
              <small>{{ copy.details.dobHelp }}</small>
              <em v-if="visibleError('dob')">{{ visibleError('dob') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.mobile }} <b>*</b></span>
              <input v-model="applicant.mobile" name="mobile" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel" />
              <small>{{ copy.details.mobileHelp }}</small>
              <em v-if="visibleError('mobile')">{{ visibleError('mobile') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.email }} <b>*</b></span>
              <input v-model="applicant.email" name="email" type="email" autocomplete="email" />
              <em v-if="visibleError('email')">{{ visibleError('email') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.postcode }} <b>*</b></span>
              <span class="lookup-input">
                <input v-model="applicant.postcode" name="postcode" autocapitalize="characters" autocomplete="postal-code" />
                <button type="button" @click="findAddress">{{ copy.buttons.findAddress }}</button>
              </span>
              <small>{{ copy.details.postcodeHelp }}</small>
              <em v-if="visibleError('postcode')">{{ visibleError('postcode') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.addressLine1 }} <b>*</b></span>
              <input v-model="applicant.line1" name="addressLine1" autocomplete="address-line1" />
              <em v-if="visibleError('line1')">{{ visibleError('line1') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.addressLine2 }}</span>
              <input v-model="applicant.line2" name="addressLine2" autocomplete="address-line2" />
            </label>

            <label>
              <span>{{ copy.fields.addressLine3 }}</span>
              <input v-model="applicant.line3" name="addressLine3" autocomplete="off" />
            </label>

            <label>
              <span>{{ copy.fields.city }} <b>*</b></span>
              <input v-model="applicant.city" name="city" autocomplete="address-level2" />
              <em v-if="visibleError('city')">{{ visibleError('city') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.county }}</span>
              <input v-model="applicant.county" name="county" autocomplete="address-level1" />
            </label>
          </div>

          <div class="check-row">
            <label>
              <input v-model="applicant.acceptTerms" name="acceptTerms" type="checkbox" />
              <span v-html="copy.details.acceptTermsHtml"></span>
            </label>
            <em v-if="visibleError('acceptTerms')">{{ visibleError('acceptTerms') }}</em>
          </div>

          <div class="check-row">
            <label>
              <input v-model="applicant.smsMarketing" name="smsMarketing" type="checkbox" />
              <span>{{ copy.details.smsMarketing }}</span>
            </label>
          </div>
        </section>

        <section v-else-if="current.id === 'borrow'" class="single-step">
          <h1>{{ copy.borrow.titleBeforeAmount }}{{ maxLoan.toLocaleString('en-GB') }}{{ copy.borrow.titleAfterAmount }}</h1>
          <p>{{ copy.borrow.body }}</p>

          <label class="amount-field">
            <span>{{ copy.fields.loanAmount }} <b>*</b></span>
            <span class="money-input">
              <span>£</span>
              <input v-model.number="loan.amount" name="loanAmount" inputmode="numeric" />
            </span>
            <em v-if="visibleError('amount')">{{ visibleError('amount') }}</em>
          </label>

          <fieldset class="choice-field">
            <legend>{{ copy.fields.loanTerm }}</legend>
            <label v-if="loan.amount >= 3000"><input v-model.number="loan.term" name="loanTerm" type="radio" value="36" /> 36 months</label>
            <label><input v-model.number="loan.term" name="loanTerm" type="radio" value="24" /> 24 months</label>
            <label><input v-model.number="loan.term" name="loanTerm" type="radio" value="18" /> 18 months</label>
            <label><input v-model.number="loan.term" name="loanTerm" type="radio" value="12" /> 12 months</label>
            <label><input v-model.number="loan.term" name="loanTerm" type="radio" value="9" /> 9 months</label>
          </fieldset>

          <div class="repayment-note">
            <strong>{{ copy.borrow.repaymentDateLabel }}</strong>
            <p v-html="firstRepaymentHtml"></p>
            <p v-html="futurePaymentsHtml"></p>
          </div>
        </section>

        <section v-else-if="current.id === 'offer'" class="single-step">
          <h1>{{ copy.offer.title }}</h1>
          <p v-html="copy.offer.bodyHtml"></p>

          <dl class="summary-list">
            <div v-for="[label, value] in offerRows" :key="label">
              <dt>{{ label }}</dt>
              <dd>{{ value }}</dd>
            </div>
          </dl>

          <button class="secondary-action" type="button" @click="activeStep = 1">{{ copy.offer.changeTerm }}</button>
          <p>{{ copy.offer.continueNote }}</p>
        </section>

        <section v-else-if="current.id === 'sign'" class="single-step">
          <h1>{{ copy.sign.title }}</h1>
          <p>{{ copy.sign.body }}</p>

          <div class="document-list">
            <button
              v-for="doc in docs"
              :key="doc.key"
              type="button"
              :class="{ read: documents[doc.key] }"
              @click="markDocument(doc.key)"
            >
              <span>{{ doc.title }}</span>
              <b>{{ documents[doc.key] ? copy.sign.done : copy.sign.required }}</b>
            </button>
          </div>
          <em v-if="visibleError('documents')">{{ visibleError('documents') }}</em>

          <label>
            <span>{{ copy.sign.signatureLabel }}</span>
            <input v-model="signature" name="signature" :placeholder="applicantName" />
          </label>
          <button class="secondary-action" type="button" @click="acceptAgreement">{{ copy.sign.accept }}</button>
          <em v-if="visibleError('signature')">{{ visibleError('signature') }}</em>
        </section>

        <section v-else-if="current.id === 'bank'" class="single-step">
          <h1>{{ copy.bank.title }}</h1>
          <ul class="tick-list compact">
            <li v-for="bullet in bankBullets" :key="bullet">{{ bullet }}</li>
          </ul>

          <h2>{{ copy.bank.authorisationTitle }}</h2>
          <p v-html="copy.bank.repaymentDateHtml"></p>

          <div class="field-grid">
            <label>
              <span>{{ copy.fields.accountHolder }} <b>*</b></span>
              <input v-model="bank.accountHolder" name="accountHolder" :placeholder="applicantName" />
              <em v-if="visibleError('accountHolder')">{{ visibleError('accountHolder') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.sortCode }} <b>*</b></span>
              <span class="sort-code">
                <input v-model="bank.sort1" name="sortCode1" maxlength="2" inputmode="numeric" />
                <input v-model="bank.sort2" name="sortCode2" maxlength="2" inputmode="numeric" />
                <input v-model="bank.sort3" name="sortCode3" maxlength="2" inputmode="numeric" />
              </span>
              <em v-if="visibleError('sortCode')">{{ visibleError('sortCode') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.accountNumber }} <b>*</b></span>
              <input v-model="bank.accountNumber" name="accountNumber" maxlength="8" inputmode="numeric" />
              <em v-if="visibleError('accountNumber')">{{ visibleError('accountNumber') }}</em>
            </label>
          </div>

          <div class="check-row">
            <label>
              <input v-model="bank.accountHolderConfirmed" name="accountHolderConfirmed" type="checkbox" />
              <span>{{ copy.bank.accountHolderConfirmed }}</span>
            </label>
            <em v-if="visibleError('accountHolderConfirmed')">{{ visibleError('accountHolderConfirmed') }}</em>
          </div>
          <div class="check-row">
            <label>
              <input v-model="bank.multiAuthoriser" name="multiAuthoriser" type="checkbox" />
              <span>{{ copy.bank.multiAuthoriser }}</span>
            </label>
          </div>

          <div class="direct-debit">
            <h3>{{ copy.bank.directDebitTitle }}</h3>
            <dl>
              <div v-for="row in copy.bank.directDebitRows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            </dl>
            <p>{{ copy.bank.directDebitBody }}</p>
            <h3>{{ copy.bank.guaranteeTitle }}</h3>
            <ul>
              <li v-for="bullet in copy.bank.guaranteeBullets" :key="bullet">{{ bullet }}</li>
            </ul>
            <p v-html="copy.bank.gocardlessHtml"></p>
          </div>
        </section>

        <section v-else-if="current.id === 'affordability'" class="single-step">
          <h1>{{ copy.affordability.title }}</h1>
          <div class="field-grid">
            <label>
              <span>{{ copy.fields.loanPurpose }} <b>*</b></span>
              <select v-model="affordability.loanPurpose" name="loanPurpose">
                <option value="">{{ copy.placeholders.select }}</option>
                <option v-for="option in loanPurposeOptions" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('loanPurpose')">{{ visibleError('loanPurpose') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.dependants }} <b>*</b></span>
              <select v-model="affordability.dependants" name="dependants">
                <option value="">{{ copy.placeholders.select }}</option>
                <option v-for="count in 11" :key="count - 1">{{ count - 1 }}</option>
              </select>
              <em v-if="visibleError('dependants')">{{ visibleError('dependants') }}</em>
            </label>
          </div>

          <div class="notice-strip">
            <h2>{{ copy.affordability.noticeTitle }}</h2>
            <ul class="tick-list compact">
              <li v-for="bullet in copy.affordability.noticeBullets" :key="bullet">{{ bullet }}</li>
            </ul>
          </div>

          <div class="field-grid expense-grid">
            <label>
              <span>{{ copy.fields.monthlyIncome }} <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.monthlyIncome" name="affordabilityMonthlyIncome" type="number" /></span>
              <small>{{ copy.affordability.monthlyIncomeHelp }}</small>
              <em v-if="visibleError('monthlyIncome')">{{ visibleError('monthlyIncome') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.rent }} <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.rent" name="rentContribution" type="number" /></span>
              <select v-model="affordability.rentReason" name="rentReason">
                <option value="">{{ copy.affordability.lowContributionPlaceholder }}</option>
                <option v-for="option in lowContributionReasons.rent" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('rent')">{{ visibleError('rent') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.councilTax }} <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.councilTax" name="councilTaxContribution" type="number" /></span>
              <select v-model="affordability.councilTaxReason" name="councilTaxReason">
                <option value="">{{ copy.affordability.lowContributionPlaceholder }}</option>
                <option v-for="option in lowContributionReasons.councilTax" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('councilTax')">{{ visibleError('councilTax') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.energy }} <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.energy" name="energyContribution" type="number" /></span>
              <select v-model="affordability.energyReason" name="energyReason">
                <option value="">{{ copy.affordability.lowContributionPlaceholder }}</option>
                <option v-for="option in lowContributionReasons.energy" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('energy')">{{ visibleError('energy') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.food }} <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.food" name="foodContribution" type="number" /></span>
              <select v-model="affordability.foodReason" name="foodReason">
                <option value="">{{ copy.affordability.lowContributionPlaceholder }}</option>
                <option v-for="option in lowContributionReasons.food" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('food')">{{ visibleError('food') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.media }} <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.media" name="mediaContribution" type="number" /></span>
              <select v-model="affordability.mediaReason" name="mediaReason">
                <option value="">{{ copy.affordability.lowContributionPlaceholder }}</option>
                <option v-for="option in lowContributionReasons.media" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('media')">{{ visibleError('media') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.clothing }} <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.clothing" name="clothingContribution" type="number" /></span>
              <select v-model="affordability.clothingReason" name="clothingReason">
                <option value="">{{ copy.affordability.lowContributionPlaceholder }}</option>
                <option v-for="option in lowContributionReasons.clothing" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('clothing')">{{ visibleError('clothing') }}</em>
            </label>
          </div>

          <fieldset class="choice-field">
            <legend>{{ copy.affordability.transportLegend }}</legend>
            <label v-for="option in copy.affordability.transportOptions" :key="option">
              <input v-model="affordability.transport" name="transportCosts" type="radio" :value="option" /> {{ option }}
            </label>
            <em v-if="visibleError('transport')">{{ visibleError('transport') }}</em>
          </fieldset>

          <div class="field-grid expense-grid">
            <label v-if="affordability.transport !== 'No'">
              <span>{{ copy.fields.vehicle }} <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.vehicle" name="vehicleContribution" type="number" /></span>
              <select v-model="affordability.vehicleReason" name="vehicleReason">
                <option value="">{{ copy.affordability.lowContributionPlaceholder }}</option>
                <option v-for="option in lowContributionReasons.vehicle" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('vehicle')">{{ visibleError('vehicle') }}</em>
            </label>

            <label>
              <span>{{ copy.fields.publicTransport }}</span>
              <span class="money-input"><span>£</span><input v-model="affordability.publicTransport" name="publicTransportContribution" type="number" /></span>
              <select v-model="affordability.publicTransportReason" name="publicTransportReason">
                <option value="">{{ copy.affordability.lowContributionPlaceholder }}</option>
                <option v-for="option in lowContributionReasons.publicTransport" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('publicTransport')">{{ visibleError('publicTransport') }}</em>
            </label>
          </div>

          <div class="check-row">
            <label>
              <input v-model="affordability.acceptTerms" name="affordabilityAcceptTerms" type="checkbox" />
              <span>{{ copy.affordability.acceptTerms }} <b>*</b></span>
            </label>
            <em v-if="visibleError('affordabilityTerms')">{{ visibleError('affordabilityTerms') }}</em>
          </div>
        </section>

        <section v-else-if="current.id === 'card'" class="single-step">
          <h1>{{ copy.card.title }}</h1>
          <p>{{ copy.card.body }}</p>
          <ul class="tick-list compact">
            <li v-for="bullet in copy.card.bullets" :key="bullet">{{ bullet }}</li>
          </ul>

          <h2>{{ copy.card.paymentTitle }}</h2>
          <div class="field-grid">
            <label>
              <span>{{ copy.fields.cardNumber }} <b>*</b></span>
              <input v-model="card.number" name="cardNumber" inputmode="numeric" />
              <em v-if="visibleError('cardNumber')">{{ visibleError('cardNumber') }}</em>
            </label>
            <label>
              <span>{{ copy.fields.expiry }} <b>*</b></span>
              <input v-model="card.expiry" name="cardExpiry" :placeholder="copy.placeholders.cardExpiry" />
              <em v-if="visibleError('expiry')">{{ visibleError('expiry') }}</em>
            </label>
            <label>
              <span>{{ copy.fields.cvv }} <b>*</b></span>
              <input v-model="card.cvv" name="cardCvv" inputmode="numeric" />
              <em v-if="visibleError('cvv')">{{ visibleError('cvv') }}</em>
            </label>
            <label>
              <span>{{ copy.fields.cardName }} <b>*</b></span>
              <input v-model="card.name" name="cardName" :placeholder="applicantName" />
              <em v-if="visibleError('cardName')">{{ visibleError('cardName') }}</em>
            </label>
            <label>
              <span>{{ copy.fields.issueNumber }}</span>
              <input v-model="card.issueNumber" name="issueNumber" />
            </label>
          </div>

          <p>{{ copy.card.help }}</p>
          <button class="secondary-action" type="button" @click="skipCard">{{ copy.card.skip }}</button>
        </section>

        <section v-else-if="current.id === 'openBanking'" class="single-step open-banking">
          <h1>{{ copy.openBanking.title }}</h1>
          <p>{{ copy.openBanking.body }}</p>
          <ul class="tick-list compact">
            <li v-for="bullet in copy.openBanking.bullets" :key="bullet">{{ bullet }}</li>
          </ul>
          <p v-html="copy.openBanking.bodyHtml"></p>
          <p v-html="copy.openBanking.trustedHtml"></p>
          <div class="bank-grid" aria-hidden="true">
            <span v-for="item in copy.openBanking.bankGrid" :key="item">{{ item }}</span>
          </div>
        </section>

        <section v-else class="single-step open-banking">
          <h1>{{ copy.verify.title }}</h1>
          <p>{{ copy.verify.body }}</p>
          <button class="primary-action" type="button">{{ copy.verify.button }}</button>
          <p>{{ copy.verify.help }}</p>
          <p>{{ copy.verify.finalChecks }}</p>
          <ul class="tick-list compact">
            <li v-for="bullet in copy.verify.bullets" :key="bullet">{{ bullet }}</li>
          </ul>
        </section>

        <div class="actions-row">
          <button v-if="activeStep > 0" class="secondary-action" type="button" @click="previousStep">{{ copy.actions.back }}</button>
          <button v-if="activeStep < steps.length - 1" class="primary-action" type="submit">{{ copy.actions.continue }}</button>
        </div>
      </form>
    </section>

    <footer class="application-footer">
      <div class="customer-reviews">{{ copy.footer.reviews }}</div>
      <p v-html="copy.footer.legalHtml"></p>
      <nav :aria-label="copy.footer.navigationLabel">
        <a v-for="link in copy.footer.links" :key="link.href" :href="link.href">{{ link.label }}</a>
      </nav>
      <small>{{ copy.footer.version }}</small>
    </footer>

    <div v-if="addressModalOpen" class="modal-backdrop" role="presentation">
      <div class="address-modal" role="dialog" aria-modal="true" aria-labelledby="address-title">
        <header>
          <h2 id="address-title">{{ copy.addressModal.title }}</h2>
          <button type="button" :aria-label="copy.addressModal.closeLabel" @click="addressModalOpen = false">×</button>
        </header>
        <select name="addressLookup">
          <option>{{ copy.addressModal.placeholder }}</option>
          <option v-for="option in copy.addressModal.options" :key="option">{{ option }}</option>
        </select>
        <footer>
          <button class="secondary-action" type="button" @click="enterAddressManually">{{ copy.addressModal.manual }}</button>
          <button class="primary-action" type="button" @click="selectAddress">{{ copy.addressModal.select }}</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.application {
  min-height: 100vh;
  background: #f8fbfc;
  color: #17363f;
}

.application :is(h1, h2, h3, p, span, label, button, input, select, small) {
  letter-spacing: 0;
}

.trust-strip {
  display: flex;
  justify-content: center;
  background: linear-gradient(180deg, #2b9baf, #00879b);
  color: #fff;
  padding: 0.38rem 1rem;
  font-size: 0.88rem;
  font-weight: 700;
}

.application-header {
  display: flex;
  justify-content: center;
  padding: 1.4rem 1rem 1.1rem;
  background: #fff;
  border-bottom: 1px solid #dbe8eb;
}

.application-stage {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 820px);
  gap: 1.25rem;
  width: min(1180px, calc(100% - 2rem));
  margin: 2rem auto 3rem;
  align-items: start;
}

.progress-panel,
.application-panel {
  background: #fff;
  border: 1px solid #dbe8eb;
  border-radius: 8px;
  box-shadow: 0 12px 32px -26px rgba(4, 33, 41, 0.35);
}

.progress-panel {
  position: sticky;
  top: 1rem;
  padding: 1rem;
}

.progress-meter {
  height: 6px;
  background: #dbe8eb;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-meter span {
  display: block;
  height: 100%;
  background: #00879b;
}

.progress-panel ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.progress-panel button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  text-align: left;
  border: 0;
  background: transparent;
  color: #496972;
  border-radius: 8px;
  padding: 0.55rem;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

.progress-panel button:disabled {
  cursor: default;
  opacity: 0.6;
}

.progress-panel button span {
  display: grid;
  place-items: center;
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 50%;
  background: #e9f6f8;
  color: #00879b;
  font-size: 0.8rem;
  flex: none;
}

.progress-panel button.active {
  color: #062e38;
  background: #e9f6f8;
}

.progress-panel button.done span {
  background: #44a06d;
  color: #fff;
}

.application-panel {
  padding: clamp(1rem, 3vw, 2rem);
}

.step-grid,
.single-step {
  display: grid;
  gap: 1.3rem;
}

.step-copy h1,
.single-step h1 {
  font-size: clamp(1.85rem, 4vw, 2.55rem);
}

.single-step h2 {
  font-size: 1.35rem;
  margin-top: 0.5rem;
}

.tick-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: grid;
  gap: 0.55rem;
}

.tick-list li {
  position: relative;
  padding-left: 1.8rem;
  font-weight: 700;
}

.tick-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  top: 0;
  color: #44a06d;
}

.compact {
  margin-block: 0.4rem 1rem;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

label,
.choice-field {
  display: grid;
  gap: 0.35rem;
  color: #17363f;
  font-weight: 750;
}

label > span:first-child,
legend {
  font-size: 0.96rem;
}

b {
  color: #b72b2b;
}

input,
select {
  width: 100%;
  min-height: 46px;
  border: 1px solid #b7cbd1;
  border-radius: 8px;
  background: #fff;
  color: #17363f;
  font: inherit;
  padding: 0.65rem 0.75rem;
}

input:focus,
select:focus {
  border-color: #00879b;
  outline: 3px solid rgba(0, 135, 155, 0.18);
}

small {
  color: #55717a;
  font-weight: 600;
  line-height: 1.45;
}

em {
  color: #b72b2b;
  font-style: normal;
  font-weight: 700;
  font-size: 0.88rem;
}

.money-input,
.lookup-input {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: stretch;
}

.lookup-input {
  grid-template-columns: minmax(0, 1fr) auto;
}

.money-input > span,
.lookup-input button {
  display: grid;
  place-items: center;
  min-height: 46px;
  border: 1px solid #b7cbd1;
  background: #eef7f9;
  color: #17363f;
  font-weight: 800;
  padding-inline: 0.85rem;
}

.money-input > span {
  border-radius: 8px 0 0 8px;
  border-right: 0;
}

.money-input input {
  border-radius: 0 8px 8px 0;
}

.lookup-input input {
  border-radius: 8px 0 0 8px;
}

.lookup-input button {
  border-radius: 0 8px 8px 0;
  cursor: pointer;
}

.check-row {
  display: grid;
  gap: 0.35rem;
}

.check-row label {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  font-weight: 650;
}

.check-row input {
  width: 1.15rem;
  height: 1.15rem;
  min-height: 0;
  margin-top: 0.3rem;
  flex: none;
}

.amount-field {
  max-width: 20rem;
}

.choice-field {
  border: 0;
  padding: 0;
  margin: 0;
  gap: 0.65rem;
}

.choice-field label {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 700;
}

.choice-field input {
  width: 1rem;
  min-height: 0;
}

.repayment-note,
.notice-strip,
.direct-debit {
  border: 1px solid #dbe8eb;
  border-radius: 8px;
  background: #f8fbfc;
  padding: 1rem;
}

.summary-list {
  display: grid;
  margin: 0;
  border: 1px solid #dbe8eb;
  border-radius: 8px;
  overflow: hidden;
}

.summary-list div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid #dbe8eb;
}

.summary-list div:last-child {
  border-bottom: 0;
}

.summary-list dt {
  font-weight: 800;
}

.summary-list dd {
  margin: 0;
  color: #062e38;
  font-weight: 800;
}

.document-list {
  display: grid;
  gap: 0.55rem;
}

.document-list button {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  border: 1px solid #dbe8eb;
  border-radius: 8px;
  background: #fff;
  color: #17363f;
  padding: 0.9rem 1rem;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.document-list button.read {
  border-color: #44a06d;
  background: #ecf7f0;
}

.document-list b {
  flex: none;
}

.sort-code {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.direct-debit dl {
  display: grid;
  gap: 0.5rem;
  margin: 0 0 1rem;
}

.direct-debit dl div {
  display: grid;
  grid-template-columns: 12rem minmax(0, 1fr);
  gap: 1rem;
}

.direct-debit dt {
  font-weight: 800;
}

.direct-debit dd {
  margin: 0;
}

.direct-debit ul {
  padding-left: 1.1rem;
}

.expense-grid select {
  margin-top: 0.25rem;
}

.bank-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.bank-grid span {
  display: grid;
  place-items: center;
  min-height: 4rem;
  border: 1px solid #dbe8eb;
  border-radius: 8px;
  background: #fff;
  color: #55717a;
  font-size: 0.9rem;
  font-weight: 800;
}

.actions-row {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.7rem;
}

.primary-action,
.secondary-action {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-height: 46px;
  border-radius: 999px;
  border: 2px solid transparent;
  font: inherit;
  font-weight: 850;
  padding: 0.7rem 1.5rem;
  cursor: pointer;
}

.primary-action {
  background: #f7a823;
  color: #042129;
}

.secondary-action {
  background: #fff;
  color: #17363f;
  border-color: #dbe8eb;
}

.application-footer {
  background: #062e38;
  color: #c2dde3;
  padding: 2.5rem max(1rem, calc((100vw - 980px) / 2));
  font-size: 0.86rem;
}

.customer-reviews {
  color: #fff;
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 800;
  margin-bottom: 1rem;
}

.application-footer p {
  max-width: 70rem;
}

.application-footer nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem 1.5rem;
  margin: 1rem 0;
}

.application-footer a {
  color: #fff;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: rgba(4, 33, 41, 0.45);
  padding: 1rem;
}

.address-modal {
  width: min(520px, 100%);
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 26px 80px -30px rgba(4, 33, 41, 0.6);
  padding: 1rem;
}

.address-modal header,
.address-modal footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.address-modal h2 {
  font-size: 1.35rem;
  margin: 0;
}

.address-modal header button {
  border: 0;
  background: transparent;
  font-size: 1.7rem;
  line-height: 1;
  cursor: pointer;
}

.address-modal select {
  margin-block: 1rem;
}

@media (max-width: 900px) {
  .application-stage {
    grid-template-columns: 1fr;
  }

  .progress-panel {
    position: static;
  }

  .progress-panel ol {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .application-stage {
    width: min(100% - 1rem, 1180px);
    margin-top: 1rem;
  }

  .field-grid,
  .summary-list div,
  .direct-debit dl div,
  .bank-grid {
    grid-template-columns: 1fr;
  }

  .progress-panel ol {
    grid-template-columns: 1fr;
  }

  .actions-row,
  .address-modal footer {
    flex-direction: column-reverse;
    align-items: stretch;
  }
}
</style>
