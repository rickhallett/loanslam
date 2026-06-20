let proposal_session = {};
let obj_proposal = {}

var b_continue_pressed = false;

function nextStep()
{
	showSpinner();
	b_continue_pressed = true;

	let branch_code = $('#sortCode1').val() + $('#sortCode2').val() + $('#sortCode3').val();

	const customer = obj_proposal.customers[0];
	const address = customer.addresses[0];

	const dobParts = customer.dob.split('T')[0].split('-');
	const dobYear = parseInt(dobParts[0]);
	const dobMonth = parseInt(dobParts[1]);
	const dobDay = parseInt(dobParts[2]);

	const fpdParts = obj_proposal.firstPaymentDate.split('T')[0].split('-');
	const fpdYear = fpdParts[0];
	const fpdDay = parseInt(fpdParts[2]);
	const fpdMonthIndex = parseInt(fpdParts[1]);
	const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
	const fpdMonth = monthNames[fpdMonthIndex - 1];
	const fpdSuffix = (fpdDay >= 11 && fpdDay <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[fpdDay % 10] || 'th');

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
		dob: {
			year: dobYear,
			month: dobMonth,
			day: dobDay
		},
		externalReference: obj_proposal.externalReference,
		customerId: customer.id,
        incomeType: customer.typeOfBusiness
	};

	const accountDetailsForm = {
		accountHolderName: $('#accountHolderName').val(),
		accountNumber: $('#accountNumber').val(),
		branchCode: branch_code,
		isJointAccount: false,
		mandateSucceed: ''
	}

	const loanBorrowForm = {
		loanTerm: obj_proposal.term,
		loanAmount: obj_proposal.principal,
		maxLoan: Math.min(Math.max(Math.ceil((customer.salary * 2) / 100) * 100, 1000), 5000)
	}

	let requestBody =
	{
		customerForm: customerForm,
		sessionData: {
			customerForm: customerForm,
			firstPaymentDate: {
				date: fpdDay,
				dateSuffix: fpdSuffix,
				month: fpdMonth,
				year: fpdYear
			},
			agreementNumber: obj_proposal.agreementNumber,
			statusCode: obj_proposal.currentStatus,
			str_broker_name: obj_proposal.salesmanName || "",
			loanBorrowForm,
			accountDetailsForm
		},
		loanBorrowForm,
		accountDetailsForm,
		statusCode: 183,
	}
	if ($('#multiplePeopleRequired').prop('checked'))
		requestBody.accountDetailsForm.isJointAccount = true;
	else
		requestBody.accountDetailsForm.isJointAccount = false;

	var func_api		= apiPutJSON;
	var str_endpoint	= '/api/Proposal';
	if(_b_use_proxy_endpoints)
	{
		func_api		= apiPostJSON;
		str_endpoint	= '/api/Proposal/UpdateProposal';
	}
	func_api(str_endpoint, requestBody, function (err, obj_response)
	{
		if (err)
		{
			console.error("sending user back to step one: UpdateProposal failed")
			console.error(err.toString())
			location.href = "/step-one/step-one.html";
		}
		else
		{
			let bool_active_code = checkForProposalActiveState(obj_response.statusCode);

			if (bool_active_code)
			{
				hideSpinner();
				location.href = "/step-seven/step-seven.html";
			}
			else
			{
				hideSpinner();
				location.href = "/application-declined/application-declined.html";
			}
		}
	})
}

let obj_form_completion_checks = 
{
    bool_accountHolderName_complete: false,
    bool_sortCode_complete: false,
    bool_accountNumber_complete: false,
	bool_authorised_complete: false
};

