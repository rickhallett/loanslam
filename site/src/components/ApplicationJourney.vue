<script setup>
import { computed, reactive, ref } from 'vue';

const maxLoan = 4600;
const minLoan = 1000;

const steps = [
  { id: 'details', label: 'Your details' },
  { id: 'borrow', label: 'Loan amount' },
  { id: 'offer', label: 'Loan offer' },
  { id: 'sign', label: 'Read and sign' },
  { id: 'bank', label: 'Bank details' },
  { id: 'affordability', label: 'Affordability' },
  { id: 'card', label: 'Card check' },
  { id: 'openBanking', label: 'Open Banking' },
  { id: 'verify', label: 'Verify account' },
];

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
  return name || 'Test Applicant';
});

const firstRepaymentDate = '1st of each month';
const firstPaymentExample = '30th July 2026';

const loanPurposeOptions = [
  'Vehicle purchase',
  'Vehicle repairs',
  'Home improvements',
  'Holiday',
  'Health care/medical',
  'Wedding',
  'Major purchase (electronics, furniture)',
  'Moving/relocation',
  'Urgent home/car repairs',
  'Unexpected expense',
  'Funeral expense',
  'Pet expense',
  'Debt consolidation',
  'Legal expense',
];

const lowContributionReasons = {
  rent: [
    'Partner pays',
    'Lives at home with parents/family',
    'Housing assistance/subsidy',
    'Shared accommodation',
    'Renting from family/reduced rate',
    'Inherited property',
    'Military housing',
    'Employer-provided housing',
    'Student housing',
    'Own home outright',
  ],
  councilTax: [
    'Partner Pays',
    'Lives at home with parents/family',
    'Council tax reduction/exemption',
    'Single person discount',
    'Disability reduction',
    'Shared property/shared bill',
  ],
  energy: [
    'Partner pays',
    'Lives at home with parents/family',
    'Energy-efficient home',
    'Shared accommodation',
    'Government energy grant/subsidy',
    'Reduced rate through employer',
    'Using renewable energy',
    'Prepaid meter',
    'Long-term fixed energy tariff',
    'Energy bill included in rent',
  ],
  food: [
    'Partner pays',
    'Lives at home with parents/family',
    'Shares cost with roommates',
    'Receives food assistance',
    'Meals provided by employer/school',
    'Dietary restrictions',
  ],
  media: [
    'Partner pays',
    'Lives at home with parents/family',
    'Shares cost with roommates',
    'Employer-provided phone/internet',
    'Low-cost subsidized/prepaid plan',
    'Minimal usage',
    'Student discount',
  ],
  clothing: [
    'Partner pays',
    'Minimal need for new clothing',
    'Employee discounts',
    'Uniform provided',
    'Purchases second-hand',
  ],
  vehicle: [
    'Partner pays',
    'Shared expense with family/roommate/carpool',
    'Employer-provided vehicle',
    'Fuel allowance from employer',
    'Minimal vehicle usage',
    'Vehicle is fuel efficient/electric',
    'Vehicle subscription service',
  ],
  publicTransport: [
    'Partner pays',
    'Walks/cycles',
    'Employer provided subsidy',
    'Student discount/free pass',
  ],
};

const docs = [
  { key: 'explanation', title: 'Explanation of Your Fixed Sum Loan Agreement' },
  { key: 'preContract', title: 'Pre-Contract Credit Information' },
  { key: 'terms', title: 'Terms And Conditions' },
  { key: 'agreement', title: 'Important Information: Your Loan Agreement' },
];

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
  return [
    ['Loan advance', money(loan.amount)],
    ['Monthly repayment', money(monthlyRepayment.value)],
    ['No of repayments', String(loan.term)],
    ['Total cost of Credit', money(total)],
    ['Interest Rate', '24.10%'],
    ['Total charge of Credit', money(interest)],
    ['APR', '49.60%'],
  ];
});

