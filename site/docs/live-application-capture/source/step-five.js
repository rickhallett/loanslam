let proposal_session = {};
let obj_proposal = {};
let transactionId = null;
let authorizationCode = null
let str_customer_id = null;
let countdownInterval = null;
let int_card_attempts = 0;
const MAX_CARD_ATTEMPTS = 3;

let obj_card_number = ""
let obj_expiry_month = ""
let obj_expiry_year = ""
let obj_expiry_date = ""
let obj_card_holder_name = ""

let obj_form_completion_checks = 
{
    bool_nameOnCard_complete: false,
    bool_CVV_complete: false,
    bool_cardNumber_complete: false,
    bool_expiryMonth_complete: false,
    bool_expiryYear_complete: false,
}

const REASON_MESSAGES =
{
    'cardholder_cancellation':                  'Card verification failed. Please try again or use a different card.',
    'cardholder_cancelled':                     'Card verification failed. Please try again or use a different card.',
    'challenge_failed':                         'Card verification failed. Please try again or use a different card.',
    'challenge_not_completed':                  'Card verification failed. Please try again or use a different card.',
    'challenge_time_out':                       'Card verification failed. Please try again or use a different card.',
    'challenge_limit_exceeded':                 'Card verification failed. Please try again or use a different card.',
    'exceeds_authentication_frequency_limit':   'Card verification failed. Please try again or use a different card.',
    'acs_technical_issue':                      'Card verification failed. Please try again or use a different card.',
    'bad_gateway':                              'Card verification failed. Please try again or use a different card.',
    'fraud_scoring_error':                      'Card verification failed. Please try again or use a different card.',
    'above_max_amount':                         'Card verification failed. Please try again or use a different card.',
    'below_min_amount':                         'Card verification failed. Please try again or use a different card.',
    'above_max_transactions':                   'Card verification failed. Please try again or use a different card.',
    'exceeds_max_transactions':                 'Card verification failed. Please try again or use a different card.',
    'max_amount_day':                           'Card verification failed. Please try again or use a different card.',
    'max_amount_month':                         'Card verification failed. Please try again or use a different card.',
    'expired_card':                             'Card Expired. Please use a different card.',
    'card_not_active':                          'Card verification failed. Please try again or use a different card.',
    'closed_account':                           "We're unable to verify this card. Please use a different card.",
    'invalid_card_number':                      'Invalid card number.',
    'no_card_record':                           'Card verification failed. Please try again or use a different card.',
    'card_authentication_failed':               'Card verification failed. Please try again or use a different card.',
    'invalid_cvv':                              'Invalid CVV.',
    'invalid_pin':                              'Card verification failed. Please try again or use a different card.',
    'invalid_avs':                              'Card verification failed. Please try again or use a different card.',
    'blocklist_card':                           "We're unable to verify this card. Please use a different card.",
    'blocklist_bin':                            "We're unable to verify this card. Please use a different card.",
    'blocklist_email':                          "We're unable to verify this card. Please use a different card.",
    'blocklist_ip':                             "We're unable to verify this card. Please use a different card.",
    'blocklist_phone':                          "We're unable to verify this card. Please use a different card.",
    'transaction_disputed':                     "We're unable to verify this card. Please use a different card.",
    'suspected_fraud':                          "We're unable to verify this card. Please use a different card.",
    'transaction_fraud':                        "We're unable to verify this card. Please use a different card.",
    'fraud_scoring':                            "We're unable to verify this card. Please use a different card.",
    'security_failure':                         "We're unable to verify this card. Please use a different card.",
    'transaction_not_permitted_to_cardholder':  "We're unable to verify this card. Please use a different card.",
    'scheme_status_reason':                     "We're unable to verify this card. Please use a different card.",
    'lost_or_stolen':                           "We're unable to verify this card. Please use a different card.",
    'low_confidence':                           "We're unable to verify this card. Please use a different card.",
    'restricted_card':                          "We're unable to verify this card. Please use a different card.",
    'card_verification_failed':                 'Card verification failed. Please try again or use a different card.',
};

