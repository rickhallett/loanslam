let obj_proposal = {}
let proposal_session = {};
let total_cost_24 = 0;
let difference = 0;

var b_continue_pressed = false;

function nextStep()
{
    showSpinner();
    b_continue_pressed = true;

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

    const loanBorrowForm = {
        loanTerm: obj_proposal.term,
        loanAmount: obj_proposal.principal,
        maxLoan: Math.min(Math.max(Math.ceil((customer.salary * 2) / 100) * 100, 1000), 5000)
    }

    let requestBody = {
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
            loanBorrowForm
        },
        loanBorrowForm,
        statusCode: 168
    };

    var func_api		= apiPutJSON;
	var str_endpoint	= '/api/Proposal';
	if(_b_use_proxy_endpoints)
	{
		func_api		= apiPostJSON;
		str_endpoint	= '/api/Proposal/UpdateProposal';
	}
	func_api(str_endpoint, requestBody, function(err, obj_response)
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

            if(bool_active_code)
            {
                proposal_session.statusCode = obj_response.statusCode;
                hideSpinner();
                location.href = "/step-six/step-six.html";
            }
            else
            {
                hideSpinner();
                location.href = "/application-declined/application-declined.html";
            }
        }
    })
}


function prevStep()
{
    b_continue_pressed = true;
    location.href = "/step-two/step-two.html?" + 'loanAmount=' + obj_proposal.principal.toFixed(2) ;
}

function displayData()
{
    $('#txtAmount').text('£' + obj_proposal.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    $('#txtMonthlyPayment').text('£' + parseFloat(obj_proposal.netInstalment).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    $('#txtTerm').text(obj_proposal.term);
    let totalCostOfCredit = obj_proposal.netInstalment * obj_proposal.term;
    $('#txtTotalRepayable').text('£'+totalCostOfCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    $('#txtInterestRate').text(parseFloat(obj_proposal.interestRateUpLift).toFixed(2) + "%");
    let loanAdvance = obj_proposal.principal;
    difference = (totalCostOfCredit - loanAdvance);
    $('#txtTotalCharge').text('£' + difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    $('#txtApr').text(obj_proposal.apr.toFixed(2) + '%');
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
            obj_proposal = obj_response;
			$('#txtAmount').text('£' + obj_proposal.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
			$('#txtMonthlyPayment').text('£' + parseFloat(obj_proposal.netInstalment).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
			$('#txtTerm').text(obj_proposal.term);
            let totalCostOfCredit = obj_proposal.netInstalment * obj_proposal.term;
            $('#txtTotalRepayable').text('£'+totalCostOfCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            $('#txtInterestRate').text(parseFloat(obj_proposal.interestRateUpLift).toFixed(2) + "%");
            let loanAdvance = obj_proposal.principal;
            let difference = (totalCostOfCredit - loanAdvance);
            $('#txtTotalCharge').text('£' + difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            $('#txtApr').text(obj_proposal.apr.toFixed(2) + '%');

            if(obj_response.term == 36)
            {
                let int_total_cost_difference = difference - total_cost_24;
                // if(int_total_cost_difference == 0)
                //     str_36_month_difference = "Did you know, choosing a 24-month term instead of 36 months means you'll pay your loan off sooner and save money on interest over the full term of the loan. If the monthly payments are manageable, it could be a more cost-effective option."
                // else
                // {
                //     str_36_month_difference = "Did you know, choosing a 24-month term instead of 36 months means you'll pay your loan off sooner and save £" + int_total_cost_difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " in interest over the full term of the loan. If the monthly payments are manageable, it could be a more cost-effective option."
                //     $('#save_amount').text('Save £' + int_total_cost_difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                // }
                
                let str_36_month_difference = "Did you know, choosing a 24-month term instead of 36 months means you\'ll save money on interest over the full term of the loan and pay your loan off sooner. If the monthly payments are manageable, it could be a more cost-effective option."
                $('#36_month_difference').text(str_36_month_difference);
                $('#36_month_message').removeClass('hidden');
            }
            hideSpinner();
		}
	});
}

document.addEventListener("DOMContentLoaded", function ()
{
    getProposalData();
    showSpinner();

});

function disableBack() { window.history.forward(); }
setTimeout("disableBack()", 0);
window.onunload = function () { null };