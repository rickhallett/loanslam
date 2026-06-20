let obj_broker_data = {};
let obj_proposal = {}
let proposal_session = {};
let commission_agreed = false;
let str_signature_entry = "";
let b_signature_correct = false;
const doneBtn = $('#doneBtn');
const submitBtn = $('#btnSubmit');
let b_continue_pressed = false;
let current_section = 0;

let obj_sections_completed_check = 
{
	bool_explanation_complete : false,
	bool_precredit_complete :  false,
	bool_terms_complete : false,
	bool_importantinfo_complete : false
}

function scrollToBottom()
{
	if(proposal_session.isBrokerJourney)
	{
		if(!commission_agreed)
			scrollToCheckbox();
		else
		{
			setTimeout(() => {
    			$('#content_body').scrollTop(999999);
			}, 100);
		}
	}
	else
	{
		setTimeout(() => {
    		$('#content_body').scrollTop(999999);
		}, 100);
	}
}

function scrollToCheckbox()
{
	$('#content_body').scrollTop(
		$('#commission_header').offset().top - $('#content_body').offset().top + $('#content_body').scrollTop()
	);
}

function returnToTop()
{
window.scrollTo(0, 0);
}

function scrollDocumentsToTop() 
{
   	const element = document.querySelector('.documents-body#content_body');
	if(element) 
	{
       element.scrollTop = 0;
   	}
}

function openContent()
{
	$('#buttons_page').addClass('hidden');
	$('#footer').addClass('hidden');
	$('#trust_pilot').addClass('hidden');
	$('#header').addClass('hidden');
	$('body').addClass('flex-layout');
	$('#content_page').removeClass('hidden');
}

function closeContent()
{
	$('#trust_pilot').removeClass('hidden');
	$('#header').removeClass('hidden');
	$('#footer').removeClass('hidden');
	$('#buttons_page').removeClass('hidden');
	$('#content_page').addClass('hidden');
	$('body').removeClass('flex-layout')
	returnToTop();
}

function clearSignatureClasses(field)
{
	b_signature_correct = false;
	$('#signatureErrorMessage').text('');
	$('#signature').removeClass('validation-error-border');
	const input = field.value;
	str_signature_entry = input;
	let str_signature_compare = input.toLowerCase().replaceAll(' ', '');
	let str_name_compare = obj_broker_data.firstName.toLowerCase().replaceAll(' ', '') + obj_broker_data.lastName.toLowerCase().replaceAll(' ', '');

	if(str_signature_compare != str_name_compare)
	{
		$('#signatureErrorMessage').text('Please enter your name exactly as displayed above');
		$('#signature').addClass('validation-error-border');
		b_signature_correct = false;
	}
	else
	{
		b_signature_correct = true;
	}
}

function recordCommissionCheck(checkbox)
{
	commission_agreed = checkbox.checked;

	if(commission_agreed)
		$('#commissionErrorMessage').text('');
}

function getBase64ImageFromURL(url)
{
	return new Promise((resolve, reject) =>
	{
		var img = new Image();
		img.setAttribute("crossOrigin", "anonymous");

		img.onload = function ()
		{
			var canvas = document.createElement("canvas");
			canvas.width = img.width;
			canvas.height = img.height;

			var ctx = canvas.getContext("2d");
			ctx.drawImage(img, 0, 0);

			var dataURL = canvas.toDataURL("image/png");

			resolve(dataURL);
		};

		img.onerror = function (error)
		{
			reject(error);
		};

		img.src = url;
	});
}

async function generatePdf()
{
	const pdfTable = document.getElementById('content_body').innerHTML;

	var html = htmlToPdfmake(pdfTable);

	const imageDefinitions = {
		image: await getBase64ImageFromURL("../assets/images/header-logo.png"),
		width: 200,
		alignment: 'center',
		margin: [-20, 0, 0, 0]
	};
	const documentDefinition = {
		content: [imageDefinitions, html],
		styles: {
			'primary-message-text': {
				color: '#00879b'
			}
		}
	};

	const pdfDocGenerator = pdfMake.createPdf(documentDefinition);

	pdfDocGenerator.getBlob(async (blob) =>
	{
		let blobUrl = URL.createObjectURL(blob);
		var newWin = window.open(blobUrl);
		if (!newWin || newWin.closed || typeof newWin.closed == 'undefined')
		{
			alert("To download the PDF, please disable any pop-up blockers in browser Settings.");
		}

	});
}

