const loanPurposes = [
	"Vehicle purchase", "Vehicle repairs", "Home improvements", "Holiday",
	"Health care/medical", "Wedding", "Major purchase (electronics, furniture)",
	"Moving/relocation", "Urgent home/car repairs", "Unexpected expense",
	"Funeral expense", "Pet expense", "Debt consolidation", "Legal expense"
];
const dependantsOptions = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const amountRegex = /^\d+(\.\d{1,2})?$/;

let obj_proposal = {};
let proposal_session = {};
var b_continue_pressed = false;

let dependants = 0;
let hasCar = null;
let isCarPurchase = false;

const expenditure =
{
	mortgage_with_dependant: 1013,     mortgage_with_no_dependant: 507,
	rent_with_dependant: 993,          rent_with_no_dependant: 497,
	food_with_dependant: 454,          food_with_no_dependant: 227,
	council_tax_with_dependant: 165,   council_tax_with_no_dependant: 124,
	gas_with_dependant: 80,            gas_with_no_dependant: 40,
	electric_with_dependant: 80,       electric_with_no_dependant: 40,
	water_with_dependant: 37,          water_with_no_dependant: 18.50,
	clothing_with_dependant: 106,      clothing_with_no_dependant: 58,
	travel_with_dependant: 142,        travel_with_no_dependant: 142,
	runningCar_with_dependant: 142,    runningCar_with_no_dependant: 142,
	runningPublic_with_dependant: 142, runningPublic_with_no_dependant: 142,
	media_with_dependant: 1,           media_with_no_dependant: 1,
	energy_with_dependant: 197,        energy_with_no_dependant: 98.5,
	travel_car_purchase: 167
};

// Single source of truth for the contribution rows — order controls progressive reveal + submit order.
const contributionRows =
[
	{ rowId: 'rent_row',     amountId: 'rentAmt',        thresholdKey: 'rent',        ieItemId: 67 },
	{ rowId: 'council_row',  amountId: 'council_taxAmt', thresholdKey: 'council_tax', ieItemId: 68 },
	{ rowId: 'energy_row',   amountId: 'energyAmt',      thresholdKey: 'energy',      ieItemId: 92 },
	{ rowId: 'food_row',     amountId: 'foodAmt',        thresholdKey: 'food',        ieItemId: 83 },
	{ rowId: 'media_row',    amountId: 'mediaAmt',       thresholdKey: 'media',       ieItemId: 79 },
	{ rowId: 'clothing_row', amountId: 'clothingAmt',    thresholdKey: 'clothing',    ieItemId: 84 }
];

const completion =
{
	loanPurpose: false,
	dependants: false,
	rentAmt: false,        rentAmtDropdown: false,
	council_taxAmt: false, council_taxAmtDropdown: false,
	energyAmt: false,      energyAmtDropdown: false,
	foodAmt: false,        foodAmtDropdown: false,
	mediaAmt: false,       mediaAmtDropdown: false,
	clothingAmt: false,    clothingAmtDropdown: false,
	transport: false,      transportDropdown: false,
	acceptTerms: false,
	monthlyIncome: true
};

// Top-to-bottom scroll order for first-error. Functions resolve the active transport field.
const validationOrder =
[
	{ key: 'loanPurpose',            elementId: 'loanPurpose' },
	{ key: 'dependants',             elementId: 'dependants' },
	{ key: 'rentAmt',                elementId: 'rentAmt' },
	{ key: 'rentAmtDropdown',        elementId: 'rentAmtDropdown' },
	{ key: 'council_taxAmt',         elementId: 'council_taxAmt' },
	{ key: 'council_taxAmtDropdown', elementId: 'council_taxAmtDropdown' },
	{ key: 'energyAmt',              elementId: 'energyAmt' },
	{ key: 'energyAmtDropdown',      elementId: 'energyAmtDropdown' },
	{ key: 'foodAmt',                elementId: 'foodAmt' },
	{ key: 'foodAmtDropdown',        elementId: 'foodAmtDropdown' },
	{ key: 'mediaAmt',               elementId: 'mediaAmt' },
	{ key: 'mediaAmtDropdown',       elementId: 'mediaAmtDropdown' },
	{ key: 'clothingAmt',            elementId: 'clothingAmt' },
	{ key: 'clothingAmtDropdown',    elementId: 'clothingAmtDropdown' },
	{ key: 'transport',              elementId: () => hasCar ? 'runningCarAmt'         : 'runningPublicAmt' },
	{ key: 'transportDropdown',      elementId: () => hasCar ? 'runningCarAmtDropdown' : 'runningPublicAmtDropdown' },
	{ key: 'acceptTerms',            elementId: 'acceptTerms' }
];

