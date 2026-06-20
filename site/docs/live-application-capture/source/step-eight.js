let proposal_session = {};
let obj_get_proposal = {};
let proposalId = null;
let url = null;

var b_continue_pressed = false;

var b_proposal_ready = false;
var b_account_score_loaded = false;

function tryEnableVerifyButton() {
    if (b_proposal_ready && b_account_score_loaded && typeof connectBank === 'function') {
        $('#verify_message').text(`You now need to verify the bank account that you want us to pay the money into. The account needs to be a UK bank account in your name. This should also be the account your salary is paid into.`);
        $('#btnNextStep').prop('disabled', false);
    }
}

function onAccountScoreScriptLoaded() {
    b_account_score_loaded = true;
    console.log('accountscore.js loaded, connectBank typeof =', typeof connectBank);
    tryEnableVerifyButton();
}

function onAccountScoreScriptError() {
    console.error('accountscore.js failed to load');
    $('#verifyBankHelp').html(
        '<strong>We\'re having trouble loading our bank verification tool.</strong><br><br>' +
        'This is usually caused by something on your device or network blocking part of the page. Don\'t worry, here are a few quick things you can try:' +
        '<ul class="verify-help-list" style="text-align:left; display:inline-block; margin-top: 0.75rem;">' +
            '<li>If you\'re using a <strong>VPN</strong>, please turn it off and refresh the page.</li>' +
            '<li>Please update your phone/device to the latest version.</li>' +
            '<li>If you have an <strong>ad blocker</strong> or privacy extension, try pausing it for this page and refreshing.</li>' +
            '<li>If you\'re on a <strong>slow or unstable connection</strong> (for example mobile data with poor signal), try moving somewhere with stronger signal or switching to Wi-Fi.</li>' +
            '<li>If you\'re on a <strong>work or public Wi-Fi</strong> network, it may be blocking parts of the page. Try a different network or use mobile data instead.</li>' +
        '</ul>' +
        '<br>If you\'ve tried these and it\'s still not working, please don\'t worry, our customer support team will be in touch shortly to help you finish your application.'
    ).show();
    $('#btnNextStep').hide();
    $('#staticVerifyHelp').hide();
    $('#verify_message').hide();
    if (window.__verifyBankFallbackUrl) {
        $('#verifyBankFallbackLink').attr('href', window.__verifyBankFallbackUrl);
        $('#verifyBankFallback').show();
    }
    if (typeof apiPostJSON === 'function') {
        apiPostJSON('/api/v1/log/message', { Message: 'accountscore.js failed to load for proposal ' + (proposalId || 'unknown') }, function () {});
    }
}


function getProposalData()
{
    apiGet(_b_use_proxy_endpoints ? '/api/Proposal/GetProposal' : '/api/Proposal', {}, function (err, obj_response_proposal)
    {
        if(err)
        {
            console.error("sending user back to step one: GetProposal failed")
            console.error(err.toString())
            location.href = "/step-one/step-one.html"
        }
        else
        {   
            const customer = obj_response_proposal.customers[0];
            const addr = (customer.addresses && customer.addresses[0]) || {};
            let addressLine1 = addr.line1 || '';
            if (!isNaN(addressLine1)) {
                addressLine1 = addressLine1 + ' ' + (addr.line2 || '');
            }
            let postcode = addr.postCode || '';
            if (postcode && postcode.length > 3 && postcode.charAt(postcode.length - 4) !== ' ') {
                postcode = postcode.slice(0, -3) + ' ' + postcode.slice(-3);
            }
            apiGet('/api/v1/cookie/cookiegetjwt', {}, function (err, obj_response){
                hideSpinner()
                let session_cookie = obj_response.details.value;
                if(err)
                {
                    console.error('Error retrieving session cookie for open banking: ' + err);
                }
                const returnUrl = window.top.location.origin + '/thank-you/thank-you.html?session_cookie=' + session_cookie;
                const fallbackUrl = `https://connect.consents.online/loansbymal/?externalReference=${obj_response_proposal.id.toString()}&completeUrl=${encodeURIComponent(returnUrl)}&cancelUrl=${encodeURIComponent(returnUrl)}`;
                window.__verifyBankFallbackUrl = fallbackUrl;
                window.aS = {
                    client: "loansbymal",
                    externalRef: obj_response_proposal.id.toString(),
                    firstName: customer.forename,
                    lastName: customer.surname,
                    email: customer.email,
                    dateOfBirth: new Date(customer.dob).toFormattedString('Y-m-d'),
                    residentialAddress: true,
                    addressLine1: addressLine1 || '',
                    addressLine2: addr.line2 || '',
                    city: addr.line3 || '',
                    postTown: addr.town || '',
                    postcode: addr.postCode || '', 
                    telephone: customer.mobileNumber || '',

                    completeUrl: returnUrl,
                    cancelUrl: returnUrl,
                    // startBank: "HSBC",
                    allowClose: true               
                };

                b_proposal_ready = true;
                tryEnableVerifyButton();
                $('#verifyBankFallbackLink').attr('href', fallbackUrl);
                if ($('#verifyBankHelp').is(':visible')) {
                    $('#verifyBankFallback').show();
                }
            });
        }
    });
}

document.addEventListener("DOMContentLoaded", function ()
{
    showSpinner();
    getProposalData();

    if (window.__accountScoreFailed) {
        onAccountScoreScriptError();
    } else if (window.__accountScoreLoaded || typeof connectBank === 'function') {
        onAccountScoreScriptLoaded();
    } else {
        var scriptEl = document.getElementById('consentsOnlineIframe');
        if (scriptEl) {
            scriptEl.addEventListener('load', onAccountScoreScriptLoaded);
            scriptEl.addEventListener('error', onAccountScoreScriptError);
        }
    }
})

function disableBack() { window.history.forward(); }
setTimeout("disableBack()", 0);
window.onunload = function () { null };