function completeSection(obj_section)
{
	var section = "";
	section = obj_section;

	let done_html = `<i class="fa fa-check fa-fw"></i>&nbsp;&nbsp;Done`;
	doneBtn.html(done_html);

	if (section == "explanation")
	{
		current_section = 1;
		let str_replacement = explanation;
		str_replacement = str_replacement
                        .replace(/%loanAdvance%/g, obj_broker_data.loanAdvance)
		                .replace(/%noOfRepayment%/g, obj_broker_data.noOfRepayment)
		                .replace(/%netInstalment%/g, obj_broker_data.netInstalment)
		                .replace(/%totalInterest%/g, obj_broker_data.totalInterest)
		                .replace(/%totalRepyamentAmount%/g, obj_broker_data.totalRepyamentAmount)
		                .replace(/%dailyInterestAmount%/g, obj_broker_data.dailyInterestAmount)
		                .replace(/%agreementNumber%/g, obj_broker_data.agreementNumber)
		                .replace(/%registeredOffice%/g, "Bourne Park, Exeter Park Road, Bournemouth, BH2 5BD");

		let str_commission = getCommission(obj_broker_data.brokerDetails.salesmanName, obj_broker_data.loanAdvance);

		let str_broker_commission = "<br><br>The broker who introduced to us is %BROKER%. We pay them a commission of %COMMISSION% to them for referring you to us. This commission will never be applied to the cost of your loan and doesn't affect the amount you pay.";

		let broker_name = obj_broker_data.brokerDetails.salesmanName;
		if(broker_name.includes("Choose Wisely"))
			broker_name = "Choose Wisely";
		else if(broker_name.includes("ClearscoreAro") || broker_name.includes('Aro'))
			broker_name = "Clearscore";

		if(proposal_session.isBrokerJourney)
		{
			str_broker_commission = str_broker_commission
                                .replace(/%BROKER%/g, broker_name)
			                    .replace(/%COMMISSION%/g, str_commission)
			str_replacement = str_replacement.replace(/%brokerCommission%/g, str_broker_commission);
		}
		else
		{
			str_replacement = str_replacement.replace(/%brokerCommission%/g, "");
		}

		openContent();
		$('#content_title').text('Explanation of Your Fixed Sum Loan Agreement');
		$('#content_body').html(str_replacement);
		scrollDocumentsToTop();
	}
	else if (section == "precredit")
	{
		current_section = 2;
		let str_replacement = precredit;
		let broker_name = obj_broker_data.brokerDetails.salesmanName;
		if(broker_name.includes("Choose Wisely"))
			broker_name = "Choose Wisely";
		else if(broker_name.includes("ClearscoreAro") || broker_name.includes('Aro'))
			broker_name = "Clearscore";
		str_replacement = str_replacement
                        .replace(/%loanAdvance%/g, obj_broker_data.loanAdvance)
		                .replace(/%noOfRepayment%/g, obj_broker_data.noOfRepayment)
		                .replace(/%netInstalment%/g, obj_broker_data.netInstalment)
		                .replace(/%totalRepyamentAmount%/g, obj_broker_data.totalRepyamentAmount)
		                .replace(/%interestRate%/g, obj_broker_data.interestRate)
		                .replace(/%apr%/g, obj_broker_data.apr)
		                .replace(/%dailyInterestAmount%/g, obj_broker_data.dailyInterestAmount)
		                .replace(/%agreementDate%/g, obj_broker_data.agreementDate)
		                .replace(/%agreementNumber%/g, obj_broker_data.agreementNumber)
		                .replace(/%registeredOffice%/g, "Bourne Park, Exeter Park Road, Bournemouth, BH2 5BD");

		if(proposal_session.isBrokerJourney == true)
		{
			str_replacement = str_replacement.replace(/%BROKERTERMS%/g, '<div class="row"><div class="col-md-6">Credit Intermediary.</div><div class="col-md-6">'+ broker_name + '</div><div class="col-md-12 border-bottom"></div><div class="col-md-6">Credit Intermediary Address.</div><div class="col-md-6">' + obj_broker_data.brokerDetails.salesmanAddress + '</div><div class="col-md-12 border-bottom"></div></div>');
		}
		else
		{
			str_replacement = str_replacement.replace(/%BROKERTERMS%/g, "");
		}

		openContent();
		$('#content_title').text('Pre-Contract Credit Information');
		$('#content_body').html(str_replacement);
		scrollDocumentsToTop();
	}
	else if (section == "terms")
	{
		current_section = 3;
		let str_replacement = terms;
		str_replacement = str_replacement.replace(/%registeredOffice%/g, "Bourne Park, Exeter Park Road, Bournemouth, BH2 5BD");
		
		openContent();
		$('#content_title').text('Terms And Conditions');
		$('#content_body').html(str_replacement);
		scrollDocumentsToTop();
	}
	else if (section == "importantinfo")
	{
		current_section = 4;
		let str_replacement = importantinfo;
        const splitArray = obj_broker_data.address.split(","); 
		const filteredArray = splitArray.filter(item => item.trim() != "");
		const resultString = filteredArray.join(",");
        let obj_date = new Date();
        let html = '';

		// Iterate over the items array and generate HTML
		obj_broker_data.repaymentsList.forEach(item =>
		{
			let listItemHTML = `<li style="padding: 10px 0px;">${item} <br /></li>`;
			html += listItemHTML;
		});

        let str_commission = getCommission(obj_broker_data.brokerDetails.salesmanName, obj_broker_data.loanAdvance);
		let commission_html  =
		`
		<h4 id="commission_header">Introducer commission </h4>
		<p>The broker who introduced to us is %BROKER%. We pay them a commission of %COMMISSION% to them for referring you to us. This commission will never be applied to the cost of your loan and doesn't affect the amount you pay.</p>
		<div class="form-check">
			<input type="checkbox" id="agreed_commission" class="form-check-input" oninput="recordCommissionCheck(this)"/>
			<label class="form-check-label" for="agreed_commission">   By continuing, you understand and agree to the Loans By MAL commision structure.</label>
		</div>
		<p id="commissionErrorMessage" style="color: red; font-weight: normal;" />
		`

		str_replacement = str_replacement
                        .replace(/%firstName%/g, capitalizeFirstLetter(obj_broker_data.firstName))
		                .replace(/%lastName%/g, capitalizeFirstLetter(obj_broker_data.lastName))
		                .replace(/%address%/g, resultString)
		                .replace(/%lastName%/g, obj_broker_data.lastName)
		                .replace(/%email%/g, obj_broker_data.email)
		                .replace(/%noOfRepayment%/g, obj_broker_data.noOfRepayment)
		                .replace(/%loanAdvance%/g, obj_broker_data.loanAdvance)
		                .replace(/%totalInterest%/g, obj_broker_data.totalInterest)
		                .replace(/%totalRepyamentAmount%/g, obj_broker_data.totalRepyamentAmount)
		                .replace(/%interestRate%/g, obj_broker_data.interestRate)
		                .replace(/%apr%/g, obj_broker_data.apr)
		                .replace(/%registeredOffice%/g, "Bourne Park, Exeter Park Road, Bournemouth, BH2 5BD")
		                .replace(/%date%/g, obj_date.toFormattedString('d/m/Y'))
		                .replace(/%dailyInterestAmount%/g, obj_broker_data.dailyInterestAmount)
                        .replace(/%repaymentItems%/g, html)
		                .replace(/%agreementNumber%/g, obj_broker_data.agreementNumber)
		                .replace(/%firstName%/g, obj_broker_data.firstName)
		                .replace(/%lastName%/g, obj_broker_data.lastName);


		let broker_name = obj_broker_data.brokerDetails.salesmanName;
		if(broker_name.includes("Choose Wisely"))
			broker_name = "Choose Wisely";
		else if(broker_name.includes("ClearscoreAro") || broker_name.includes('Aro'))
			broker_name = "Clearscore";

		if(proposal_session.isBrokerJourney == true)
		{
			commission_html = commission_html
                            .replace(/%BROKER%/g, broker_name)
			                .replace(/%COMMISSION%/g, str_commission)
			str_replacement = str_replacement
                            .replace(/%commissionAgreement%/g, commission_html)
                            .replace(/%credit_intermediary%/g, '<div class="row"><div class="col-sm-12"> The credit intermediary (if any) is: <span id="creditIntermediary">'+ broker_name + ', ' + obj_broker_data.brokerDetails.salesmanAddress + '</span> </div></div>')
                            .replace(/%salesmanName%/g, broker_name)
                            .replace(/%salesmanAddress%/g, obj_broker_data.brokerDetails.salesmanAddress);
		}
		else
		{
			str_replacement = str_replacement
                            .replace(/%credit_intermediary%/g, '')
			                .replace(/%commissionAgreement%/g, '')
                            .replace(/%salesmanAddress%/g, '')
                            .replace(/%salesmanAddress%/g, '');
		}

		openContent();
		$('#content_title').text('Important Information: Your Loan Agreement');
		$('#content_body').html(str_replacement);
		scrollDocumentsToTop();

		if(b_signature_correct)
		{
			$('#signature').val(str_signature_entry);
		}

		if(proposal_session.isBrokerJourney && commission_agreed)
		{
			$('#agreed_commission').prop('checked', true);
		}
	}
}

