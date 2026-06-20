let obj_proposal = {};
let proposal_session = {};
let threshold = 5000;
let monthlyIncome = 0;
let maxLoan = 0;
let allowedLoanTerms = [24, 18, 12, 9];
let obj_current_date = new Date();
let obj_repayment_date = new Date();
let obj_mal_date = null;
let num_min_loan = 1000;
let max_loan = null;
let obj_borrow_amount =
{
    _12months: "",
    _24months: "",
    _36months: "",
    _9months: ","
}
let obj_percentage =
{
    "_36": 2,
    "_24": 2,
    "_18": 1.5,
    "_12": 1,
    "_9": 1
}

var b_continue_pressed = false;

var MAX_LOAN_AMOUNT_36_MONTH_TERM = 3000

var url = "";

// Parse the URL to get query parameters
var urlParams = "";


let obj_tier = null;
let int_threshold = 5000;
let step_two_form_session = {};


function getProposalData()
{
    apiGet(_b_use_proxy_endpoints ? '/api/Proposal/GetProposal' : '/api/Proposal', {}, function (err, obj_response)
    {
        if (err)
        {
            console.error("GetProposal failed, navigating back to step one")
            console.error(err.toString())
            location.href= "/step-one/step-one.html";  
        }
        else
        {
            obj_proposal = obj_response
            // Assign values from get proposal
            var malDate = obj_response.firstRepaymentDate;

            // Calculate borrow amounts and max loan
            monthlyIncome = obj_response.customers[0].salary;

            // Set max loan borrow up to 2 x of income amount
            maxLoan = Math.min(Math.floor(monthlyIncome * 2), threshold);
            maxLoan = Math.round(maxLoan - (maxLoan % 100)); // round off to lower 100s


            $('#loanMessage').text("You have been credit check approved to borrow up to £" + maxLoan.toLocaleString('en-US') + ".");
            if (urlParams.has('loanAmount')) 
            {
                // Get the value of the "mike" parameter
                var loan_amount_url = urlParams.get('loanAmount');
                $('#loanAmount').val(loan_amount_url);
            }
            else
            {
                $('#loanAmount').val(maxLoan);
            }
            let obj_first_payment_date = formatDate(new Date(obj_response.firstPaymentDate));
            $('#firstRepaymentDate').text(obj_first_payment_date);

            if (maxLoan >= MAX_LOAN_AMOUNT_36_MONTH_TERM && (loan_amount_url ? loan_amount_url >= MAX_LOAN_AMOUNT_36_MONTH_TERM : true))
            {
                var radio36HTML = `
                    <label class="form-check-label">
                    <input id="optionsRadios36" class="form-check-input" type="radio" name="loanTerm" value="36" checked="true">
                    36 months
                    </label>
                `;

                document.getElementById('radio36Placeholder').innerHTML = radio36HTML;
                $('#radio36Placeholder').removeClass('hidden');
                $('#optionsRadios24').prop('checked', true);
            }
            else
            {
                document.getElementById('radio36Placeholder').innerHTML = "";
                $('#radio36Placeholder').addClass('hidden');
                $('#optionsRadios24').prop('checked', true);
            }
        }
    });
}

function validateLoanAmount(field)
{
    const input = field.value;
    if (!validateMultipleOf100(input)) 
    {
        $('#loanAmountErrorMessage').text("Loan amount should be in multiples of 100");
        $('#loanAmount').addClass('validation-error-border').removeClass('is-valid');
    }
    else
    {
        $('#loanAmountErrorMessage').text("");
        $('#loanAmount').addClass('is-valid').removeClass('validation-error-border');
    }

    if (input < 1000)
    {
        $('#loanAmountErrorMessage').text("Loan amount must be greater than or equal to £1000");
        $('#loanAmount').addClass('validation-error-border').removeClass('is-valid');
    }
    else
    {
        if (!validateMultipleOf100(input)) 
        {
            $('#loanAmountErrorMessage').text("Loan amount should be in multiples of 100");
            $('#loanAmount').addClass('validation-error-border').removeClass('is-valid');
        }
        else
        {
            if(input > maxLoan)
            {
                $('#loanAmountErrorMessage').text("Loan amount cannot be greater than twice your monthly income, or greater than £5,000");
                $('#loanAmount').addClass('validation-error-border');
                $('#loanAmount').removeClass('is-valid');
            }
            else
            {
                $('#loanAmountErrorMessage').text("");
                $('#loanAmount').addClass('is-valid').removeClass('validation-error-border');
            }
        }
    }

    if (maxLoan >= MAX_LOAN_AMOUNT_36_MONTH_TERM && input >= MAX_LOAN_AMOUNT_36_MONTH_TERM)
    {
        var radio36HTML = `
            <label class="form-check-label">
            <input id="optionsRadios36" class="form-check-input" type="radio" name="loanTerm" value="36" checked="true">
            36 months
            </label>
        `;

        document.getElementById('radio36Placeholder').innerHTML = radio36HTML;
        $('#radio36Placeholder').removeClass('hidden');
        $('#optionsRadios36').prop('checked', false);
        $('#optionsRadios24').prop('checked', true);
    }
    else
    {
        document.getElementById('radio36Placeholder').innerHTML = '';
        $('#radio36Placeholder').addClass('hidden');
        $('#optionsRadios24').prop('checked', true);
    }
    
}