function nextStep()
{
    obj_card_number = $('#cardNumber').val().trim();
    obj_expiry_month = $('#expiryMonth').val().trim();
    obj_expiry_year = $('#expiryYear').val().trim();
    obj_expiry_date = $('#expiryMonth').val().trim() + '20' + $('#expiryYear').val().trim();
    obj_card_holder_name = $('#nameOnCard').val().trim();

    proposal_session.cardDetailsForm =
    {
        "cardHolderName": obj_card_holder_name,
        "creditDebitCardNumber": obj_card_number,
        "creditDebitCardExpiry": obj_expiry_month + "/" + obj_expiry_year,
        "expiryMonth": obj_expiry_month,
        "expiryYear": obj_expiry_year
    }
    
    updateProposal(true);
}

function createCustomerAcquired()
{
    $('#cardVerificationError').remove();

    $('#btnNextStep').addClass('hidden');
    $('#divClass').addClass('hidden');
    $('#cardProcessingSpinner').removeClass('hidden');
    $('#ob_iframe').removeClass('hidden');

    let obj_request =
    {
        first_name:		obj_proposal.customers[0].forename,
        last_name:		obj_proposal.customers[0].surname,
        dob:			obj_proposal.customers[0].dob.split('T')[0],
        line1:			obj_proposal.customers[0].addresses[0].line1,
        line2:			obj_proposal.customers[0].addresses[0].line2,
        city:			obj_proposal.customers[0].addresses[0].line3,
        postcode:		obj_proposal.customers[0].addresses[0].postCode,
        email:			obj_proposal.customers[0].email,
        mobile:			obj_proposal.customers[0].mobileNumber
    }

    apiPostJSON('/api/Acquired/CreateCustomer', obj_request, function (err, obj_response)
    {
        if(err)
        {
            console.error(err);
            console.error("CreateCustomer failed")
            console.error(err.toString());
            $('#ob_iframe').addClass('hidden');
            $('#cardProcessingSpinner').addClass('hidden');
            $('#divClass').removeClass('hidden');
            $('#btnNextStep').removeClass('hidden');
        }
        else
        {
            str_customer_id = obj_response.customer_id;
            validateCard();
        }
    })
}