const dropdownMessages =
{
	loanPurpose: "Please select a loan purpose.",
	dependants:  "Please enter a number of dependants."
};
const REASON_DROPDOWN_MESSAGE = "Please select an option.";

// ---------- small helpers ----------

function thresholdFor(key)
{
	return expenditure[key + (dependants < 1 ? '_with_no_dependant' : '_with_dependant')];
}

function thresholdForAmount(fieldId)
{
	if (fieldId === 'runningCarAmt') return isCarPurchase ? expenditure.travel_car_purchase : thresholdFor('runningCar');
	if (fieldId === 'runningPublicAmt') return thresholdFor('runningPublic');
	const row = contributionRows.find(r => r.amountId === fieldId);
	return row ? thresholdFor(row.thresholdKey) : null;
}

function completionKeyFor(id)
{
	if (id === 'runningCarAmt' || id === 'runningPublicAmt') return 'transport';
	if (id === 'runningCarAmtDropdown' || id === 'runningPublicAmtDropdown') return 'transportDropdown';
	return id;
}

function setFieldValid(id)
{
	$('#' + id).removeClass('validation-error-border').addClass('is-valid');
	$('#' + id + 'ErrorMessage').text('');
}

function setFieldError(id, message)
{
	$('#' + id).addClass('validation-error-border').removeClass('is-valid');
	$('#' + id + 'ErrorMessage').text(message);
}

function dropdownReason(dropdownId)
{
	const val = $('#' + dropdownId).val();
	return val === 'Please Select' ? null : val;
}

function ordinalSuffix(day)
{
	if (day >= 11 && day <= 13) return 'th';
	return ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10]) || 'th';
}

function setupDropdowns()
{
	loanPurposes.forEach(p => $('#loanPurpose').append(new Option(p, p)));
	dependantsOptions.forEach(d => $('#dependants').append(new Option(d, d)));
}

// ---------- progressive reveal ----------

function refreshVisibility()
{
	const topReady = completion.loanPurpose && completion.dependants;
	$('#test').toggleClass('hidden', !topReady);
	if (!topReady)
	{
		$('#accept_terms_row, #continue_row').addClass('hidden');
		return;
	}

	// Each row is visible iff every earlier row's amount + reason-dropdown are satisfied.
	let priorSatisfied = true;
	contributionRows.forEach((row, i) =>
	{
		$('#' + row.rowId).toggleClass('hidden', !(i === 0 || priorSatisfied));
		if (!(completion[row.amountId] && completion[row.amountId + 'Dropdown'])) priorSatisfied = false;
	});
	$('#car_running').toggleClass('hidden', !priorSatisfied);

	const transportReady = completion.transport && completion.transportDropdown;
	$('#accept_terms_row, #continue_row').toggleClass('hidden', !transportReady);
}

// ---------- field validation ----------

function validateAmount(fieldId, value, threshold)
{
	const isValid = amountRegex.test(value) && value >= 0;
	if (isValid) setFieldValid(fieldId);
	else         setFieldError(fieldId, "Please enter a valid amount.");
	completion[completionKeyFor(fieldId)] = isValid;

	const belowThreshold = value !== "" && Number(value) < threshold;
	const dropdownId = fieldId + 'Dropdown';

	$('#' + dropdownId).toggleClass('hidden', !belowThreshold);
	$('#' + dropdownId + 'Message').toggleClass('hidden', !belowThreshold);
	$('#' + dropdownId + 'ErrorMessage').toggleClass('hidden', !belowThreshold);

	if (belowThreshold)
	{
		// Don't clobber a valid prior selection — re-running validation must not wipe state.
		$('#' + dropdownId).trigger('input');
	}
	else
	{
		completion[completionKeyFor(dropdownId)] = true;
	}

	refreshVisibility();
}