function validateMultipleOf100(value) 
{
    const int_number = Number(value);
    if (!Number.isInteger(int_number) || int_number % 100 !== 0) 
    {
        return false;
    }
    return true;
}

function onSubmit()
{
    // Clear errors
    $('#loanAmount').removeClass('validation-error-border');
    $('#loanAmount').addClass('is-valid');
    var b_errors = false;
    if ($('#loanAmount').val() > maxLoan)
    {
        $('#loanAmountErrorMessage').text("Loan amount cannot be greater than twice your monthly income, or greater than £5,000");
        $('#loanAmount').addClass('validation-error-border');
        $('#loanAmount').removeClass('is-valid');
        b_errors = true;
    }
    if ($('#loanAmount').val() == "")
    {
        $('#loanAmountErrorMessage').text("Please enter a loan amount");
        $('#loanAmount').addClass('validation-error-border');
        $('#loanAmount').removeClass('is-valid');
        b_errors = true;
    }

    if (!validateMultipleOf100($('#loanAmount').val())) 
    {
        $('#loanAmountErrorMessage').text("Loan amount should be in multiples of 100");
        $('#loanAmount').addClass('validation-error-border').removeClass('is-valid');
        b_errors = true;
    }

    if (!b_errors)
    {

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
                str_broker_name: obj_proposal.salesmanName || ""
            },
            loanBorrowForm:
            {
                loanTerm: null,
                loanAmount: null,
                maxLoan: null
            },
            statusCode: 189,
        }

        showSpinner();
        
        b_continue_pressed = true;

        if ($("#optionsRadios36").prop("checked") == true)
        {
            obj_proposal.loanTerm = 36;
            requestBody.loanBorrowForm.loanTerm = 36;
            proposal_session.checked_36_months = true;
        }
        if ($("#optionsRadios24").prop("checked") == true)
        {
            obj_proposal.loanTerm = 24;
            requestBody.loanBorrowForm.loanTerm = 24;
            proposal_session.checked_36_months = false;
        }
        if ($("#optionsRadios18").prop("checked") == true)
        {
            obj_proposal.loanTerm = 18;
            requestBody.loanBorrowForm.loanTerm = 18;
            proposal_session.checked_36_months = false;
        }
        if ($("#optionsRadios12").prop("checked") == true)
        {
            obj_proposal.loanTerm = 12;
            requestBody.loanBorrowForm.loanTerm = 12;
            proposal_session.checked_36_months = false;
        }
        if ($("#optionsRadios9").prop("checked") == true)
        {
            obj_proposal.loanTerm = 9;
            requestBody.loanBorrowForm.loanTerm = 9;
            proposal_session.checked_36_months = false;
        }
        
        requestBody.loanBorrowForm.loanAmount = parseFloat($('#loanAmount').val());
        requestBody.loanBorrowForm.maxLoan = maxLoan;
        
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
                    proposal_session.statusCode = obj_response.statusCode;
                    proposal_session.loanBorrowForm =
                    {
                        loanAmount : parseFloat($('#loanAmount').val()),
                        maxLoan : maxLoan,
                        loanTerm : obj_proposal.loanTerm
                    }
    
                    // sessionStorage.setItem('proposal', JSON.stringify(proposal_session));
                    location.href = "/step-three/step-three.html";
                }
                else
                {
                    hideSpinner();
                    location.href = "/application-declined/application-declined.html";
                }
            }
        })

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

function getPageData()
{
   
    getProposalData();
    // storeEmailSmsVerified();
}

function storeEmailSmsVerified()
{
    apiPut('/api/Proposal/Verify/Mobile/Verified', { Verified : proposal_session.mobileVerified }, function (err, obj_response)
    {
        if (err)
        {
            console.log(err);
        }
    })	

    // apiPut('/api/Proposal/Verify/Email/Verified', { Verified : proposal_session.emailVerified }, function (err, obj_response)
    // {
    //     if (err)
    //     {
    //         console.log(err);
    //     }
    // })	
}

function update36MonthWarning()
{
    var is36 = $('#radio36Placeholder input[type="radio"]').prop('checked');
    if (is36)
    {
        $('#36_month_warning').text('Did you know, choosing a 24-month term instead of 36 months means you\'ll save money on interest over the full term of the loan and pay your loan off sooner. If the monthly payments are manageable, it could be a more cost-effective option.').removeClass('hidden');
    }
    else
    {
        $('#36_month_warning').addClass('hidden');
    }
}

document.addEventListener("DOMContentLoaded", function ()
{
    url = window.location.href;
    urlParams = new URLSearchParams(window.location.search);
    getPageData();

    $(document).on('change', 'input[name="loanTerm"]', function ()
    {
        update36MonthWarning();
    });
});

function disableBack() { window.history.forward(); }
setTimeout("disableBack()", 0);
window.onunload = function () { null };