function validateCard()
{
    proposal_session.cardDetailsForm =
    {
        "cardHolderName": $('#nameOnCard').val().trim(),
        "creditDebitCardNumber": $('#cardNumber').val().trim(),
        "creditDebitCardExpiry": $('#expiryMonth').val().trim() + "/" + $('#expiryYear').val().trim(),
        "expiryMonth": $('#expiryMonth').val().trim(),
        "expiryYear": $('#expiryYear').val().trim()
    };

    let obj_request =
    {
        amount:					0,
        moto:					false,
        capture:				false,
        create_card:			true,
        tds:					true,
        holder_name:			$('#nameOnCard').val().trim(),
        number:					$('#cardNumber').val().trim(),
        expiry_month:			parseInt($('#expiryMonth').val().trim()),
        expiry_year:			parseInt($('#expiryYear').val().trim()),
        cvv:					$('#CVV').val().trim(),
        customer_id:			str_customer_id,
        redirect_url:           window.location.origin + '/step-five/tds-callback.html'
    }

    console.log('Redirect URL being sent:', obj_request.redirect_url);

    window.addEventListener('message', handle3DSCallback);

    apiPostJSON('/api/Acquired/ProcessPayment', obj_request, function (err, obj_response)
    {
        if(err)
        {
            console.error('/api/Acquired/ProcessPayment API Error:', err.toString());
            $('#ob_iframe').addClass('hidden');
            $('#cardProcessingSpinner').addClass('hidden');
            $('#divClass').removeClass('hidden');
            $('#btnNextStep').removeClass('hidden');
            showCardError('Payment processing failed. Please try again.');
            window.removeEventListener('message', handle3DSCallback);
        }
        else
        {
            transactionId = obj_response.card_id;
            
            if(obj_response.status === 'tds_pending' && obj_response.links)
            {
                let obj_tds_link = obj_response.links.find(link => link.rel === 'tds');
                
                if(obj_tds_link)
                {
                    $('#tds_frame').attr('src', obj_tds_link.href);
                    $('#cardProcessingSpinner').addClass('hidden');

                    $('#ob_iframe')[0].scrollIntoView({ behavior: 'auto', block: 'start' });
                    
                    if(countdownInterval)
                    {
                        clearInterval(countdownInterval);
                        countdownInterval = null;
                    }
                    
                    $('#countdown').removeClass('hidden');
                    $('#btnSkip').addClass('hidden');
                    $('#skipHintText').removeClass('hidden');

                    let duration = 60;
                    $('#countdown').text(duration + "s...");

                    countdownInterval = setInterval(function ()
                    {
                        duration--;
                        $('#countdown').text(duration + "s...");

                        if (duration <= 0)
                        {
                            clearInterval(countdownInterval);
                            countdownInterval = null;
                            $('#countdown').addClass('hidden');
                            $('#btnSkip').removeClass('hidden');
                        }
                    }, 1000);
                }
            }
            else if(obj_response.status === 'success')
            {
                proposal_session.cardDetailsForm =
                {
                    "cardHolderName": $('#nameOnCard').val().trim(),
                    "creditDebitCardNumber": $('#cardNumber').val().trim(),
                    "creditDebitCardExpiry": $('#expiryMonth').val().trim() + "/" + $('#expiryYear').val().trim(),
                    "expiryMonth": $('#expiryMonth').val().trim(),
                    "expiryYear": $('#expiryYear').val().trim()
                };

                apiPut('/api/Proposal/Verify/DebitCard', {"Verified" : true}, function(err, obj_response)
                {
                    updateProposal(false);
                })
                console.log('Payment successful without 3DS');
                window.removeEventListener('message', handle3DSCallback);
            }
            else
            {
                console.log('Payment failed with status:', obj_response.status);
                window.removeEventListener('message', handle3DSCallback);
                $('#ob_iframe').addClass('hidden');
                $('#cardProcessingSpinner').addClass('hidden');
                $('#divClass').removeClass('hidden');
                $('#btnNextStep').removeClass('hidden');
                handlePaymentFailure(obj_response.status, obj_response.reason);
            }
        }
    })
}