const progressWidth = computed(() => {
  if (steps.length <= 1) return '0%';
  return `${(activeStep.value / (steps.length - 1)) * 100}%`;
});

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
  if (!applicant.monthlyIncome) out.monthlyIncome = 'Monthly income is required.';
  else if (Number(applicant.monthlyIncome) < 1300)
    out.monthlyIncome = 'You must earn at least £1,300 a month.';
  if (!applicant.employmentStatus) out.employmentStatus = 'Please select an employment status.';
  if (applicant.employmentStatus === 'On benefits')
    out.employmentStatus = 'We cannot lend to you if benefits is your primary income. We will check this.';
  if (!applicant.firstName.trim()) out.firstName = 'Name is required.';
  if (!applicant.lastName.trim()) out.lastName = 'Name is required.';
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(applicant.dob))
    out.dob = 'Please enter a valid date in DD/MM/YYYY format.';
  if (!isMobile(applicant.mobile))
    out.mobile = 'Please enter a valid mobile number starting with 07.';
  if (!isEmail(applicant.email)) out.email = 'Please enter a valid email address.';
  if (!applicant.postcode.trim()) out.postcode = 'Postcode is required.';
  if (!applicant.line1.trim()) out.line1 = 'Address Line 1 is required';
  if (!applicant.city.trim()) out.city = 'City is required';
  if (!applicant.acceptTerms)
    out.acceptTerms = 'You must agree to our use of your information before continuing.';
  return out;
}

function errorsForBorrow() {
  const amount = Number(loan.amount);
  const out = {};
  if (!amount) out.amount = 'Please enter a loan amount';
  else if (amount < minLoan) out.amount = 'Loan amount must be greater than or equal to £1000';
  else if (amount > maxLoan)
    out.amount = 'Loan amount cannot be greater than twice your monthly income, or greater than £5,000';
  else if (amount % 100 !== 0) out.amount = 'Loan amount should be in multiples of 100';
  return out;
}

function errorsForSign() {
  const out = {};
  if (!Object.values(documents).every(Boolean)) out.documents = 'Please open all required documents.';
  if (!agreementAccepted.value) out.signature = 'Please sign and accept your loan agreement.';
  return out;
}

function errorsForBank() {
  const out = {};
  if (!bank.accountHolder.trim()) out.accountHolder = 'Account holder name is required.';
  if (![bank.sort1, bank.sort2, bank.sort3].every((part) => /^\d{2}$/.test(part)))
    out.sortCode = 'Sort code must contain three pairs of digits.';
  if (!/^\d{8}$/.test(bank.accountNumber)) out.accountNumber = 'Account number must contain 8 digits.';
  if (!bank.accountHolderConfirmed) out.accountHolderConfirmed = 'Please confirm you are the account holder.';
  return out;
}

function errorsForAffordability() {
  const out = {};
  const requiredAmounts = ['rent', 'councilTax', 'energy', 'food', 'media', 'clothing'];
  if (!affordability.loanPurpose) out.loanPurpose = 'Please select a loan purpose.';
  if (affordability.dependants === '') out.dependants = 'Please select the number of dependants.';
  if (!affordability.monthlyIncome) out.monthlyIncome = 'Monthly income is required.';
  for (const field of requiredAmounts) {
    if (affordability[field] === '') out[field] = 'Please enter an amount.';
  }
  if (!affordability.transport) out.transport = 'Please select Yes or No.';
  if (affordability.transport === 'Yes' && affordability.vehicle === '')
    out.vehicle = 'Please enter vehicle running costs.';
  if (affordability.publicTransport === '') out.publicTransport = 'Please enter public transport costs.';
  if (!affordability.acceptTerms)
    out.affordabilityTerms = 'Please confirm your income or spending is not expected to change.';
  return out;
}