function validateMonthlyIncome(value)
{
	if (!value)
	{
		completion.monthlyIncome = false;
		$('#monthlyIncomeErrorMessage').text("Monthly income is required.");
		return;
	}
	if (Number(value) < 1300)
	{
		completion.monthlyIncome = false;
		$('#monthlyIncomeErrorMessage').text("You must earn at least £1,300 a month");
		return;
	}
	completion.monthlyIncome = true;
	$('#monthlyIncomeErrorMessage').text(Number(value) > 7000 ? "Ensure you're providing your monthly income, not annual" : "");
}

function validateFields(field)
{
	dependants = $('#dependants').val();

	// Surface required-field messages if the user edits amounts before picking the top dropdowns.
	if ($('#dependants').val()  === "Please Select") $('#dependantsErrorMessage').text("This is a required field");
	if ($('#loanPurpose').val() === "Please Select") $('#loanPurposeErrorMessage').text("This is a required field");

	const threshold = thresholdForAmount(field.id);
	if (threshold !== null)
	{
		validateAmount(field.id, field.value, threshold);
		return;
	}

	if (field.id === 'acceptTerms')
	{
		completion.acceptTerms = $('#acceptTerms').prop('checked');
		refreshVisibility();
		return;
	}

	if (field.id === 'monthlyIncome')
	{
		validateMonthlyIncome(field.value);
		refreshVisibility();
	}
}

function validateDropdowns(field)
{
	const id = field.id;
	const isInvalid = field.value.trim() === "Please Select";
	const message = dropdownMessages[id] || REASON_DROPDOWN_MESSAGE;

	if (isInvalid) setFieldError(id, message);
	else           setFieldValid(id);
	completion[completionKeyFor(id)] = !isInvalid;

	if (id === 'loanPurpose')
	{
		$('#loanPurposeConsolidation').toggleClass('hidden', field.value !== "Debt consolidation");
	}

	// Thresholds depend on dependant count — re-run every amount field when it changes.
	if (id === 'dependants' && !isInvalid) revalidateAllAmounts();

	refreshVisibility();
}

function revalidateAllAmounts()
{
	dependants = $('#dependants').val();

	contributionRows.forEach(row =>
	{
		const value = $('#' + row.amountId).val();
		if (value !== "") validateAmount(row.amountId, value, thresholdFor(row.thresholdKey));
	});

	const carValue = $('#runningCarAmt').val();
	if (carValue !== "") validateAmount('runningCarAmt', carValue, thresholdForAmount('runningCarAmt'));
}

// ---------- transport ----------

function transportCheck(userHasCar)
{
	completion.transport = false;
	completion.transportDropdown = false;
	refreshVisibility();

	$('#runningPublicAmt, #runningCarAmt').removeClass('is-valid validation-error-border');
	hasCar = !!userHasCar;

	const active           = hasCar ? 'car'              : 'public';
	const inactive         = hasCar ? 'public'           : 'car';
	const activeAmountId   = hasCar ? 'runningCarAmt'    : 'runningPublicAmt';
	const inactiveAmountId = hasCar ? 'runningPublicAmt' : 'runningCarAmt';

	$('#transportYes').toggleClass('selected', hasCar);
	$('#transportNo').toggleClass('selected', !hasCar);

	$('#' + active).removeClass('hidden');
	$('#' + active + 'Dropdown').removeClass('hidden');
	$('#' + inactive).addClass('hidden');
	$('#' + inactive + 'Dropdown').addClass('hidden');

	// Active side's reason-dropdown starts hidden — amount is empty so no threshold breach yet.
	$('#' + activeAmountId + 'Dropdown').addClass('hidden');
	$('#' + activeAmountId + 'DropdownMessage').addClass('hidden');
	$('#' + activeAmountId + 'DropdownErrorMessage').addClass('hidden');

	$('#' + inactiveAmountId).val("").trigger('input');
	$('#' + inactiveAmountId + 'Dropdown').val("Please Select").trigger('input');
}