function handle3DSCallback(event)
{
    if(event.data.type === 'tds_complete')
    {
        window.removeEventListener('message', handle3DSCallback);
        
        if(countdownInterval)
        {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        
        $('#ob_iframe').addClass('hidden');
        $('#divClass').removeClass('hidden');
        
        if(event.data.status === 'success')
        {
            transactionId = event.data.card_id;

            proposal_session.cardDetailsForm =
            {
                "cardHolderName": $('#nameOnCard').val().trim(),
                "creditDebitCardNumber": $('#cardNumber').val().trim(),
                "creditDebitCardExpiry": $('#expiryMonth').val().trim() + "/" + $('#expiryYear').val().trim(),
                "expiryMonth": $('#expiryMonth').val().trim(),
                "expiryYear": $('#expiryYear').val().trim()
            }
            
            apiPut('/api/Proposal/Verify/DebitCard', {"Verified" : true}, function(err, obj_response)
            {
                updateProposal(false);
            })
        }
        else
        {
            handlePaymentFailure(event.data.status, event.data.reason);
        }
    }
}

function handlePaymentFailure(status, reason)
{
    int_card_attempts++;
    
    if(int_card_attempts >= MAX_CARD_ATTEMPTS)
    {
        transactionId = null;
        authorizationCode = null;
        updateProposal(true);
        return;
    }

    let checkValue = reason || status;
    let message = REASON_MESSAGES[checkValue] || 'Card verification failed. Please try again or use a different card.';

    $('#ob_iframe').addClass('hidden');
    $('#cardProcessingSpinner').addClass('hidden');
    $('#divClass').removeClass('hidden');
    $('#btnNextStep').removeClass('hidden');
    showCardError(message);
}

function showCardError(message)
{
    $('#cardVerificationError').remove();
    
    let errorHtml = `
        <div id="cardVerificationError" style="color: #dc3545; background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 12px 20px; margin-bottom: 20px; border-radius: 4px; display: flex; align-items: center;">
            <i class="fa fa-exclamation-circle" style="margin-right: 10px; font-size: 1.2em;"></i>
            <span>${message}</span>
        </div>
    `;
    
    $('#cardDetails').prepend(errorHtml);
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
}

function clearCardForm()
{
    $('#cardNumber').val('');
    $('#expiryMonth').val('');
    $('#expiryYear').val('');
    $('#CVV').val('');
    $('#nameOnCard').val('');
    $('#issueNumber').val('');
    
    $('#cardNumber').removeClass('validation-error-border is-valid');
    $('#expiryMonth').removeClass('validation-error-border is-valid');
    $('#expiryYear').removeClass('validation-error-border is-valid');
    $('#CVV').removeClass('validation-error-border is-valid');
    $('#nameOnCard').removeClass('validation-error-border is-valid');
    $('#issueNumber').removeClass('validation-error-border is-valid');
    
    $('#cardNumberErrorMessage').text('');
    $('#PrimaryCardExpiryErrorMessage').text('');
    $('#CVVErrorMessage').text('');
    $('#nameOnCardErrorMessage').text('');
    $('#issueNumberErrorMessage').text('');
    
    obj_form_completion_checks = {
        bool_nameOnCard_complete: false,
        bool_CVV_complete: false,
        bool_cardNumber_complete: false,
        bool_expiryMonth_complete: false,
        bool_expiryYear_complete: false,
    };
    
    $('#btnNextStep').prop('disabled', true);
}

function getCardType(cardNumber)
{
    cardNumber = cardNumber.replace(/\s/g, '');
    
    if(!cardNumber || cardNumber.length < 2) return 'unknown';
    
    if(/^3[47]/.test(cardNumber)) return 'amex';
    
    return 'other';
}

function updateProposal(skipUpdateCard)
{
    proposal_session.transactionId = transactionId;
    proposal_session.authorizationCode = authorizationCode;
    showSpinner();

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
        incomeType: customer.typeOfBusiness,
        isNewJourney: true, // adding isNewJourney: true allows you to upload loanPurpose & dependants
        loanPurpose: obj_proposal.proposalPurpose || "",
        dependants: `${customer.dependantChildren}`,
        rentAmount: "0", // this 
        billsSplit: "0" // and this have to be here for this to work, this api has special needs
    };

    const cardDetailsForm = {
        cardHolderName: proposal_session.cardDetailsForm.cardHolderName,
        creditDebitCardNumber: proposal_session.cardDetailsForm.creditDebitCardNumber,
        creditDebitCardExpiry: proposal_session.cardDetailsForm.expiryMonth + "/" + proposal_session.cardDetailsForm.expiryYear,
        expiryMonth: proposal_session.cardDetailsForm.expiryMonth,
        expiryYear: proposal_session.cardDetailsForm.expiryYear
    }

    const accountDetailsForm = {
        accountHolderName: customer.bankAccountName,
        accountNumber: customer.bankAccountNumber,
        branchCode: customer.bankSortCode,
        isJointAccount: customer.bankJointAccount
    }

    const loanBorrowForm = {
        loanTerm: obj_proposal.term,
        loanAmount: obj_proposal.principal,
        maxLoan: Math.min(Math.max(Math.ceil((customer.salary * 2) / 100) * 100, 1000), 5000)
	}

    let requestBody = {
        customerForm,
        sessionData: {
            customerForm,
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
            accountDetailsForm,
            cardDetailsForm,
        },
        loanBorrowForm,
        accountDetailsForm,
        cardDetailsForm,
        transactionId: transactionId,
        authorizationCode: authorizationCode,
        statusCode: 184,
    }

    if(int_card_attempts >= MAX_CARD_ATTEMPTS || skipUpdateCard === true)
    {
        delete requestBody.cardDetailsForm;
        delete requestBody.sessionData.cardDetailsForm;
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
            console.error(err);
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
                location.href = "/step-eight/open-banking.html";
            }
            else
            {
                hideSpinner();
                location.href = "/application-declined/application-declined.html";
            }
        }
    })
}