$('#content_body').on('scroll', function ()
{
	if(current_section == 4)
	{
		var scrollTop = $(this).scrollTop();
		var innerHeight = $(this).innerHeight();
		var scrollHeight = $(this)[0].scrollHeight;

		if (scrollTop + innerHeight >= scrollHeight - 40)
		{
			let accept_html =
				`<i class="fa fa-check fa-fw"></i>&nbsp;&nbsp;Accept`;
			doneBtn.html(accept_html);
		}
	}
});

$('#doneBtn').click(function ()
{
	if (current_section == 1)
	{
		obj_sections_completed_check.bool_explanation_complete = true;
		$('#explanation').removeClass('incomplete-alert');
		$('#explanation').addClass('completed-alert');
		$('#explanation_required').hide();
		$('#explanation_tick').removeClass('hidden');
	}
	else if (current_section == 2)
	{
		obj_sections_completed_check.bool_precredit_complete = true;
		$('#precredit').removeClass('incomplete-alert');
		$('#precredit').addClass('completed-alert');
		$('#precredit_required').hide();
		$('#precredit_tick').removeClass('hidden');
	}
	else if (current_section == 3)
	{
		obj_sections_completed_check.bool_terms_complete = true;
		$('#terms').removeClass('incomplete-alert');
		$('#terms').addClass('completed-alert');
		$('#terms_required').hide();
		$('#terms_tick').removeClass('hidden');
	}

	if(current_section != 4)
	{
		closeContent();
		returnToTop();
		checkAllCompleted();
	}
	else
	{
		if(b_signature_correct && (proposal_session.isBrokerJourney ? commission_agreed : !commission_agreed))
		{
			$('#importantinfo').removeClass('incomplete-alert');
			$('#importantinfo').addClass('completed-alert');
			$('#importantinfo_required').hide();
			$('#importantinfo_tick').removeClass('hidden');
			obj_sections_completed_check.bool_importantinfo_complete = true;
			closeContent();
			returnToTop();
			checkAllCompleted();
		}
		else
		{
			if(proposal_session.isBrokerJourney && !commission_agreed)
			{
				scrollToCheckbox();
				$('#commissionErrorMessage').text('Please confirm to continue');

				if(!b_signature_correct)
				{
					$('#signatureErrorMessage').text('Please type your full name exactly as it appears on your application.');
					$('#signature').addClass('validation-error-border');
					$('#signature').removeClass('is-valid');
				}
			}
			else
			{
				if(proposal_session.isBrokerJourney)
					$('#commissionErrorMessage').text('');

				scrollToBottom();
				$('#signatureErrorMessage').text('Please type your full name exactly as it appears on your application.');
				$('#signature').addClass('validation-error-border');
				$('#signature').removeClass('is-valid');
			}
			
		}
	}
})