function errorsForCard() {
  if (card.skipped) return {};
  const out = {};
  if (!card.number.trim()) out.cardNumber = 'Card number is required.';
  if (!card.expiry.trim()) out.expiry = 'Expiry date is required.';
  if (!card.cvv.trim()) out.cvv = 'CVV is required.';
  if (!card.name.trim()) out.cardName = 'Name on card is required.';
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
  applicant.postcode = 'SW1A 1AA';
  applicant.line1 = 'Buckingham Palace';
  applicant.city = 'London';
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
      <span>Rated Excellent. 4.8 out of 5 on Trustpilot</span>
    </div>

    <header class="application-header">
      <a href="/" aria-label="Loans by MAL home">
        <img src="/logo.png" alt="loans by mal - web based loans" width="132" height="51" />
      </a>
    </header>

    <section class="application-stage">
      <aside class="progress-panel" aria-label="Application progress">
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
            <h1>Borrow up to £5000 over terms up to 36 months</h1>
            <p>We've lent to over 40,000 customers and have an 'Excellent' rating on Trustpilot</p>
            <ul class="tick-list">
              <li>No hidden fees or charges</li>
              <li>Simple, fast and safe application</li>
              <li>Loans paid out in under 24hrs</li>
            </ul>
          </div>

          <div class="field-grid">
            <label>
              <span>Your Monthly Income After Tax <b>*</b></span>
              <span class="money-input">
                <span>£</span>
                <input v-model="applicant.monthlyIncome" name="monthlyIncome" type="number" inputmode="decimal" autocomplete="off" />
              </span>
              <small>* Includes all types of income after tax (salary, self-employment, pension, rent), <strong>excluding benefits</strong>.</small>
              <em v-if="visibleError('monthlyIncome')">{{ visibleError('monthlyIncome') }}</em>
            </label>

            <label>
              <span>Your Employment Status <b>*</b></span>
              <select v-model="applicant.employmentStatus" name="employmentStatus">
                <option value="">Please select one...</option>
                <option>Employed - full time</option>
                <option>Employed - part time</option>
                <option>Self employed</option>
                <option>On benefits</option>
                <option>Retired</option>
              </select>
              <small v-if="applicant.employmentStatus === 'Employed - part time'">
                Warning: you must be earning at least £1,300 from your earned income after tax. We will check this.
              </small>
              <small v-if="applicant.employmentStatus === 'Retired'">
                Warning: you must be earning at least £1,300 from pension and/or pension credit.
              </small>
              <em v-if="visibleError('employmentStatus')">{{ visibleError('employmentStatus') }}</em>
            </label>

            <label>
              <span>First Name <b>*</b></span>
              <input v-model="applicant.firstName" name="firstName" autocomplete="given-name" />
              <em v-if="visibleError('firstName')">{{ visibleError('firstName') }}</em>
            </label>

            <label>
              <span>Last Name <b>*</b></span>
              <input v-model="applicant.lastName" name="lastName" autocomplete="family-name" />
              <em v-if="visibleError('lastName')">{{ visibleError('lastName') }}</em>
            </label>

            <label>
              <span>Date of Birth <b>*</b></span>
              <input v-model="applicant.dob" name="dob" placeholder="DD/MM/YYYY" inputmode="numeric" autocomplete="off" />
              <small>* Applicants must be aged between 21-71</small>
              <em v-if="visibleError('dob')">{{ visibleError('dob') }}</em>
            </label>

            <label>
              <span>Mobile Number <b>*</b></span>
              <input v-model="applicant.mobile" name="mobile" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel" />
              <small>* We'll ask you to verify this later so please make sure you have access to your phone</small>
              <em v-if="visibleError('mobile')">{{ visibleError('mobile') }}</em>
            </label>

            <label>
              <span>Email Address <b>*</b></span>
              <input v-model="applicant.email" name="email" type="email" autocomplete="email" />
              <em v-if="visibleError('email')">{{ visibleError('email') }}</em>
            </label>

            <label>
              <span>Postcode <b>*</b></span>
              <span class="lookup-input">
                <input v-model="applicant.postcode" name="postcode" autocapitalize="characters" autocomplete="postal-code" />
                <button type="button" @click="findAddress">Find</button>
              </span>
              <small>* Enter your postcode, click 'Find' and select your address</small>
              <em v-if="visibleError('postcode')">{{ visibleError('postcode') }}</em>
            </label>

            <label>
              <span>Address Line 1 <b>*</b></span>
              <input v-model="applicant.line1" name="addressLine1" autocomplete="address-line1" />
              <em v-if="visibleError('line1')">{{ visibleError('line1') }}</em>
            </label>

            <label>
              <span>Address Line 2</span>
              <input v-model="applicant.line2" name="addressLine2" autocomplete="address-line2" />
            </label>

            <label>
              <span>Address Line 3</span>
              <input v-model="applicant.line3" name="addressLine3" autocomplete="off" />
            </label>

            <label>
              <span>City <b>*</b></span>
              <input v-model="applicant.city" name="city" autocomplete="address-level2" />
              <em v-if="visibleError('city')">{{ visibleError('city') }}</em>
            </label>

            <label>
              <span>County</span>
              <input v-model="applicant.county" name="county" autocomplete="address-level1" />
            </label>
          </div>

          <div class="check-row">
            <label>
              <input v-model="applicant.acceptTerms" name="acceptTerms" type="checkbox" />
              <span>By continuing, you agree to our use of your information. See how we use it <a href="/privacy-policy/">here</a></span>
            </label>
            <em v-if="visibleError('acceptTerms')">{{ visibleError('acceptTerms') }}</em>
          </div>

          <div class="check-row">
            <label>
              <input v-model="applicant.smsMarketing" name="smsMarketing" type="checkbox" />
              <span>I consent to receive SMS marketing from Loans by Mal about future loan offers. You can opt out at any time.</span>
            </label>
          </div>
        </section>

        <section v-else-if="current.id === 'borrow'" class="single-step">
          <h1>You have been credit check approved to borrow up to £{{ maxLoan.toLocaleString('en-GB') }}.</h1>
          <p>The amount you borrow doesn’t affect your loan being accepted. As long as you can afford the monthly repayments we can pay your money out in the next 24 hours.</p>

          <label class="amount-field">
            <span>Loan Amount <b>*</b></span>
            <span class="money-input">
              <span>£</span>
              <input v-model.number="loan.amount" name="loanAmount" inputmode="numeric" />
            </span>
            <em v-if="visibleError('amount')">{{ visibleError('amount') }}</em>
          </label>

          <fieldset class="choice-field">
            <legend>Loan Term</legend>
            <label v-if="loan.amount >= 3000"><input v-model.number="loan.term" name="loanTerm" type="radio" value="36" /> 36 months</label>
            <label><input v-model.number="loan.term" name="loanTerm" type="radio" value="24" /> 24 months</label>
            <label><input v-model.number="loan.term" name="loanTerm" type="radio" value="18" /> 18 months</label>
            <label><input v-model.number="loan.term" name="loanTerm" type="radio" value="12" /> 12 months</label>
            <label><input v-model.number="loan.term" name="loanTerm" type="radio" value="9" /> 9 months</label>
          </fieldset>

          <div class="repayment-note">
            <strong>Repayment date</strong>
            <p>Your first repayment date will be <b>{{ firstPaymentExample }}</b></p>
            <p>All future payments will be on <b>{{ firstRepaymentDate }}</b></p>
          </div>
        </section>

        <section v-else-if="current.id === 'offer'" class="single-step">
          <h1>Check the loan offer below and continue if you're happy</h1>
          <p>Based on your credit score, we can offer you the following loan, subject to affordability. If you're happy with the offer, continue to the next step and we will aim to pay your loan out in 24hrs<small> (if you're applying on a weekend, we will aim to pay out your loan the next working day)</small></p>

          <dl class="summary-list">
            <div v-for="[label, value] in offerRows" :key="label">
              <dt>{{ label }}</dt>
              <dd>{{ value }}</dd>
            </div>
          </dl>

          <button class="secondary-action" type="button" @click="activeStep = 1">Change Term</button>
          <p>If you're happy with the loan offer, continue and tell us the account you would like the money paid into</p>
        </section>

        <section v-else-if="current.id === 'sign'" class="single-step">
          <h1>Read and Sign</h1>
          <p>Please open and read through all 4 documents below. You need to read and sign the last document called 'Your Loan Agreement'. To do this type your name into the box that says 'Signature of customer' and press 'Accept'. Then click Continue at the bottom of this page.</p>

          <div class="document-list">
            <button
              v-for="doc in docs"
              :key="doc.key"
              type="button"
              :class="{ read: documents[doc.key] }"
              @click="markDocument(doc.key)"
            >
              <span>{{ doc.title }}</span>
              <b>{{ documents[doc.key] ? 'Done' : '*Required' }}</b>
            </button>
          </div>
          <em v-if="visibleError('documents')">{{ visibleError('documents') }}</em>

          <label>
            <span>Signature of customer</span>
            <input v-model="signature" name="signature" :placeholder="applicantName" />
          </label>
          <button class="secondary-action" type="button" @click="acceptAgreement">Accept</button>
          <em v-if="visibleError('signature')">{{ visibleError('signature') }}</em>
        </section>

        <section v-else-if="current.id === 'bank'" class="single-step">
          <h1>You're all signed up and ready to go! We now need to take your payment details</h1>
          <ul class="tick-list compact">
            <li>After your loan is paid out your first repayment will be taken on {{ firstPaymentExample }}</li>
            <li>If you want to change the loan repayment date you can arrange this after your loan is paid out</li>
            <li>Enter the account below that you want us to pay the loan into</li>
            <li>The account you choose must be in your name and where your income is paid</li>
          </ul>

          <h2>Direct Debit Authorisation</h2>
          <p>Your loan repayment date is the <b>1st</b> of each month.</p>

          <div class="field-grid">
            <label>
              <span>Account Holder Name <b>*</b></span>
              <input v-model="bank.accountHolder" name="accountHolder" :placeholder="applicantName" />
              <em v-if="visibleError('accountHolder')">{{ visibleError('accountHolder') }}</em>
            </label>

            <label>
              <span>Sort Code <b>*</b></span>
              <span class="sort-code">
                <input v-model="bank.sort1" name="sortCode1" maxlength="2" inputmode="numeric" />
                <input v-model="bank.sort2" name="sortCode2" maxlength="2" inputmode="numeric" />
                <input v-model="bank.sort3" name="sortCode3" maxlength="2" inputmode="numeric" />
              </span>
              <em v-if="visibleError('sortCode')">{{ visibleError('sortCode') }}</em>
            </label>

            <label>
              <span>Account Number <b>*</b></span>
              <input v-model="bank.accountNumber" name="accountNumber" maxlength="8" inputmode="numeric" />
              <em v-if="visibleError('accountNumber')">{{ visibleError('accountNumber') }}</em>
            </label>
          </div>

          <div class="check-row">
            <label>
              <input v-model="bank.accountHolderConfirmed" name="accountHolderConfirmed" type="checkbox" />
              <span>I confirm that I am the account holder. I am authorised to set up Direct Debit payments on this account</span>
            </label>
            <em v-if="visibleError('accountHolderConfirmed')">{{ visibleError('accountHolderConfirmed') }}</em>
          </div>
          <div class="check-row">
            <label>
              <input v-model="bank.multiAuthoriser" name="multiAuthoriser" type="checkbox" />
              <span>More than one person is required to authorise payments on this account</span>
            </label>
          </div>

          <div class="direct-debit">
            <h3>Instruction to your bank or building society to pay by Direct Debit</h3>
            <dl>
              <div><dt>Service User Number</dt><dd>1 7 9 5 9 0</dd></div>
              <div><dt>Reference</dt><dd>UK0292911</dd></div>
              <div><dt>Date</dt><dd>20/06/2026</dd></div>
            </dl>
            <p>Please Pay GC re LOANS BY MAL Direct Debits from the account detailed in this Instruction subject to the safeguards assured by the Direct Debit Guarantee. I understand that this instruction may remain with GC re LOANS BY MAL and, if so, details will be passed electronically to my bank/building society.</p>
            <h3>The Direct Debit Guarantee</h3>
            <ul>
              <li>This Guarantee is offered by all banks and building societies that accept instructions to pay Direct Debits.</li>
              <li>If there are any changes to the amount, date or frequency of your Direct Debit GoCardless will notify you 3 working days in advance of your account being debited or as otherwise agreed.</li>
              <li>If an error is made in the payment of your Direct Debit, by GoCardless or your bank or building society, you are entitled to a full and immediate refund of the amount paid from your bank or building society.</li>
              <li>You can cancel a Direct Debit at any time by simply contacting your bank or building society. Written confirmation may be required. Please also notify us.</li>
            </ul>
            <p>Direct Debit Payments by GoCardless. Read the <a href="https://gocardless.com/privacy">GoCardless privacy policy</a></p>
          </div>
        </section>

        <section v-else-if="current.id === 'affordability'" class="single-step">
          <h1>Affordability check</h1>
          <div class="field-grid">
            <label>
              <span>Loan Purpose <b>*</b></span>
              <select v-model="affordability.loanPurpose" name="loanPurpose">
                <option value="">Please Select</option>
                <option v-for="option in loanPurposeOptions" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('loanPurpose')">{{ visibleError('loanPurpose') }}</em>
            </label>

            <label>
              <span>Dependants <b>*</b></span>
              <select v-model="affordability.dependants" name="dependants">
                <option value="">Please Select</option>
                <option v-for="count in 11" :key="count - 1">{{ count - 1 }}</option>
              </select>
              <em v-if="visibleError('dependants')">{{ visibleError('dependants') }}</em>
            </label>
          </div>

          <div class="notice-strip">
            <h2>This part is really important!</h2>
            <ul class="tick-list compact">
              <li>Your answers will help us ensure the loan repayments are affordable for you</li>
              <li>We just need to know what you pay towards the total costs below out of your income, not the total spend as a household.</li>
              <li>If you don't pay anything or less than we expect, that's fine, just select a reason why</li>
            </ul>
          </div>

          <div class="field-grid expense-grid">
            <label>
              <span>Monthly Income <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.monthlyIncome" name="affordabilityMonthlyIncome" type="number" /></span>
              <small>* Enter the total amount of income you receive after tax, this includes all types of income except benefits</small>
              <em v-if="visibleError('monthlyIncome')">{{ visibleError('monthlyIncome') }}</em>
            </label>

            <label>
              <span>Your contribution to Rent/Mortgage <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.rent" name="rentContribution" type="number" /></span>
              <select v-model="affordability.rentReason" name="rentReason">
                <option value="">This is less than we expect, please confirm the reason why</option>
                <option v-for="option in lowContributionReasons.rent" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('rent')">{{ visibleError('rent') }}</em>
            </label>

            <label>
              <span>Your contribution to Council Tax <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.councilTax" name="councilTaxContribution" type="number" /></span>
              <select v-model="affordability.councilTaxReason" name="councilTaxReason">
                <option value="">This is less than we expect, please confirm the reason why</option>
                <option v-for="option in lowContributionReasons.councilTax" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('councilTax')">{{ visibleError('councilTax') }}</em>
            </label>

            <label>
              <span>Your contribution to Energy <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.energy" name="energyContribution" type="number" /></span>
              <select v-model="affordability.energyReason" name="energyReason">
                <option value="">This is less than we expect, please confirm the reason why</option>
                <option v-for="option in lowContributionReasons.energy" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('energy')">{{ visibleError('energy') }}</em>
            </label>

            <label>
              <span>Your contribution to Food <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.food" name="foodContribution" type="number" /></span>
              <select v-model="affordability.foodReason" name="foodReason">
                <option value="">This is less than we expect, please confirm the reason why</option>
                <option v-for="option in lowContributionReasons.food" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('food')">{{ visibleError('food') }}</em>
            </label>

            <label>
              <span>Your contribution to Media <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.media" name="mediaContribution" type="number" /></span>
              <select v-model="affordability.mediaReason" name="mediaReason">
                <option value="">This is less than we expect, please confirm the reason why</option>
                <option v-for="option in lowContributionReasons.media" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('media')">{{ visibleError('media') }}</em>
            </label>

            <label>
              <span>Your contribution to Clothing <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.clothing" name="clothingContribution" type="number" /></span>
              <select v-model="affordability.clothingReason" name="clothingReason">
                <option value="">This is less than we expect, please confirm the reason why</option>
                <option v-for="option in lowContributionReasons.clothing" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('clothing')">{{ visibleError('clothing') }}</em>
            </label>
          </div>

          <fieldset class="choice-field">
            <legend>Do you pay towards transport costs?</legend>
            <label><input v-model="affordability.transport" name="transportCosts" type="radio" value="Yes" /> Yes</label>
            <label><input v-model="affordability.transport" name="transportCosts" type="radio" value="No" /> No</label>
            <em v-if="visibleError('transport')">{{ visibleError('transport') }}</em>
          </fieldset>

          <div class="field-grid expense-grid">
            <label v-if="affordability.transport !== 'No'">
              <span>Your contribution to Vehicle running costs <b>*</b></span>
              <span class="money-input"><span>£</span><input v-model="affordability.vehicle" name="vehicleContribution" type="number" /></span>
              <select v-model="affordability.vehicleReason" name="vehicleReason">
                <option value="">This is less than we expect, please confirm the reason why</option>
                <option v-for="option in lowContributionReasons.vehicle" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('vehicle')">{{ visibleError('vehicle') }}</em>
            </label>

            <label>
              <span>Buses, trains, taxis</span>
              <span class="money-input"><span>£</span><input v-model="affordability.publicTransport" name="publicTransportContribution" type="number" /></span>
              <select v-model="affordability.publicTransportReason" name="publicTransportReason">
                <option value="">This is less than we expect, please confirm the reason why</option>
                <option v-for="option in lowContributionReasons.publicTransport" :key="option">{{ option }}</option>
              </select>
              <em v-if="visibleError('publicTransport')">{{ visibleError('publicTransport') }}</em>
            </label>
          </div>

          <div class="check-row">
            <label>
              <input v-model="affordability.acceptTerms" name="affordabilityAcceptTerms" type="checkbox" />
              <span>I can confirm nothing is due to happen that could impact the income I receive, or cause my spending to increase, while I'm repaying the loan <b>*</b></span>
            </label>
            <em v-if="visibleError('affordabilityTerms')">{{ visibleError('affordabilityTerms') }}</em>
          </div>
        </section>

        <section v-else-if="current.id === 'card'" class="single-step">
          <h1>Repaying your loan</h1>
          <p>Please provide a debit card as a back-up payment method, should your Direct Debit ever fail</p>
          <ul class="tick-list compact">
            <li>We'll only attempt your card in the event your Direct Debit is unsuccessful</li>
            <li>The card must be in your name and we can't accept credit cards</li>
            <li>Once added, we won't be able to access or see your card details, the information is safe and encrypted</li>
          </ul>

          <h2>Card Payment Details</h2>
          <div class="field-grid">
            <label>
              <span>Card Number <b>*</b></span>
              <input v-model="card.number" name="cardNumber" inputmode="numeric" />
              <em v-if="visibleError('cardNumber')">{{ visibleError('cardNumber') }}</em>
            </label>
            <label>
              <span>Expiry Date <b>*</b></span>
              <input v-model="card.expiry" name="cardExpiry" placeholder="MM/YY" />
              <em v-if="visibleError('expiry')">{{ visibleError('expiry') }}</em>
            </label>
            <label>
              <span>CVV <b>*</b></span>
              <input v-model="card.cvv" name="cardCvv" inputmode="numeric" />
              <em v-if="visibleError('cvv')">{{ visibleError('cvv') }}</em>
            </label>
            <label>
              <span>Name as it appears on the card <b>*</b></span>
              <input v-model="card.name" name="cardName" :placeholder="applicantName" />
              <em v-if="visibleError('cardName')">{{ visibleError('cardName') }}</em>
            </label>
            <label>
              <span>Issue Number (Maestro only)</span>
              <input v-model="card.issueNumber" name="issueNumber" />
            </label>
          </div>

          <p>If you are having difficulties verifying your card, when the 60 second timer has finished, please use the skip button</p>
          <button class="secondary-action" type="button" @click="skipCard">Skip To Next Step</button>
        </section>

        <section v-else-if="current.id === 'openBanking'" class="single-step open-banking">
          <h1>Last step, this bits's really fast!</h1>
          <p>We need to verify the bank account you want your loan paid into. This must be the account your income is paid into. Please click continue and follow the instructions. As soon as you have verified your bank account you will have finished your loan application.</p>
          <ul class="tick-list compact">
            <li>Simply click Continue and follow the prompts</li>
            <li>Supporting information is sent instantly and securely</li>
            <li>Fully encrypted</li>
          </ul>
          <p>Consents.Online is powered by <a href="https://www.openbanking.org.uk/why-open-banking-is-safe/">OpenBanking</a>, a free and secure service, which keeps you safe when sharing banking transaction data. We will not have access to your money, and cannot make changes to your account. It's safe and secure. <a href="https://www.openbanking.org.uk/why-open-banking-is-safe/">Find out more</a></p>
          <p><strong>Trusted and integrated with most major banks</strong></p>
          <div class="bank-grid" aria-hidden="true">
            <span>Bank</span><span>Building Society</span><span>Open Banking</span><span>Secure</span>
          </div>
        </section>

        <section v-else class="single-step open-banking">
          <h1>Congratulations you've completed your application</h1>
          <p>You now need to verify the bank account that you want us to pay the money into. The account needs to be a UK bank account in your name. This should also be the account your salary is paid into.</p>
          <button class="primary-action" type="button">VERIFY MY ACCOUNT</button>
          <p>If you have any problems verifying your account, don’t worry, our customer support team will be in touch to help you.</p>
          <p>Once you’ve connected your account we’ll complete our final checks and payout the money within 24 hours.</p>
          <ul class="tick-list compact">
            <li>Safe and Secure Check</li>
            <li>We've helped over 40,000 people</li>
            <li>2000+ Customers Rate Us Excellent</li>
          </ul>
        </section>

        <div class="actions-row">
          <button v-if="activeStep > 0" class="secondary-action" type="button" @click="previousStep">Back</button>
          <button v-if="activeStep < steps.length - 1" class="primary-action" type="submit">Continue</button>
        </div>
      </form>
    </section>

    <footer class="application-footer">
      <div class="customer-reviews">Customer Reviews</div>
      <p>
        <strong>loans by mal</strong> is the trading name of Monthly Advance Loans Limited. Authorised and regulated by the Financial Conduct Authority (firm reference 912359). Monthly Advance Loans Limited is a consumer credit lender not a broker.
      </p>
      <nav aria-label="Application footer">
        <a href="/faq/">FAQs</a>
        <a href="/contact/">Contact us</a>
        <a href="/privacy-policy/">Privacy Policy</a>
        <a href="/terms-and-conditions/">Terms &amp; Conditions</a>
        <a href="/complaints/">Complaints</a>
      </nav>
      <small>Version 1.237.4</small>
    </footer>

    <div v-if="addressModalOpen" class="modal-backdrop" role="presentation">
      <div class="address-modal" role="dialog" aria-modal="true" aria-labelledby="address-title">
        <header>
          <h2 id="address-title">Select Address</h2>
          <button type="button" aria-label="Close" @click="addressModalOpen = false">×</button>
        </header>
        <select name="addressLookup">
          <option>Select an option</option>
          <option>Buckingham Palace, London SW1A 1AA</option>
          <option>Court Post Office Buckingham Palace, London SW1A 1AA</option>
          <option>Lord Chamberlains Office Buckingham Palace, London SW1A 1AA</option>
        </select>
        <footer>
          <button class="secondary-action" type="button" @click="enterAddressManually">Enter Manually</button>
          <button class="primary-action" type="button" @click="selectAddress">Select Address</button>
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