function validateFields(field)
{
    const input = field.value;
    let obj_name = obj_proposal.customers[0].forename + ' ' + obj_proposal.customers[0].surname
    const expiryRegex = /^(0[1-9]|[1-9][0-9])$/;
    let todaysDate = new Date();

    switch (field.id)
    {
        case 'nameOnCard':
            const nameRegex = /^(?=(?:[^A-Za-z]*[A-Za-z]){2})[A-Za-z\-\'\s]+$/;
            if(input == "")
            {
                updateField(field.id, false, "Name is required.")
            }
            else if(!nameRegex.test(input))
            {
                updateField(field.id, false, "Please enter a valid name (minimum 2 letters).");
            }
            else
            {
                updateField(field.id, true, "");
            }
            break;

        case 'CVV':
            const cvvRegex = /^\d{3,4}$/;
            const cardType = getCardType($('#cardNumber').val().trim());
            
            if(input == "")
            {
                updateField(field.id, false, "CVV is required.");
            }
            else if(!cvvRegex.test(input))
            {
                updateField(field.id, false, "Please enter a valid CVV (3 or 4 digits).");
            }
            else if(cardType === 'amex' && input.length !== 4)
            {
                updateField(field.id, false, "American Express requires a 4-digit CVV.");
            }
            else if(cardType === 'other' && input.length === 4)
            {
                updateField(field.id, false, "This card requires a 3-digit CVV.");
            }
            else if(cardType === 'unknown')
            {
                updateField(field.id, true, "");
            }
            else
            {
                updateField(field.id, true, "");
            }
            break;

        case 'cardNumber':
            const cardNumberRegex = /^\d+$/;
            const detectedCardType = getCardType(input);
            
            if(input == "")
            {
                updateField(field.id, false, "Card number is required.");
            }
            else if(!cardNumberRegex.test(input))
            {
                updateField(field.id, false, "Please enter a valid card number.");
            }
            else if(detectedCardType === 'amex' && input.length !== 15)
            {
                updateField(field.id, false, "American Express cards must be 15 digits.");
            }
            else if(detectedCardType === 'other' && input.length !== 16)
            {
                updateField(field.id, false, "Please enter a valid card number of the correct length.");
            }
            else if(detectedCardType === 'unknown')
            {
                // Still typing, allow it but don't mark as complete yet
                updateField(field.id, false, "");
            }
            else
            {
                updateField(field.id, true, "");
            }
            
            const cvvField = document.getElementById('CVV');
            if(cvvField && cvvField.value)
            {
                validateFields(cvvField);
            }
            break;

        case 'expiryMonth':
            updateField('PrimaryCardExpiry', expiryRegex.test(input), "Please enter a valid expiry date.");
            if(expiryRegex.test(input) && input <= 12)
            {
                let expiry_year_check = $('#expiryYear').val().trim();

                if($('#expiryYear').val() == "")
                {
                    updateField(field.id, expiryRegex.test(input), "");
                    updateField('PrimaryCardExpiry', expiryRegex.test(input), "");
                }
                else if('20' + expiry_year_check == todaysDate.getFullYear())
                {
                    if(input < todaysDate.getMonth() + 1)
                    {
                        updateField('expiryYear', false, "");
                        updateField(field.id, false, "Expiry date cannot be in the past.");
                        updateField('PrimaryCardExpiry', false, "Expiry date cannot be in the past.");
                    }
                    else
                    {
                        updateField(field.id, expiryRegex.test(input), "");
                        updateField('PrimaryCardExpiry', expiryRegex.test(input), "");
                        updateField('expiryYear', expiryRegex.test(input), "");
                    }
                }
                else
                {
                    updateField(field.id, expiryRegex.test(input), "");
                    updateField('PrimaryCardExpiry', expiryRegex.test(input), "");
                }
            }
            else
            {
                updateField(field.id, false, "Please enter a valid expiry date.");
                updateField('PrimaryCardExpiry', false, "Please enter a valid expiry date.");
            }
            break;

        case 'expiryYear':
            let expiry_month_check = $('#expiryMonth').val().trim();

            if(expiryRegex.test(input))
            {
                if('20' + input >= todaysDate.getFullYear())
                {
                    if(expiry_month_check == "")
                    {
                        updateField(field.id, expiryRegex.test(input), "");
                        updateField('PrimaryCardExpiry', expiryRegex.test(input), "");
                    }
                    else if('20' + input == todaysDate.getFullYear())
                    {
                        if(expiry_month_check >= todaysDate.getMonth() + 1)
                        {
                            updateField(field.id, expiryRegex.test(input), "");
                            updateField('PrimaryCardExpiry', expiryRegex.test(input), "");
                            updateField('expiryMonth', expiryRegex.test(input), "");
                        }
                        else
                        {
                            updateField('expiryMonth', false, "");
                            updateField(field.id, false, "Expiry date cannot be in the past.");
                            updateField('PrimaryCardExpiry', false, "Expiry date cannot be in the past.");
                        }
                    }
                    else
                    {
                        updateField(field.id, expiryRegex.test(input), "");
                        updateField('PrimaryCardExpiry', expiryRegex.test(input), "");
                        updateField('expiryMonth', expiryRegex.test(input), "");
                    }
                }
                else
                {
                    updateField(field.id, false, "Expiry date cannot be in the past.");
                    updateField('PrimaryCardExpiry', false, "Expiry date cannot be in the past.");
                }
            }
            else
            {
                updateField(field.id, expiryRegex.test(input), "Please enter a valid expiry date.");
                updateField('PrimaryCardExpiry', expiryRegex.test(input), "Please enter a valid expiry date.");
            }
            break;

        case 'issueNumber':
            const issueRegex = /^\d{2}$/;
            if(input == "")
            {
                $('#' + field.id + 'ErrorMessage').text('');
            }
            else if(!issueRegex.test(input))
            {
                $('#' + field.id + 'ErrorMessage').text('Enter a valid issue number if required.');
            }
            else
            {
                $('#' + field.id + 'ErrorMessage').text('');
            }
            break;

        default:
            break;
    }

    // Check if all fields are complete and enable the next button if they are
    if (Object.values(obj_form_completion_checks).every(Boolean))
    {
        $('#btnNextStep').prop('disabled', false);
    } else
    {
        $('#btnNextStep').prop('disabled', true);
    }
}

// Method to update the fields on input to show or remove validation errors
// This will either set the bool value within the obj_form_completion_checks value to true or false
function updateField(obj_field, isValid, errorMessage)
{
    if (isValid)
    {
        $('#' + obj_field).removeClass('validation-error-border').addClass('is-valid');
        $('#' + obj_field + 'ErrorMessage').text('');
        obj_form_completion_checks['bool_' + obj_field + '_complete'] = true;
    } else
    {
        $('#' + obj_field).addClass('validation-error-border').removeClass('is-valid');
        $('#' + obj_field + 'ErrorMessage').text(errorMessage);
        obj_form_completion_checks['bool_' + obj_field + '_complete'] = false;
    }
}

function getPageData()
{
    proposal_session = getSessionStorage('proposal');
    if (proposal_session.length == 0)
        location.href = "/step-one/step-one.html";
}

function getProposalData()
{
    apiGet(_b_use_proxy_endpoints ? '/api/Proposal/GetProposal' : '/api/Proposal', {}, function (err, obj_response)
    {
        if (err)
        {
            console.error(err);
            console.error("sending user back to step one: GetProposal failed")
            console.error(err.toString())
            location.href = "/step-one/step-one.html";
        }
        else
        {
            obj_proposal = obj_response;
            hideSpinner();
        }
    });
}

document.addEventListener("DOMContentLoaded", function ()
{
    showSpinner();
    getPageData();
    getProposalData();
});

function disableBack() { window.history.forward(); }
setTimeout("disableBack()", 0);
window.onunload = function () { null };