function validateFields(field) {
    let input = field.type == 'checkbox' ? field.checked : field.value;
	const sortCodeRegex = /^\d{2}$/;

    switch (field.id) {
        case 'accountHolderName':
            const onlyLetters = /^[A-Za-z\-\'\s]+$/;
            updateField(field.id, onlyLetters.test(input), "Please enter a valid name.", () => {
                $('#' + field.id).val(input.toUpperCase());
            });
            break;

        case 'sortCode1':
            updateField(field.id, sortCodeRegex.test(input), "Please enter a valid sort code.");
            break;

		case 'sortCode2':
			updateField(field.id, sortCodeRegex.test(input), "Please enter a valid sort code.");
			break;

		case 'sortCode3':
            updateField(field.id, sortCodeRegex.test(input), "Please enter a valid sort code.");
            break;

        case 'accountNumber':
            const accountNumberRegex = /^\d{8}$/;
            updateField(field.id, accountNumberRegex.test(input), "Please enter a valid account number.");
            break;

		case 'authorised':
			if(field.checked)
			{
				obj_form_completion_checks['bool_authorised_complete'] = true;
			}
			else
			{
				obj_form_completion_checks['bool_authorised_complete'] = false;
			}
			break;

		case 'multiplePeopleRequired':
			if(field.checked)
			{
				$('#multiplepeople1').removeClass('hidden');
				$('#multiplepeople2').removeClass('hidden');
			}
			else
			{
				$('#multiplepeople1').addClass('hidden');
				$('#multiplepeople2').addClass('hidden');	
			}

        default:
            break;
    }

    // Check if all fields are complete and enable the next button if they are
    if (Object.values(obj_form_completion_checks).every(Boolean)) {
        $('#btnNextStep').prop('disabled', false);
    } else {
        $('#btnNextStep').prop('disabled', true);
    }
}

// Method to update the fields on input to show or remove validation errors
// This will either set the bool value within the obj_form_completion_checks value to true or false
function updateField(obj_field, isValid, errorMessage) 
{
	const sortCodeRegex = /^\d{2}$/;
	if (isValid)
	{
		if(obj_field == "sortCode1" || obj_field == "sortCode2" || obj_field == "sortCode3")
		{
			let b_sortcode_valid = false;	
			$('#' + obj_field).removeClass('validation-error-border').addClass('is-valid');
			if(sortCodeRegex.test($('#sortCode1').val()) && sortCodeRegex.test($('#sortCode2').val()) && sortCodeRegex.test($('#sortCode3').val()))
			{
				b_sortcode_valid = true;
			}

			if(b_sortcode_valid)
			{
				$('#sortCodeErrorMessage').text('');
				obj_form_completion_checks.bool_sortCode_complete = true;
			}
			else
			{
				$('#sortCodeErrorMessage').text(errorMessage);
				obj_form_completion_checks.bool_sortCode_complete = false;
			}
		}	
		else
		{
			$('#' + obj_field).removeClass('validation-error-border').addClass('is-valid');
			$('#' + obj_field + 'ErrorMessage').text('');
			obj_form_completion_checks['bool_' + obj_field + '_complete'] = true;
		}
	} 
	else
	{
		if(obj_field == "sortCode1" || obj_field == "sortCode2" || obj_field == "sortCode3")
		{
			$('#sortCodeErrorMessage').text(errorMessage);
			$('#' + obj_field).addClass('validation-error-border').removeClass('is-valid');
			obj_form_completion_checks.bool_sortCode_complete = false;
		}
		else
		{
			$('#' + obj_field).addClass('validation-error-border').removeClass('is-valid');
			$('#' + obj_field + 'ErrorMessage').text(errorMessage);
			obj_form_completion_checks['bool_' + obj_field + '_complete'] = false;
		}
	}
}

function getOrdinalSuffix(obj_day)
{
    if (obj_day > 3 && obj_day < 21) return 'th'; // covers 4th-20th
    switch (obj_day % 10)
    {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
}

function formatDate(obj_date)
{
    let obj_day = obj_date.getDate();
    let arr_month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    let obj_month = arr_month_names[obj_date.getMonth()];
    let obj_year = obj_date.getFullYear();

    let str_day_with_suffix = obj_day + getOrdinalSuffix(obj_day);
    return `${str_day_with_suffix} ${obj_month} ${obj_year}`;
}


function getProposalData()
{

	apiGet(_b_use_proxy_endpoints ? '/api/Proposal/GetProposal' : '/api/Proposal', {}, function(err, obj_response)
	{
		if(err)
		{
			console.error("sending user back to step one: GetProposal failed")
			console.error(err.toString())
			location.href = "/step-one/step-one.html"
		}
		else
		{
			obj_proposal = obj_response
			$('#todays-date').val(new Date().toFormattedString('d/m/Y'));
			$('#agreement-number').val(obj_response.agreementNumber);
			$('#accountHolderName').val(obj_response.customers[0].forename.trim() + " " + obj_response.customers[0].surname.trim());
			let name_input = document.getElementById('accountHolderName');
			validateFields(name_input);
			$('#monthlyIncome').val(obj_response.customers[0].salary);
			$('#applicantTitle').val(obj_response.customers[0].title);
			$('#firstName').val(obj_response.customers[0].forename);
			$('#lastName').val(obj_response.customers[0].surname);
			$('#dob').val(new Date(obj_response.customers[0].dob).toFormattedString('d/m/Y'));
			$('#mobileNumber').val(obj_response.customers[0].mobileNumber);
			$('#emailId').val(obj_response.customers[0].email);
			$('#postcode').val(obj_response.customers[0].addresses[0].postCode);

			let str_first_payment_date = formatDate(new Date(obj_response.firstPaymentDate));
			$('#dd_first_point').text('After your loan is paid out your first repayment will be taken on ' + str_first_payment_date)
		}
	});
}

document.addEventListener("DOMContentLoaded", function ()
{
	getProposalData();
});

function disableBack() { window.history.forward(); }
setTimeout("disableBack()", 0);
window.onunload = function () { null };