function resetTransport()
{
	completion.transport = false;
	completion.transportDropdown = false;
	refreshVisibility();

	$('#car_running').removeClass('hidden');
	$('#transportNo, #transportYes').removeClass('selected');

	const toHide = [
		'car', 'carDropdown', 'public', 'publicDropdown',
		'runningCarAmtDropdownMessage',    'runningCarAmtDropdown',
		'runningPublicAmtDropdownMessage', 'runningPublicAmtDropdown',
		'car_purchase_message'
	];
	toHide.forEach(id => $('#' + id).addClass('hidden'));

	['runningCarAmt', 'runningPublicAmt'].forEach(id =>
	{
		$('#' + id).val('');
		$('#' + id + 'ErrorMessage').text('');
		$('#' + id + 'Dropdown').val('Please Select');
		$('#' + id + 'DropdownErrorMessage').text('');
	});
}

// ---------- submit ----------

function triggerAllValidations()
{
	['loanPurpose', 'dependants'].forEach(id =>
	{
		const el = document.getElementById(id);
		if (el) validateDropdowns(el);
	});

	contributionRows.forEach(row =>
	{
		const el = document.getElementById(row.amountId);
		if (el) validateFields(el);
	});

	if (hasCar === true)       validateFields(document.getElementById('runningCarAmt'));
	else if (hasCar === false) validateFields(document.getElementById('runningPublicAmt'));

	const accept = document.getElementById('acceptTerms');
	if (accept) validateFields(accept);
}

function scrollToFirstIncomplete()
{
	for (const entry of validationOrder)
	{
		if (completion[entry.key]) continue;
		const id = typeof entry.elementId === 'function' ? entry.elementId() : entry.elementId;
		const el = document.getElementById(id);
		if (!el) continue;
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		if (typeof el.focus === 'function') el.focus({ preventScroll: true });
		return;
	}
}

function validateReasonDropdownsOnSubmit()
{
	let hadErrors = false;

	contributionRows.forEach(row =>
	{
		const amt = $('#' + row.amountId).val();
		if (amt === "" || Number(amt) >= thresholdFor(row.thresholdKey)) return;

		const dropdownId = row.amountId + 'Dropdown';
		if ($('#' + dropdownId).val() === 'Please Select')
		{
			setFieldError(dropdownId, "This is a required field");
			hadErrors = true;
		}
		else setFieldValid(dropdownId);
	});

	// Rent is the only amount field that's mandatory once there are dependants.
	if (dependants > 0 && $('#rentAmt').val() === "")
	{
		setFieldError('rentAmt', "This is a required field");
		hadErrors = true;
	}

	const transportAmtId = hasCar ? 'runningCarAmt' : 'runningPublicAmt';
	const transportDropdownId = transportAmtId + 'Dropdown';
	const travelAmt = $('#' + transportAmtId).val();
	if (travelAmt !== "" && Number(travelAmt) < thresholdFor('travel'))
	{
		if ($('#' + transportDropdownId).val() === 'Please Select')
		{
			setFieldError(transportDropdownId, "This is a required field");
			hadErrors = true;
		}
		else setFieldValid(transportDropdownId);
	}

	return hadErrors;
}

function buildIeItems()
{
	const items = contributionRows.map(row => (
	{
		ieItemId: row.ieItemId,
		category: row.amountId,
		ieItemAmount: $('#' + row.amountId).val().trim(),
		reason: dropdownReason(row.amountId + 'Dropdown')
	}));

	const transportAmtId = hasCar ? 'runningCarAmt' : 'runningPublicAmt';
	items.push({
		ieItemId: 76,
		category: 'travelAmt',
		ieItemAmount: $('#' + transportAmtId).val(),
		reason: dropdownReason(transportAmtId + 'Dropdown')
	});

	return items;
}