function checkAllCompleted()
{
	if (obj_sections_completed_check.bool_explanation_complete && obj_sections_completed_check.bool_importantinfo_complete && obj_sections_completed_check.bool_precredit_complete && obj_sections_completed_check.bool_terms_complete)
	{
		nextStep();
	}
}

function nextStep()
{
	if (b_signature_correct && (proposal_session.isBrokerJourney ? commission_agreed : !commission_agreed))
	{
		$('#signatureErrorMessage').text('');
		$('#signature').removeClass('validation-error-border');

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
			statusCode: 167,
		}

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
					sessionStorage.setItem('proposal', JSON.stringify(proposal_session));
					hideSpinner();
					location.href = "/step-four/step-four.html";
				}
				else
				{
					hideSpinner();
					location.href = "/application-declined/application-declined.html";
				}
			}
		})
	}
	else
	{
		let str_replacement = importantinfo;
        const splitArray = obj_broker_data.address.split(","); 
		const filteredArray = splitArray.filter(item => item.trim() != "");
		const resultString = filteredArray.join(",");
        let obj_date = new Date();
        let html = '';

		// Iterate over the items array and generate HTML
		obj_broker_data.repaymentsList.forEach(item =>
		{
			let listItemHTML = `<li style="padding: 10px 0px;">${item} <br /></li>`;
			html += listItemHTML;
		});

        let str_commission = getCommission(obj_broker_data.brokerDetails.salesmanName, obj_broker_data.loanAdvance);
		let commission_html  =
		`
		<h4 id="commission_header">Introducer commission </h4>
		<p>The broker who introduced to us is %BROKER%. We pay them a commission of %COMMISSION% to them for referring you to us. This commission will never be applied to the cost of your loan and doesn't affect the amount you pay.</p>
		<div class="form-check">
			<input type="checkbox" id="agreed_commission" class="form-check-input" oninput="recordCommissionCheck(this)"/>
			<label class="form-check-label" for="agreed_commission">   By continuing, you understand and agree to the Loans By MAL commision structure.</label>
		</div>
		<p id="commissionErrorMessage" style="color: red; font-weight: normal;" />
		`

		str_replacement = str_replacement
                        .replace(/%firstName%/g, capitalizeFirstLetter(obj_broker_data.firstName))
		                .replace(/%lastName%/g, capitalizeFirstLetter(obj_broker_data.lastName))
		                .replace(/%address%/g, resultString)
		                .replace(/%lastName%/g, obj_broker_data.lastName)
		                .replace(/%email%/g, obj_broker_data.email)
		                .replace(/%noOfRepayment%/g, obj_broker_data.noOfRepayment)
		                .replace(/%loanAdvance%/g, obj_broker_data.loanAdvance)
		                .replace(/%totalInterest%/g, obj_broker_data.totalInterest)
		                .replace(/%totalRepyamentAmount%/g, obj_broker_data.totalRepyamentAmount)
		                .replace(/%interestRate%/g, obj_broker_data.interestRate)
		                .replace(/%apr%/g, obj_broker_data.apr)
		                .replace(/%registeredOffice%/g, "Bourne Park, Exeter Park Road, Bournemouth, BH2 5BD")
		                .replace(/%date%/g, obj_date.toFormattedString('d/m/Y'))
		                .replace(/%dailyInterestAmount%/g, obj_broker_data.dailyInterestAmount)
                        .replace(/%repaymentItems%/g, html)
		                .replace(/%agreementNumber%/g, obj_broker_data.agreementNumber)
		                .replace(/%firstName%/g, obj_broker_data.firstName)
		                .replace(/%lastName%/g, obj_broker_data.lastName);

		let broker_name = obj_broker_data.brokerDetails.salesmanName;
		if(broker_name.includes("Choose Wisely"))
			broker_name = "Choose Wisely";
		else if(broker_name.includes("ClearscoreAro") || broker_name.includes('Aro'))
			broker_name = "Clearscore";
		
		if(proposal_session.isBrokerJourney == true)
		{
			commission_html = commission_html
                            .replace(/%BROKER%/g, broker_name)
			                .replace(/%COMMISSION%/g, str_commission)
			str_replacement = str_replacement
                            .replace(/%commissionAgreement%/g, commission_html)
                            .replace(/%credit_intermediary%/g, '<div class="row"><div class="col-sm-12"> The credit intermediary (if any) is: <span id="creditIntermediary">'+ broker_name + ', ' + obj_broker_data.brokerDetails.salesmanAddress + '</span> </div></div>')
                            .replace(/%salesmanName%/g, broker_name)
                            .replace(/%salesmanAddress%/g, obj_broker_data.brokerDetails.salesmanAddress);
		}
		else
		{
			str_replacement = str_replacement
                            .replace(/%credit_intermediary%/g, '')
			                .replace(/%commissionAgreement%/g, '')
                            .replace(/%salesmanAddress%/g, '')
                            .replace(/%salesmanAddress%/g, '');
		}
		
		openContent();
		$('#content_title').text('Important Information: Your Loan Agreement');
		$('#content_body').html(str_replacement);
		returnToTop();

		if(!b_signature_correct)
		{
			$('#signatureErrorMessage').text('Please type your full name exactly as it appears on your application.');
			$('#signature').addClass('validation-error-border');
			$('#signature').removeClass('is-valid');
		}
		else
		{
			$('#signature').val(str_signature_entry);
			scrollToCheckbox();
		}
		if(proposal_session.isBrokerJourney && !commission_agreed)
		{
			$('#commissionErrorMessage').text('Please confirm to continue');
		}
		else
		{
			$('#agreed_commission').prop('checked', true);
			$('#commissionErrorMessage').text('');
		}
	}
}

