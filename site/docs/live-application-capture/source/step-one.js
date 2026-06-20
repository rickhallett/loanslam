// =============================================================================
// Constants
// =============================================================================

const NAME_REGEX = /^(?=.*[A-Za-z\-'])[A-Za-z\-'\s]+$/;
const INCOME_REGEX = /^\d+(\.\d{1,2})?$/;
const MOBILE_REGEX = /^07\d{9}$/;
// Permissive structural email check; backend is the source of truth.
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
const POSTCODE_REGEX = /^([A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/i;
const DOB_REGEX = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
const ADDRESS_LINE_REGEX = /^[A-Za-z0-9\s\-#,'.]+$/;

const MIN_MONTHLY_INCOME = 1300;
const HIGH_MONTHLY_INCOME_WARNING = 7000;
const MIN_AGE_YEARS = 21;
const MAX_AGE_YEARS = 75;
const OTP_MAX_ATTEMPTS = 3;

const AUTOCOMPLETE_MIN_CHARS = 2;
const AUTOCOMPLETE_MAX_RESULTS = 50;

const ADDRESS_FIND_URL = "https://api.addressy.com/Capture/Interactive/Find/v1.10/json3.ws?Key=RW89-DN21-TM68-YU48&IsMiddleware=false&Origin=&Countries=GB&Limit=&Language=&Bias=false&Filters=&GeoFence=";
const ADDRESS_RETRIEVE_URL = "https://services.postcodeanywhere.co.uk/Capture/Interactive//Retrieve/v1.00/json3ex.ws?Container=&Origin=GBR&Countries=&Datasets=&Limit=7&Filter=&Language=en&Key=RW89-DN21-TM68-YU48";

const ADDRESS_LINE_FIELDS = ['line1', 'line2', 'line3', 'line4', 'line5'];

// =============================================================================
// HTML templates
// =============================================================================

const dropdownOptionTemplate = `<option value="%StatusValue%">%Status%</option>`;

const addressPickerTemplate = `
<div class="row mt-4">
	<div class="col-1"></div>
	<div class="col-10">
		<select id="AddressList" class="form-select">
			%options%
		</select>
	</div>
	<div class="col-1"></div>
</div>
`;

const validateCodeSmsTemplate = `
<div class="row mb-3">
	<h4>Please enter the code we've sent to your mobile number via SMS.</h4>
</div>
<div class="row">
	<input id="enterCodeSMS" class="form-control mb-1" autocomplete="on" maxlength="6">
	<p id="smsCodeErrorMessage" style="color:red; padding-left:0;" class="mb-1"></p>
	<button id="btnConfirmCodeSMS" class="btn btn-primary" onclick="validateCodeSMS()">Confirm Code</button>
</div>
<div class="row mt-4"><p>Please note, failing to verify your mobile & email means you are not eligible for our 'Speedy Payout'. This can delay the releasing of your funds by up to <b>24 working hours</b>.</p></div>
`;

const validateCodeEmailTemplate = `
<div class="row mb-3">
	<h4>Please enter the code we've sent to your email address.</h4>
</div>
<div class="row">
	<input id="enterCodeEmail" class="form-control mb-1" autocomplete="on" maxlength="6">
	<p id="emailCodeErrorMessage" style="color:red; padding-left:0;" class="mb-1"></p>
	<button id="btnConfirmCodeEmail" class="btn btn-primary" onclick="validateCodeEmail()">Confirm Code</button>
</div>
<div class="row mt-4"><p>Please note, failing to verify your mobile & email means you are not eligible for our 'Speedy Payout'. This can delay the releasing of your funds by up to <b>24 working hours</b>.</p></div>
`;

const termsTemplate = `<div>
<h3 class="primary-message-text">How we use your information</h3>
<div class="modal-body">
<div class="h5 mt-3">Who we are</div>
<p>We are Monthly Advance Limited Registered Company Number: 12070468
<br>Registered under the Data Protection Act 2018 with the Information Commissioner’s Office: Registration Number: ZA553679
<br>FCA Registration number: 912359</p>

<p>We are a Data Controller and responsible for the personal information we collect about you.<br>
If personal information is not provided to us through our Website or from a Third Party we will not be able to offer you any of our products.</p>



<div class="h5 mt-5">How we use your information</div>
<p>We are committed to protecting and respecting your privacy. We know that you care about how your information is used and shared and we appreciate your trust in us to do that carefully and sensibly.  This notice describes our privacy policy and forms part of our website terms and conditions (“Website Terms”). </p>
<p>We believe it is important to protect your Personal Data (as defined in the UK GDPR/Data Protection Act 2018) and we are committed to giving you a personalised service that meets your needs in a way that also protects your privacy.  This policy explains how we may collect Personal Data about you and how we use it.  It also explains some of the security measures we take to protect your Personal Data and tells you certain things we will do and not do.</p>

<div class="h5 mt-5">What personal information we collect and when and why we use it</div>
<p>Information we collect includes (but is not limited to):</p>
<ul>
  <li>Customer pay amount</li>
  <li>Customer employer name</li>
  <li>Customer employer job title</li>
  <li>Customer employer time at</li>
  <li>Customer income source</li>
  <li>Customer employer pay frequency</li>
  <li>Customer employer payment type</li>
  <li>Customer age</li>
  <li>Customer title</li>
  <li>Customer number of dependants</li>
  <li>Customer home telephone</li>
  <li>Customer mobile telephone</li>
  <li>Customer work telephone</li>
  <li>Time at address</li>
  <li>Residential status</li>
  <li>Postcode</li>
  <li>Time at bank</li>
  <li>Bank account type</li>
  <li>Bank card type</li>
  <li>CRA information;</li>
  <li>Loan outcome data</li>
  <li>Any sensitive information you share with us.</li>
</ul>

<p>We collect Personal Data from you:</p>
<ul>
  <li>When you apply for a product from us through our website. </li>
  <li>When you contact us, or if you have replied to a communication from us. </li>
  <li>When you submit a form either on our website from a third-party website or social media platform.</li>
  <li>When you submit a feedback form via our email, telephone, or our online contact us form.</li>
  <li>Through Cookies on our website that provide us with website usage information.  We use cookies as described in the section “INFORMATION ABOUT OUR USE OF COOKIES” below.</li>
  <li>If a third party sells your data to us.</li>
  <li>When we use Credit Reference Agencies and other third parties to verify your information.</li>
  <li>We may record telephone calls for training, monitoring, compliance and security purposes.</li>
</ul>

<p>We may use your data in the following ways:</p>
<ul>
  <li>We can find the most appropriate product for you.</li>
  <li>We can verify your identity when you contact us.</li>
  <li>We can identify accounts, services and products you may have from us. </li>
  <li>We can access your credit history.</li>
  <li>We can process your application. </li>
  <li>We can assess your affordability for the product.</li>
  <li>We can offer you other products. </li>
  <li>We can improve your account administration.</li>
  <li>We can undertake marketing analysis, credit strategy and customer profiling.</li>
  <li>We can continue to market to you with relevant offers. </li>
  <li>We can identify and prevent consumer vulnerability. </li>
  <li>We can manage your account as and when needed. </li>
  <li>It can help us prevent and detect fraud and loss.</li>
  <li>We can confirm with your bank or financial institutions the accuracy of your data.</li>
  <li>We can manage risk and prevent crime; and</li>
  <li>It will improve our business overall and develop better ways we can serve our customers.</li>

</ul>

<div class="h5 mt-5">Examples of how we are using your data</div>
<p>Below are examples of how we may use your data in practice:</p>
<ol>
  <li>Before we provide services or financing to you, we undertake checks for the purposes of preventing fraud and money laundering and to verify your identity. These checks require us to process personal data about you.</li>
  <li>Processing your loan application: for example, by assessing your creditworthiness and the sustainable affordability of the loan instalments throughout the loan term. If you have any doubts about the loan affordability for you, you should tell us and not proceed with the application.</li>
  <li>Internal record keeping: for example, so we can ensure we keep in contact and are aware of any issues or changes concerning your personal or financial circumstances which may be relevant to our servicing of your loan account or collections we make for you.</li>
  <li>Carrying out credit and identity checks including with one or more of the CRAs (as described in more detail below) including for query or complaint handling after your account has been settled.</li>
  <li>Assessing your creditworthiness and whether you can sustainably afford to repay the loan, verifying the accuracy of the data you have provided to us and managing your payment obligations to us.</li>
  <li>Servicing and management of your loan account and our services to you: for example to provide a copy of Pre-Contract information, your Executed Credit Agreement (once the loan has been issued), annual statements, payment reminders, arrears management and query or complaint handling (including after your account has been settled).</li>
  <li>Improving our products and services for our customers: for example, by learning from our interaction with prospective and actual customers what is helpful and what is unhelpful in their online experience and our dealings (and those of our commercial partners (such as income verification service providers)) with customers so we can develop and improve the customer experience and develop customer and brand loyalty.</li>
  <li>We may contact you by electronic means, email, phone, SMS text message, fax or mail for the purposes listed in this policy and otherwise where necessary in relation to our services.</li>
  <li>We may contact you to re-engage with you where you have visited our site or received a loan quotation but not proceeded with that loan. This may include posting banner advertisements as you browse the internet or use your social media accounts.</li>
  <li>Depending on your preferences, we may periodically send you promotional emails, SMS or mail about new credit products or services, special offers or other information of ours, our affiliates, branded product providers or selected trusted third parties which we consider may be appropriate to your circumstances and that you may find interesting, using the email address or SMS contact details or postal address which you have provided.</li>
  <li>We may use the information to customise our website according to your interests.</li>
  <li>From time to time, we may also use your information to contact you for market research purposes.</li>

</ol>



<div class="h5 mt-5">Sharing your personal information</div>
<p>The following persons may have access to your information:</p>
<ul>
  <li>all our staff;</li>
  <li>third parties including police. government or regulatory agencies should they request it; </li>
  <li>if any officials request it for legal proceedings.</li>
  <li>credit brokers or affiliates – if we sell your data.</li>
  <li>if our company and all of its assets are bought by a third party your personal data will also be transferred to this third party.</li>
  <li>if we need to pass on personal data to others who offer administration services, marketing information , legal and compliance services and customer services; </li>
  <li>Credit Reference Agencies; and</li>
  <li>Debt collectors or law firms if you fall behind with payments to us.</li>
</ul>

<p>Examples of why we may pass your data to someone else are:</p>
<ol>
  <li>We may pass your information to: other companies within our group or affiliates, branded product providers or selected trusted third parties where such disclosure is necessary to provide you with our services or to manage our business; for our internal funding arrangement; our funders; your broker or any third party who introduces you to us; or any operator or provider of our site or any linked site; third parties who help manage our business and deliver services (these include IT service providers who help manage our IT and back office systems, our payment services providers and banks and our loans servicing and administration suppliers); debt collection and tracing agencies; any party to which we sell, transfer or assign our rights; CRAs and fraud prevention agencies; where necessary to other people or third parties who provide a service to us or act on our behalf.</li>
  <li>We may also share your information for crime, fraud and money laundering prevention and the apprehension and prosecution of offenders, or if we have a duty to do so or are required by law. To comply with all applicable laws, regulations and rules, and requests of law enforcement, regulatory and other governmental agencies we may share your information with our regulators, which may include the Financial Conduct Authority or Information Commissioner's Office and governmental agencies such as the Financial Ombudsman Service.</li>
  <li>We and fraud prevention agencies may also enable law enforcement agencies to access and use this information to detect, investigate and prevent crime. Please contact us at 01202 122699 if you want to receive details of the relevant fraud prevention agencies. We and other organisations may access and use from other countries the information recorded by fraud prevention agencies.</li>
  <li>We may share your data with our affiliates, branded product providers or selected trusted third parties to provide you with information about other credit products or services which they offer and may be of interest to you.</li>
  <li>We and other organisations may also access and use this information to check your identity and to prevent fraud and money laundering, for example, when: checking details on applications for credit and credit related or other facilities; managing credit and credit related accounts or facilities; tracing debtors and recovering debt; checking details on proposals and claims for all types of insurance; checking details of job applications and employees; and for any other purpose for which you give your agreement.</li>
  <li>We may share in aggregate, statistical form, non-personal information regarding the visitors to our website, traffic patterns, and website usage with our partners, affiliates, branded product providers or selected trusted third parties or advertisers.</li>
  <li>If, in the future, we sell or transfer some or all of our business assets or loans to a third party, we may disclose information to a potential or actual third party purchaser of our business assets or loans.</li>
</ol>


<div class="h5 mt-5">Sharing data with credit reference agencies</div>
<p>
  When you apply for a loan with us, you confirm that the information you've provided is accurate. We'll contact the Credit Reference Agencies (CRAs) and fraud prevention agencies to assess your credit status and detect fraud as required by law. After approval, we may periodically check CRAs and fraud prevention agencies to manage your payment obligations and assess your credit status.
</p>
<p>
  As part of our initial application process, we will carry out an initial ‘Soft credit check’. This entails a quick and non-impactful examination of your credit report. Only you can see these soft inquiries. Should your loan application be successful and your loan paid out, we would report a ‘Hard credit check’ and the issuing of the loan to the Credit Reference Agencies. A hard enquiry will appear on your credit file and can lower your credit score, though it is one of the less influential credit score factors. Repaying your loan on time will benefit both your credit rating and the financial options available to you in the future.
</p>
<p>
  We would always recommend customers complete their own research into the difference between a soft and hard enquiry and only apply for a loan if they’re happy with any potential impact these searches can have. Please also be aware that multiple applications in a short time may impact your credit eligibility.
</p>
<p>
  We use credit scoring and automated decision-making systems in the application process. CRAs provide public information, shared credit data, financial history, and fraud prevention information. Law enforcement agencies may also access this data.
</p>
<p>
  We'll continue sharing information with CRAs throughout our relationship, including settling accounts. Unsettled debts may be recorded by CRAs and shared with other organisations.
</p>
<p>
  If you provide us with information for a spouse or financial associate, your records will be linked. It's important to discuss this with them before applying. CRAs will also link your records, and these links can be dissolved by filing for disassociation with the CRAs.
</p>

<br>
<p>For more details on CRAs, their role, the data they hold, and your rights, refer to the following links:</p>
<p>
  TransUnion: <a href="https://www.transunion.co.uk/crain" target="_blank">www.transunion.co.uk/crain</a><br>
  Equifax: <a href="https://www.equifax.co.uk/crain" target="_blank">www.equifax.co.uk/crain</a><br>
  Experian: <a href="https://www.experian.co.uk/crain" target="_blank">www.experian.co.uk/crain</a><br>
</p>


<div class="h5 mt-5">Sharing of Data with third parties</div>
<p>We currently share your data with the third parties below:</p>
<ul>
  <li>Aryza UK Services Limited (loan management system)</li>
  <li>AccountScore Limited (Open Banking provider)</li>
  <li>Clear Score Technology Limited (introducer)</li>
  <li>Choose Wisely Limited (introducer)</li>
  <li>Freedom Finance Limited (introducer)</li>
  <li>Monevo Limited (introducer)</li>
  <li>Tiger Lion Financial Limited (LoanTube) (introducer)</li>
  <li>TransUnion International UK Limited (CallValidate service)</li>
  <li>Decimal Cloud Technologies Limited (development and engineering service)</li>
  <li>Any third party you select to work on your behest once the loan has been issued</li>

</ul>

<div class="h5 mt-5">The legal basis for using your personal information</div>

<p>We will only collect, obtain, use and share your personal information where we are satisfied that we have an appropriate legal basis to do this. This may be because:</p>

<ol>
  <li>our use of your personal information is necessary to take steps to enter into a contract with you or perform a contract: for example, to assess your creditworthiness and sustainable affordability of any credit obligations you may undertake, or to conclude a loan agreement with you;</li>
  <li>
	our use of your personal information is necessary to comply with a relevant legal or regulatory obligation that we have: for example, to discharge our obligations to lend to you responsibly including to assess your creditworthiness and/or conduct searches with CRAs. CRA searches may be conducted to investigate any query or complaint you have raised and your personal information may be supplied to the CRAs to ensure accurate reporting;
  </li>
  <li>
	our use of your personal information is in our legitimate interest as a commercial organisation: for example:
	<ol>
	  <li>to prevent fraud and money laundering, and to verify identity, in order to protect our business and to comply with the laws that apply to us. Such processing is also a contractual requirement of the services or financing you have requested.</li>
	  <li>to market our credit products to you in certain circumstances; or</li>
	  <li>to make improvements to our products and services.</li>
	</ol>
	<br>
	In these cases we will look after your information at all times in a way that is proportionate and respects your privacy rights and you have a right to object to processing as explained in the "Your Legal Rights" section below;
  </li>
  <li>
	you have provided your consent to us or a service provider using the personal information: for example, in relation to certain of our electronic direct marketing activities.
  </li>

</ol>

<p>
  Additionally, we will look for your consent to process personal information in relation to your health. This will only be in circumstances where you choose to share this information with us to help us understand your circumstances and appropriately manage your account. This will be used for no other purposes than managing your account and for training and quality purposes.
</p>


<p>If you would like to find out more about the legal basis by which we process personal information please contact us at <a href="mailto:hello@loansbymal.co.uk">hello@loansbymal.co.uk </a> </p>




<div class="h5 mt-5">Explaining more about direct marketing, cookies and automated decision making</div>
<p>In this section you can find out more about:</p>
<ol>
  <li>how we use personal information to keep you up to date with our products and services;</li>
  <li>how you can manage your marketing preferences</li>
  <li>when and how we undertake profiling and analytics</li>
  <li>when and how we carry out automated decision making</li>
</ol>

<div class="h5 mt-5">How we use personal information to keep you up to date with our products and services</div>
<p>As mentioned above we may use your personal information to let you know about products and services that we believe will be of interest to you. We may contact you by email, post, or telephone or through other communication channels that we think you may find helpful for a limited time after you have taken a product from us or where you have indicated that you would like further information from us. In all cases, we will respect your preferences for how you would like us to manage marketing activity with you.</p>

<div class="h5 mt-5">How you can manage your marketing preferences</div>
<p>To protect privacy rights and to ensure you have control over how we manage marketing with you:</p>
<ol>
  <li>we will take steps to limit direct marketing to a reasonable and proportionate level and only send you communications which we believe may be of interest or relevance to you;</li>
  <li>whenever you are asked to fill in a form on our site, you can look for the box that you can click to indicate that you do not want the information to be used by anybody for marketing purposes;</li>
  <li>you can ask us to stop direct marketing at any time — you can ask us to stop sending email marketing, by following the 'unsubscribe' link you will find on all the email marketing messages we send you. Alternatively you can contact us at hello@loansbymal.co.uk . Please specify whether you would like us to stop all forms of marketing or just a particular type (eg email).</li>
  <li>you can change the way your browser manages cookies, which may be used to deliver online advertising, by following the settings on your browser as explained in our Cookie Policy, which can be found in the section “INFORMATION ABOUT OUR USE OF COOKIES”.</li>
</ol>

<p>We recommend you routinely review the privacy notices and preference settings that are available to you on any social media platforms.</p>


<div class="h5 mt-5">When and how we carry out automated decision making</div>
<p>As described above, we will use a credit scoring or a number of other automated decision-making systems when assessing your application. These automated processes are used to assess your creditworthiness and whether you can sustainably afford to repay the loan, and inform our decision about whether or not to proceed with your application. We may automatically decide that you pose a fraud or money laundering risk if our processing reveals your behaviour to be consistent with money laundering or known fraudulent conduct, or is inconsistent with your previous submissions, or you appear to have hidden your true identity. These processes make use of information which you provide to us directly and that information which we collect from third parties (including from CRAs) and includes a combination of information about your personal and financial status. For more information about how you can exercise your rights in relation to these automated processes please see the "Your Legal Rights" section below.</p>


<p>If we, or fraud prevention agencies, determine that you pose a fraud or money laundering risk, we may refuse to provide the services or financing you have requested, or to employ you, or we may stop providing existing services to you.</p>
<p>A record of any fraud or money laundering risk will be retained by the fraud prevention agencies, and may result in others refusing to provide services, financing or employment to you. If you have any questions about this, please see Contact Us below.</p>

<div class="h5 mt-5">Transferring personal information outside the United Kingdom</div>
<p>Your personal information may be transferred and stored in countries outside the United Kingdom, including the European Economic Area (the “EEA”) and/or the United States, that may be subject to different standards of data protection. We will take appropriate steps to ensure that transfers of personal information are: in accordance with applicable law; carefully managed to protect your privacy rights and interests; and limited to countries (this is expected to include the EEA) which are recognised by the UK as providing an adequate level of legal protection or where we can be satisfied that alternative arrangement are in place to protect your privacy rights. To this end where we transfer your personal information to third parties who help provide our products and services, we obtain contractual commitments from them to protect your personal information to the UK standards, unless we are legally permitted to transfer your personal information, for example if the transfer is necessary for the establishment, exercise or defence of legal claims.</p>
<p>You have a right to contact us for more information about the safeguards we have put in place (including a copy of relevant contractual commitments) to ensure the adequate protection of your personal information when this is transferred as mentioned above.</p>

<div class="h5 mt-5">How we protect and store your information</div>
<p>We have implemented and maintain appropriate technical and organisational security measures, policies and procedures designed to reduce the risk of accidental destruction or loss, or the unauthorised disclosure or access to such information appropriate to the nature of the information concerned. Measures we take include placing confidentiality requirements on our staff members and service providers; destroying or permanently anonymising personal information if it is no longer needed for the purposes for which it was collected. As the security of information depends in part on the security of the computer you use to communicate with us and the security you use to protect User IDs and passwords please take appropriate measures to protect this information.</p>
<p>We will store your personal information for as long as is reasonably necessary for the purposes for which it was collected, as explained in this notice. In some circumstances we may store your personal information for longer periods of time, for instance where we are required to do so in accordance with legal, regulatory, tax, and/or accounting requirements.</p>
<p>Fraud prevention agencies can hold your personal information for different periods of time, and if you are considered to pose a fraud or money laundering risk, your information may be held by such agencies for six years.</p>

<div class="h5 mt-5">Your legal rights</div>
<p>Subject to certain exemptions, and in some cases dependent upon the processing activity we are undertaking, you have certain rights in relation to your personal information. These rights are:-</p>

<ol>
  <li>To be informed about your information</li>
  <li>To access personal information</li>
  <li>To correct  personal information</li>
  <li>To erase personal information</li>
  <li>To restrict the processing of your personal information</li>
  <li>To transfer your personal information</li>
  <li>To object to the processing of personal information</li>
</ol>

<p>We may ask you for additional information to confirm your identity and for security purposes, before disclosing the personal information requested to you. We reserve the right to charge a fee where permitted by law, for instance if your request is manifestly unfounded or excessive.</p>

<p>You can exercise your rights by contacting us, see Contact Us below. Subject to legal and other permissible considerations, we will make every reasonable effort to honour your request promptly or inform you if we require further information in order to fulfil your request.</p>
<p>
  We may not always be able to fully address your request, for example if it would impact the duty of confidentiality we owe to others, or if we are legally entitled to deal with the request in a different way.
</p>

<div class="h5 mt-5">Right to be informed about your information</div>
<p>You have a right to be informed if we are using your personal data.</p>


<div class="h5 mt-5">Right to access personal information</div>
<p>You have a right to request that we provide you with a copy of your personal information that we hold and you have the right to be informed of; (a) the source of your personal information; (b) the purposes, legal basis and methods of processing; (c) the data controller's identity; and (d) the entities or categories of entities to whom your personal information may be transferred.</p>

<div class="h5 mt-5">Right to rectify personal information</div>
<p>You have a right to request that we rectify inaccurate personal information. We may seek to verify the accuracy of the personal information before rectifying it.</p>

<div class="h5 mt-5">Right to erase personal information</div>
<p>Subject to the paragraph above, you can also request that we erase your personal information in limited circumstances where:</p>
<ul>
  <li>it is no longer needed for the purposes for which it was collected; or</li>
  <li>you have withdrawn your consent (where the data processing was based on consent); or</li>
  <li>following a successful right to object (see Right to Object below); or</li>
  <li>it has been processed unlawfully; or</li>
  <li>to comply with a legal obligation to which we are subject.</li>

</ul>

<p>We are not required to comply with your request to erase personal information if the processing of your personal information is necessary:</p>

<ul>
  <li>for compliance with a legal obligation; or</li>
  <li>for the establishment, exercise or defence of legal claims.</li>
  <li>Where we have a legitimate interest to retain (see “The legal basis for using your personal information” above).</li>
</ul>

<div class="h5 mt-5">Right to restrict the processing of your personal information</div>
<p>You can ask us to restrict your personal information, but only where:</p>
<ul>
  <li>its accuracy is contested, to allow us to verify its accuracy; or</li>
  <li>the processing is unlawful, but you do not want it erased; or</li>
  <li>it is no longer needed for the purposes for which it was collected, but we still need it to establish, exercise or defend legal claims; or</li>
  <li>you have exercised the right to object, and verification of overriding grounds is pending.
  We can continue to use your personal information following a request for restriction, where:</li>
  <li>we have your consent; or</li>
  <li>to establish, exercise or defend legal claims; or</li>
  <li>to protect the rights of another natural or legal person.</li>

</ul>


<div class="h5 mt-5">Right to transfer your personal information</div>
<p>You can ask us to provide your personal information to you in a structured, commonly used, machine-readable format, or you can ask to have it transferred directly to another data controller, but in each case only where:</p>
<ul>
  <li>the processing is based on your consent or on the performance of a contract with you; and</li>
  <li>the processing is carried out by automated means.</li>

</ul>

<div class="h5 mt-5">Right to object to the processing of your personal information</div>
<p>You can object to any processing of your personal information which has our legitimate interests as its legal basis, if you believe your fundamental rights and freedoms outweigh our legitimate interests.</p>
<p>If you raise an objection, we have an opportunity to demonstrate that we have compelling legitimate interests which override your rights and freedoms.</p>

<div class="h5 mt-5">Right to human intervention</div>
<p>When you apply for a loan we will use an automated decision process to decide whether to lend to you. If we decline your application, you can ask one of our underwriters to review the decision.</p>

<div class="h5 mt-5">Complaint with the Information Commissioner’s Office</div>
<p>You can lodge a complaint with the Information Commissioner's Office which regulates the processing of personal data in the UK if you have concerns about how we are processing your personal information.</p>
<p>We ask that you please attempt to resolve any issues with us first, although you have a right to contact the Information Commissioner's Office at any time.</p>
<p>The Information Commissioner's Office can be contacted on 0303 123 1113 or via other methods of communication as explained on their website (currently <a href="https://ico.org.uk" target="_blank">https://ico.org.uk</a> ). We ask that you please attempt to resolve any issues with us first.</p>



<div class="h5 mt-5">Contact us</div>
<p>The primary point of contact for all issues arising from this privacy notice, is our Compliance Department who can be reached at <a href="mailto:hello@loansbymal.co.uk">hello@loansbymal.co.uk </a> or by writing to us at Loans By Mal, Exeter Park Road, Bournemouth, BH2 5BD</p>

<p>If you have any questions, concerns or complaints regarding our compliance with this policy and the data protection laws, or if you wish to exercise your rights, we encourage you to first contact us. We will investigate and attempt to resolve complaints and disputes and will make every reasonable effort to honour your wish to exercise your rights as quickly as possible and in any event, within the timescales provided by data protection laws.</p>

<div class="h5 mt-5">Links to other sites</div>
<p>Our site may contain links to other sites of interest. However, once you have used these links to leave our site, you should note that we do not have any control over that other site. Therefore, we cannot be responsible for the protection and privacy of any information which you provide whilst visiting such sites and such sites are not governed by this privacy policy. You should exercise caution and look at the privacy policy applicable to the site in question.</p>

<div class="h5 mt-5">Cookie Policy</div>
<div class="h5 mt-3">What is a cookie?</div>
<p>A cookie is a small file stored on your computer that is used to store information about your use of a website and preferences. As an example, when you set your cookie preferences for Loans by MAL, they are stored in a consent cookie so that when you return you are not asked again.</p>
<p>Each cookie can be stored on your browser for a different length of time, ranging from just a session to several years.</p>

<div class="h5 mt-5">Your cookie settings</div>
<div class="h5 mt-3">Essential cookies (required)</div>
<p>Essential cookies are used so that Loans by MAL's website functions properly for you.</p>
<div class="h5 mt-5">Purpose</div>
<p>These cookies are used to remember your individual site settings, help with security, and analyse data about web traffic.</p>
<p>Every time you visit our site we log your IP (Internet Protocol) address. This is used to help Loans by MAL monitor site usage and, in the case of possible criminal activity or misuse of our information, to cooperate with law enforcement agencies.</p>

<div class="h5 mt-5">Analytics cookies</div>
<p>Loans by MAL use analytics cookies to collect site usage data. This helps to show us where our site causes users problems. We use this data to make improvements to our site and check that the problems have been solved.</p>

<p>The two analytics services Loans by MAL use are Google Analytics and Crazy Egg. Both of these services are set up so that none of your personally identifiable data is collected.</p>

<div class="h5 mt-5">Purpose</div>
<p>Analytics cookies collect anonymous information about our website usage. This information is used to help us improve the website for our users. These cookies are all configured so that no personal information is captured.</p>
<p>The analytics packages that Loans by MAL uses are Google Analytics and Crazy Egg.</p>

<div class="h5 mt-5">Marketing cookies</div>
<p>Loans by MAL use marketing cookies to help target online adverts and understand where users have seen our adverts on other sites.</p>
<p>An example of how we use marketing cookies is if you have just taken a loan out with us we will then use targeting in our marketing platforms so that you stop seeing our adverts.</p>

<div class="h5 mt-5">Purpose</div>
<p>Used by marketing platforms to store information about which adverts users see before arriving at Loans by MAL and what they then do on our site. This is used to target, track, present and improve ads that our users see.</p>
<p>How can I change my browser's cookie settings?</p>
<p>All the main browsers allow you some control of cookies through their settings. To find out more about these settings for your specific browser, search for "(your browser) cookie settings".</p>
<p>To opt out of being tracked by Google Analytics across all websites, visit <a href="https://tools.google.com/dlpage/gaoptout" target="_blank">https://tools.google.com/dlpage/gaoptout</a> .</p>

</div>

</div>`;

// =============================================================================
// State
// =============================================================================

const formCompletion = {
	first_name: false,
	last_name: false,
	monthly_income: false,
	email: false,
	postcode: false,
	mobile_number: false,
	date: false,
	line1: false,
	line2: true,
	line3: true,
	line4: false,
	line5: true,
	employmentStatus: false,
	accept_terms: false,
};

let smsGuid = "";
let smsAttemptsRemaining = 0;
let smsVerified = false;

let emailGuid = "";
let emailAttemptsRemaining = 0;
let emailVerified = false;

// =============================================================================
// Small helpers
// =============================================================================

function escapeHtml(value)
{
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function isFormComplete()
{
	return Object.values(formCompletion).every(Boolean);
}

function refreshContinueEnabled()
{
	// Continue stays clickable so the user can press it to surface error messages on incomplete fields.
}

function triggerAllValidations()
{
	Object.keys(fieldValidators).forEach(id =>
	{
		const el = document.getElementById(id);
		if (!el) return;
		// Address lines are hidden until the postcode lookup completes — don't fire errors on hidden fields.
		if (ADDRESS_LINE_FIELDS.includes(id) && !$(el).is(':visible')) return;
		validateFields(el);
	});

	const accept = document.getElementById('accept_terms');
	if (accept) validateFields(accept);

	// Postcode is filled but the user hasn't clicked Find — surface a hint there since the address lines aren't visible.
	if (POSTCODE_REGEX.test($('#postcode').val()) && !$('#line1').is(':visible'))
	{
		$('#postcode').addClass('validation-error-border').removeClass('is-valid');
		$('#postcodeErrorMessage').text("Please click 'Find' to enter your address.");
	}
}

function scrollToFirstError()
{
	const $first = $('.validation-error-border:visible').first();
	if (!$first.length) return;
	$first[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
	if (typeof $first[0].focus === 'function') $first[0].focus({ preventScroll: true });
}

function showAddressLines()
{
	for (const id of ADDRESS_LINE_FIELDS)
	{
		$('#' + id).show();
		$('#' + id + 'Label').show();
	}
}

function clearAddressLines()
{
	for (const id of ADDRESS_LINE_FIELDS)
		$('#' + id).val('').trigger('input');
}

function populateAddressLines(addr)
{
	$('#line1').val(addr.Line1).trigger('input');
	$('#line2').val(addr.Line2).trigger('input');
	$('#line3').val(addr.Line3).trigger('input');
	$('#line4').val(addr.City).trigger('input');
	$('#line5').val(addr.ProvinceName).trigger('input');
}

// =============================================================================
// Validation
// =============================================================================

function validateName(value)
{
	if (value.trim() === "")
		return { valid: false, message: "Name is required." };
	return {
		valid: NAME_REGEX.test(value),
		message: NAME_REGEX.test(value) ? "" : "Only alphabetic character are allowed.",
	};
}

function validateMonthlyIncome(value)
{
	if (value === "")
		return { valid: false, message: "Monthly income is required." };
	if (!INCOME_REGEX.test(value))
		return { valid: false, message: "Please enter a valid amount." };
	const numeric = Number(value);
	if (numeric < MIN_MONTHLY_INCOME)
		return { valid: false, message: `You must earn at least £${MIN_MONTHLY_INCOME.toLocaleString()} a month.` };
	if (numeric > HIGH_MONTHLY_INCOME_WARNING)
		return { valid: true, message: "Ensure you're providing your monthly income, not annual." };
	return { valid: true, message: "" };
}

function validateMobile(value)
{
	if (value.length < 11)
		return { valid: false, message: "Mobile numbers must contain 11 characters." };
	return {
		valid: MOBILE_REGEX.test(value),
		message: MOBILE_REGEX.test(value) ? "" : "Please enter a valid mobile number starting with 07.",
	};
}

function validateEmail(value)
{
	if (value === "")
		return { valid: false, message: "Email address is required." };
	return {
		valid: EMAIL_REGEX.test(value),
		message: EMAIL_REGEX.test(value) ? "" : "Please enter a valid email address.",
	};
}

function validatePostcode(value)
{
	if (value === "")
		return { valid: false, message: "Postcode is required." };
	return {
		valid: POSTCODE_REGEX.test(value),
		message: POSTCODE_REGEX.test(value) ? "" : "Please enter a valid postcode.",
	};
}

function validateDob(value)
{
	if (value === "")
		return { valid: false, message: "Date of birth is required." };
	if (!DOB_REGEX.test(value))
		return { valid: false, message: "Please enter a valid date in DD/MM/YYYY format." };

	const [day, month, year] = value.split('/').map(Number);
	const candidate = new Date(year, month - 1, day);

	if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day)
		return { valid: false, message: "Please enter a valid date." };

	const today = new Date();
	const maxDob = new Date(today.getFullYear() - MIN_AGE_YEARS, today.getMonth(), today.getDate());
	const minDob = new Date(today.getFullYear() - MAX_AGE_YEARS, today.getMonth(), today.getDate());

	if (candidate > maxDob)
		return { valid: false, message: `Date of birth must be greater than ${MIN_AGE_YEARS} years old.` };
	if (candidate < minDob)
		return { valid: false, message: `Date of birth must be less than ${MAX_AGE_YEARS} years old.` };
	return { valid: true, message: "" };
}

function validateAddressLineRequired(value, label)
{
	if (value.trim() === "")
		return { valid: false, message: `${label} is required` };
	if (!ADDRESS_LINE_REGEX.test(value))
		return { valid: false, message: "Only letters, spaces, numbers and the following characters are allowed -#,'" };
	return { valid: true, message: "" };
}

function validateAddressLineOptional(value)
{
	if (value === "" || ADDRESS_LINE_REGEX.test(value))
		return { valid: true, message: "" };
	return { valid: false, message: "Only letters, spaces, numbers and the following characters are allowed -#,'" };
}

const fieldValidators = {
	first_name: (v) => validateName(v),
	last_name: (v) => validateName(v),
	monthly_income: (v) => validateMonthlyIncome(v),
	mobile_number: (v) => { smsVerified = false; return validateMobile(v); },
	email: (v) => validateEmail(v),
	postcode: (v) => validatePostcode(v),
	date: (v) => validateDob(v),
	line1: (v) => validateAddressLineRequired(v, "Address Line 1"),
	line2: (v) => validateAddressLineOptional(v),
	line3: (v) => validateAddressLineOptional(v),
	line4: (v) => validateAddressLineRequired(v, "City"),
	line5: (v) => validateAddressLineOptional(v),
	employmentStatus: (v) =>
	{
		console.log(v)
		const $warning = $('#employmentStatusWarning');
		if (v === "Employed - part time")
			$warning.text("Warning: you must be earning at least £1,300 from your earned income after tax. We will check this.").removeClass('hidden');
		else if (v === "Retired")
			$warning.text("Warning: you must be earning at least £1,300 from pension and/or pension credit.").removeClass('hidden');
		else
			$warning.text('').addClass('hidden');

		if (v === "" || v === "Please Select")
			return { valid: false, message: "Please select an employment status." };
		if (v === "On benefits")
			return { valid: false, message: "We cannot lend to you if benefits is your primary income. We will check this." };
		return { valid: true, message: "" };
	},
};

function validateFields(field)
{
	if (field.id === 'accept_terms')
	{
		const checked = $('#accept_terms').prop('checked');
		formCompletion.accept_terms = checked;
		$('#accept_termsErrorMessage').text(checked ? '' : 'You must agree to our use of your information before continuing.');
		refreshContinueEnabled();
		return;
	}

	const validator = fieldValidators[field.id];
	if (!validator)
		return;

	const result = validator(field.value);
	updateField(field.id, result.valid, result.message);
	refreshContinueEnabled();
}

function updateField(fieldId, isValid, errorMessage)
{
	const $input = $('#' + fieldId);
	if (isValid)
	{
		$input.removeClass('validation-error-border');
		if (fieldId !== 'postcode')
			$input.addClass('is-valid');
		$('#' + fieldId + 'ErrorMessage').text(errorMessage || '');
	}
	else
	{
		$input.addClass('validation-error-border').removeClass('is-valid');
		$('#' + fieldId + 'ErrorMessage').text(errorMessage);
	}
	formCompletion[fieldId] = isValid;
}

// =============================================================================
// Proposal submission
//
// `submitProposal` is the single seam for swapping out the create-proposal API.
// To use a different backend: replace the body of `submitProposal` and adjust
// `normaliseProposalResponse` so the returned shape matches what `nextStep`
// consumes. Nothing else in this file should need to change.
// =============================================================================

function buildProposalPayload()
{
	const [day, month, year] = $('#date').val().split('/');
	const isoDob = `${year}-${month}-${day}`;

	return {
		customerForm: {
			proposalId: 0,
			incomeType: $('#employmentStatus').val().trim(),
			monthlyIncome: $('#monthly_income').val(),
			applicantTitle: $('#applicantTitle').val() || "",
			firstName: $('#first_name').val().trim(),
			lastName: $('#last_name').val().trim(),
			mobileNumber: $('#mobile_number').val(),
			emailId: $('#email').val().trim(),
			postCode: $('#postcode').val(),
			line1: $('#line1').val().trim(),
			line2: $('#line2').val().trim(),
			line3: $('#line3').val().trim(),
			line4: $('#line4').val().trim(),
			line5: $('#line5').val().trim(),
			dateOfBirth: isoDob,
			acceptTerms: true,
			malLoanOfferCheck: $('#malLoanOfferCheck').prop('checked'),
			dob: {
				year: parseInt(year, 10),
				month: parseInt(month, 10),
				day: parseInt(day, 10),
			},
		},
		statusCode: 0,
		sessionData: {},
	};
}

function submitProposal(payload)
{
	const endpoint = _b_use_proxy_endpoints ? '/api/Proposal/CreateProposal' : '/api/Proposal';
	return new Promise((resolve, reject) =>
	{
		apiPostJSON(endpoint, payload, (err, response) =>
		{
			if (err)
				reject(err);
			else
				resolve(normaliseProposalResponse(response));
		});
	});
}

function normaliseProposalResponse(response)
{
	return {
		id: response.id,
		statusCode: response.statusCode,
		firstRepaymentDate: response.firstRepaymentDate,
		agreementNumber: response.agreementNumber,
		tierValue: response.tierValue,
		raw: response,
	};
}

function tagDatadogUser(proposalId)
{
	if (!proposalId || `${proposalId}` === '')
		return;
	try
	{
		sessionStorage.setItem('dd_proposal_id', `${proposalId}`);
		if (window.DD_RUM)
		{
			window.DD_RUM.setUser({
				id: `${proposalId}`,
				salesManName: 'Report Central',
			});
		}
	}
	catch (err)
	{
		console.error("Error setting Datadog RUM user info:", err);
	}
}

function nextStep()
{
	console.log(fieldValidators)
	if (!isFormComplete())
	{
		triggerAllValidations();
		scrollToFirstError();
		return;
	}

	showSpinner();
	const payload = buildProposalPayload();

	submitProposal(payload).then((response) =>
	{
		tagDatadogUser(response.id);

		if (checkForProposalActiveState(response.statusCode))
			location.href = "/step-two/step-two.html";
		else
			location.href = "/application-declined/application-declined.html";
	}).catch((err) =>
	{
		hideSpinner();
		console.error("sending user back to step one: CreateProposal failed");
		console.error(err.toString());
	});
}

// =============================================================================
// Address lookup
// =============================================================================

function buildAddressOptions(items)
{
	let options = dropdownOptionTemplate.process({ StatusValue: "", Status: "Select an option" });
	for (const item of items)
	{
		const label = `${item.Text}, ${item.Description}`;
		options += dropdownOptionTemplate.process({
			StatusValue: escapeHtml(item.Id),
			Status: escapeHtml(label),
		});
	}
	return options;
}

function retrieveAndPopulateAddress(id)
{
	const url = ADDRESS_RETRIEVE_URL + "&Id=" + encodeURIComponent(id);
	apiGet(url, {}, (err, response) =>
	{
		if (err || !response || !response.Items || response.Items.length === 0)
			return;
		const addr = response.Items[0];
		showAddressLines();
		populateAddressLines(addr);
		if (addr.PostalCode)
		{
			$('#postcode').val(addr.PostalCode);
			validateFields(document.getElementById('postcode'));
		}
		$('#postcode').removeClass('validation-error-border').addClass('is-valid');
	});
}

function showAddressPicker(optionsHtml)
{
	popupConfirm('Select Address', addressPickerTemplate.process({ options: optionsHtml }), (confirmed) =>
	{
		showAddressLines();
		$('#postcode').removeClass('validation-error-border').addClass('is-valid');

		if (!confirmed)
			return;

		const selectedId = $('#AddressList').val();
		if (selectedId === '' || selectedId == null)
		{
			clearAddressLines();
			return;
		}
		retrieveAndPopulateAddress(selectedId);
	});
}

function getAddress()
{
	const postcode = $('#postcode').val();
	if (!POSTCODE_REGEX.test(postcode))
		return;

	const initialUrl = ADDRESS_FIND_URL + "&Text=" + encodeURIComponent(postcode) + "&Container=";
	apiGet(initialUrl, {}, (err, response) =>
	{
		if (!response || !response.Items || response.Items.length === 0)
		{
			const fallback = dropdownOptionTemplate.process({ StatusValue: "", Status: "Select an option" });
			showAddressPicker(fallback);
			return;
		}

		const containerId = response.Items[0].Id;
		const containerUrl = ADDRESS_FIND_URL + "&Text=" + encodeURIComponent(postcode) + "&Container=" + encodeURIComponent(containerId);
		apiGet(containerUrl, {}, (err2, containerResponse) =>
		{
			const items = (containerResponse && containerResponse.Items) || [];
			showAddressPicker(buildAddressOptions(items));
		});
	});
}

// =============================================================================
// Terms popup
// =============================================================================

function displayTerms()
{
	popupTerms('Explanation of Your Fixed Sum Loan Agreement', termsTemplate);
}

// =============================================================================
// OTP — mobile
// =============================================================================

// function sendOTPSMS()
// {
// 	const mobileNumber = $('#mobile_number').val();
// 	apiPost('/api/Proposal/Verify/Mobile', { Phone: mobileNumber }, (err, response) =>
// 	{
// 		if (err)
// 		{
// 			console.log(err);
// 			return;
// 		}
// 		$('#mobile_numberErrorMessage').text("");
// 		smsVerified = false;
// 		popupOTP('Mobile Verification', validateCodeSmsTemplate);
// 		smsGuid = response.GUID;
// 		smsAttemptsRemaining = OTP_MAX_ATTEMPTS;
// 	});
// }

// function validateCodeSMS()
// {
// 	const code = $('#enterCodeSMS').val();
// 	if (code === "" || code == null)
// 	{
// 		$('#smsCodeErrorMessage').text('Please enter the code.');
// 		return;
// 	}

// 	apiPut('/api/Proposal/Verify/Mobile', { Code: code, GUID: smsGuid }, (err) =>
// 	{
// 		if (err)
// 		{
// 			console.log(err);
// 			smsVerified = false;
// 			smsAttemptsRemaining--;
// 			$('#smsCodeErrorMessage').text(smsAttemptsRemaining + ' tries remaining.');
// 			if (smsAttemptsRemaining === 0)
// 			{
// 				$('#enterCodeSMS').prop('disabled', true);
// 				$('#btnConfirmCodeSMS').prop('disabled', true);
// 				$('#btnMobileVerify').html('<i class="fa fa-x"></i>');
// 				obj_confirm_modal.hide();
// 			}
// 			return;
// 		}
// 		$('#btnMobileVerify').html('<i class="fa fa-check"></i>');
// 		$('#btnMobileVerify').prop('disabled', true);
// 		smsVerified = true;
// 		obj_confirm_modal.hide();
// 	});
// }

// =============================================================================
// OTP — email
// =============================================================================

// function sendOTPEmail()
// {
// 	const emailValue = $('#email').val();
// 	apiPost('/api/Proposal/Verify/Email', { Email: emailValue }, (err, response) =>
// 	{
// 		if (err)
// 		{
// 			console.log(err);
// 			return;
// 		}
// 		$('#emailErrorMessage').text("");
// 		popupOTP('Email Verification', validateCodeEmailTemplate);
// 		emailGuid = response.GUID;
// 		emailAttemptsRemaining = OTP_MAX_ATTEMPTS;
// 	});
// }

// function validateCodeEmail()
// {
// 	const code = $('#enterCodeEmail').val();
// 	if (code === "" || code == null)
// 	{
// 		$('#emailCodeErrorMessage').text('Please enter the code.');
// 		return;
// 	}

// 	apiPut('/api/Proposal/Verify/Email', { Code: code, GUID: emailGuid }, (err) =>
// 	{
// 		if (err)
// 		{
// 			console.log(err);
// 			emailVerified = false;
// 			emailAttemptsRemaining--;
// 			$('#emailCodeErrorMessage').text(emailAttemptsRemaining + ' tries remaining.');
// 			if (emailAttemptsRemaining === 0)
// 			{
// 				$('#enterCodeEmail').prop('disabled', true);
// 				$('#btnConfirmCodeEmail').prop('disabled', true);
// 				$('#btnEmailVerify').prop('disabled', true);
// 				$('#btnEmailVerify').html('<i class="fa fa-x"></i>');
// 				obj_confirm_modal.hide();
// 			}
// 			return;
// 		}
// 		emailVerified = true;
// 		$('#btnEmailVerify').html('<i class="fa fa-check"></i>');
// 		$('#btnEmailVerify').prop('disabled', true);
// 		obj_confirm_modal.hide();
// 	});
// }

// =============================================================================
// Page setup
// =============================================================================

document.addEventListener("DOMContentLoaded", () =>
{
	for (const id of ADDRESS_LINE_FIELDS)
	{
		$('#' + id).hide();
		$('#' + id + 'Label').hide();
	}
});