function nextStep()
{
	$('.validation-error-border').removeClass('validation-error-border');
	$('.validation-error-text').remove();

	const hadErrors = validateReasonDropdownsOnSubmit();
	const allComplete = Object.values(completion).every(Boolean);
	if (hadErrors || !allComplete)
	{
		triggerAllValidations();
		scrollToFirstIncomplete();
		return;
	}

	showSpinner();
	b_continue_pressed = true;

	const ieDetails = {
		loanPurpose: $('#loanPurpose').val(),
		dependents: $('#dependants').val(),
		ieItems: buildIeItems()
	};
	proposal_session.ieDetails = ieDetails;

	const customer = obj_proposal.customers[0];
	const address = customer.addresses[0];

	const dobParts = customer.dob.split('T')[0].split('-');
	const fpdParts = obj_proposal.firstPaymentDate.split('T')[0].split('-');
	const fpdDay = parseInt(fpdParts[2]);

	const customerForm = {
		proposalId: obj_proposal.id,
		monthlyIncome: String(customer.salary),
		firstName: customer.forename,
		lastName: customer.surname,
		mobileNumber: customer.mobileNumber,
		emailId: customer.email,
		postCode: address.postCode,
		line1: address.line1,
		line2: address.line2,
		line3: address.line3,
		line4: address.town,
		line5: address.county,
		dateOfBirth: dobParts.join('-'),
		dob: { year: parseInt(dobParts[0]), month: parseInt(dobParts[1]), day: parseInt(dobParts[2]) },
		externalReference: obj_proposal.externalReference,
		customerId: customer.id,
		incomeType: customer.typeOfBusiness,
	};

	const accountDetailsForm = {
		accountHolderName: customer.bankAccountName,
		accountNumber: customer.bankAccountNumber,
		branchCode: customer.bankSortCode,
		isJointAccount: customer.bankJointAccount
	};

	const loanBorrowForm = {
		loanTerm: obj_proposal.term,
		loanAmount: obj_proposal.principal,
		maxLoan: Math.min(Math.max(Math.ceil((customer.salary * 2) / 100) * 100, 1000), 5000)
	};

	const requestBody = {
		customerForm,
		sessionData: {
			customerForm,
			firstPaymentDate: {
				date: fpdDay,
				dateSuffix: ordinalSuffix(fpdDay),
				month: monthNames[parseInt(fpdParts[1]) - 1],
				year: fpdParts[0]
			},
			agreementNumber: obj_proposal.agreementNumber,
			statusCode: 183,
			str_broker_name: obj_proposal.salesmanName || "",
			loanBorrowForm,
			accountDetailsForm,
			ieDetails
		},
		loanBorrowForm,
		accountDetailsForm,
		ieDetails,
		statusCode: 190
	};

	const apiFn = _b_use_proxy_endpoints ? apiPostJSON : apiPutJSON;
	const endpoint = _b_use_proxy_endpoints ? '/api/Proposal/UpdateProposal' : '/api/Proposal';

	apiFn(endpoint, requestBody, (err, response) =>
	{
		if (err)
		{
			console.error("sending user back to step one: UpdateProposal failed");
			console.error(err.toString());
			location.href = "/step-one/step-one.html";
			return;
		}

		if (!checkForProposalActiveState(response.statusCode))
		{
			hideSpinner();
			location.href = "/application-declined/application-declined.html";
			return;
		}

		hideSpinner();
		location.href = "/step-five/step-five.html";
	});
}

function getProposalData()
{
	const endpoint = _b_use_proxy_endpoints ? '/api/Proposal/GetProposal' : '/api/Proposal';
	apiGet(endpoint, {}, (err, response) =>
	{
		if (err)
		{
			console.error("sending user back to step one: GetProposal failed");
			console.error(err.toString());
			location.href = "/step-one/step-one.html";
			return;
		}
		obj_proposal = response;
	});
}

document.addEventListener("DOMContentLoaded", () =>
{
	setupDropdowns();
	$('#car').addClass('hidden');
	$('#public').addClass('hidden');
	getProposalData();
});

function disableBack() { window.history.forward(); }
setTimeout(disableBack, 0);