function getProposalData()
{
    apiGet(_b_use_proxy_endpoints ? '/api/Proposal/GetProposal' : '/api/Proposal', {}, function (err, obj_response)
    {
        if (err)
        {
            console.error(err)
            console.error("sending user back to step one: GetProposal failed")
            location.href= "/step-one/step-one.html"; 
        }
        else
        {
            obj_proposal = obj_response;
		}
	})
}

function getBrokerData()
{

	apiGet(_b_use_proxy_endpoints ? '/api/Proposal/GetProposal?GetAgreement=true' : '/api/Proposal?GetAgreement=true', {}, function (err, obj_response)
	{
		if (err)
		{
			console.error("sending user back to step one: GetProposal failed")
			console.error(err.toString())
			location.href = "/step-one/step-one.html";
		}
		else
		{
			obj_broker_data = obj_response;
			proposal_session.isBrokerJourney = obj_broker_data.brokerDetails.salesmanNumber === "00011" ? false : true
			hideSpinner();
		}
	});
}

// document.addEventListener('touchmove', function (e)
// {
// 	if (!e.target.closest('.scrollable-content') && !e.target.closest('.page-footer'))
// 	{
// 		e.preventDefault();
// 	}
// }, { passive: false });

function setViewportHeight()
{
	let vh = window.innerHeight * 0.01;
	document.documentElement.style.setProperty('--vh', `${vh}px`);
}

$(function() 
{
    setViewportHeight();
});

$(window).on('resize', setViewportHeight);

$(window).on('orientationchange', function ()
{
	setTimeout(setViewportHeight, 100);
});

document.addEventListener("DOMContentLoaded", function ()
{
	$('#explanation').on('click', function() { completeSection('explanation'); });
	$('#precredit').on('click', function() { completeSection('precredit'); });
	$('#terms').on('click', function() { completeSection('terms'); });
	$('#importantinfo').on('click', function() { completeSection('importantinfo'); });

	showSpinner();
	getBrokerData();
	getProposalData();
});