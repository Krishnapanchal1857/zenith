// ============================================================
// payment.js — Payment order, gateway checkout, verification, retry
//
// SECURITY NOTE (do not change this):
// - No card/UPI/bank credentials are ever collected or stored here.
// - No payment secret key lives in this file — only a public/checkout
//   key ID, which is safe to expose client-side.
// - A "payment successful" callback from the gateway is NEVER treated
//   as final. Registration is only confirmed once GAS_ENDPOINT's
//   verify-payment call returns a PAID/CONFIRMED status.
// ============================================================

const PAYMENT_CONFIG = {
  // TODO: set this to your deployed Google Apps Script Web App URL
  // (see google-apps-script/README.md).
  GAS_ENDPOINT: 'https://script.google.com/macros/s/AKfycbxWCXD-s99rZ30W9eYvL1cmv2aLjqyWncmWYIXnMco1Xg3nhP-7nEo2wQMffqmS36s3/exec',

  // TODO: set this to your payment gateway's public/checkout key.
  // This is a publishable identifier, not a secret — the secret key
  // stays in Payment.gs on the server side and is never sent here.
  GATEWAY_PUBLIC_KEY: '',

  // Registration fee in the smallest currency unit's display form.
  // TODO: replace once the organizers confirm the fee. Leave null to
  // keep showing "TO BE ANNOUNCED" on the payment step.
  FEE_AMOUNT_INR: null,
};

const PAYMENT_STATE = {
  status: 'pending', // pending | processing | verifying | paid | failed | cancelled | verification_failed
  registrationRef: null,
  orderId: null,
  paymentId: null,
};

document.addEventListener('DOMContentLoaded', () => {
  renderFeeAmount();
  wirePaymentButtons();
});

window.onPaymentStepEntered = async function onPaymentStepEntered() {
  // Runs once when the user reaches Step 5.
  // Always create the pending DB record first, even if no gateway is wired.
  if (PAYMENT_STATE.status === 'pending' && PAYMENT_CONFIG.GAS_ENDPOINT) {
    await createPendingRegistration();
  }
};

function renderFeeAmount() {
  const el = document.getElementById('feeAmount');
  if (!el) return;
  el.textContent = PAYMENT_CONFIG.FEE_AMOUNT_INR
    ? `₹ ${PAYMENT_CONFIG.FEE_AMOUNT_INR}`
    : 'To be announced';
}

function wirePaymentButtons() {
  const payButton = document.getElementById('payButton');
  const retryButton = document.getElementById('retryButton');
  if (payButton) payButton.addEventListener('click', startPaymentFlow);
  if (retryButton) retryButton.addEventListener('click', startPaymentFlow);
}

/* ------------------------------------------------------------
   Step 1 of the flow: create a PENDING registration record on
   the server so we have a stable reference before any money
   moves. See google-apps-script/Registration.gs.
------------------------------------------------------------ */
async function createPendingRegistration() {
  if (!PAYMENT_CONFIG.GAS_ENDPOINT) return;

  try {
    const payload = window.collectRegistrationData();
    const res = await fetch(PAYMENT_CONFIG.GAS_ENDPOINT, {
      method: 'POST',
      // Use text/plain to avoid CORS preflight on GAS endpoints
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'createPendingRegistration', data: payload }),
    });
    const result = await res.json();
    if (result && result.registrationRef) {
      PAYMENT_STATE.registrationRef = result.registrationRef;
      console.log('Pending registration created:', result.registrationRef);
    } else if (result && result.error) {
      console.error('Registration error:', result.error, result.details);
    }
  } catch (err) {
    console.error('Could not create pending registration:', err);
  }
}

/* ------------------------------------------------------------
   Full payment flow. Every step is guarded so that nothing here
   can mark a registration PAID on its own — only the server can.
------------------------------------------------------------ */
async function startPaymentFlow() {
  // Make sure the pending registration exists in DB before doing anything
  if (!PAYMENT_STATE.registrationRef && PAYMENT_CONFIG.GAS_ENDPOINT) {
    await createPendingRegistration();
  }

  // If no payment gateway is configured, save registration as pending and show info
  if (!PAYMENT_CONFIG.GATEWAY_PUBLIC_KEY) {
    if (PAYMENT_STATE.registrationRef) {
      setPaymentStatus('pending',
        '✅ Your registration details have been saved! Payment gateway is not yet connected — ' +
        'the organizers will contact you with payment instructions. Ref: ' + PAYMENT_STATE.registrationRef
      );
      // Show a partial success so organizers can see the data
      document.getElementById('payButton').textContent = '✅ Registration Saved';
      document.getElementById('payButton').disabled = true;
    } else {
      setPaymentStatus('failed',
        'Registration could not be saved. Please check your internet connection and try again.');
    }
    return;
  }

  setPaymentStatus('processing', 'Creating payment order…');

  try {
    const orderRes = await fetch(PAYMENT_CONFIG.GAS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'createPaymentOrder',
        registrationRef: PAYMENT_STATE.registrationRef,
      }),
    });
    const order = await orderRes.json();

    if (!order || !order.orderId) {
      setPaymentStatus('failed', 'Could not start payment. Please try again.');
      return;
    }
    PAYMENT_STATE.orderId = order.orderId;

    openGatewayCheckout(order, {
      onSuccess: (paymentResponse) => verifyPayment(paymentResponse),
      onDismiss: () => setPaymentStatus('cancelled', 'Payment window closed. Your registration is pending — you can try again.'),
      onFailure: () => setPaymentStatus('failed', 'Payment did not go through.'),
    });
  } catch (err) {
    console.error('Payment order error:', err);
    setPaymentStatus('failed', 'Something went wrong starting the payment. Please try again.');
  }
}

/**
 * Placeholder for the gateway checkout call. Wire this up to the
 * chosen gateway's client SDK once one is selected. It must call
 * exactly one of the provided callbacks — never assume success here.
 */
function openGatewayCheckout(order, { onSuccess, onDismiss, onFailure }) {
  console.warn('openGatewayCheckout is not yet wired to a real payment gateway SDK.');
  setPaymentStatus('failed', 'Payment gateway is not connected yet.');
  // Example shape once wired:
  // const checkout = new GatewaySDK({ key: PAYMENT_CONFIG.GATEWAY_PUBLIC_KEY, order_id: order.orderId, ... });
  // checkout.on('success', onSuccess);
  // checkout.on('dismiss', onDismiss);
  // checkout.on('failure', onFailure);
  // checkout.open();
}

/* ------------------------------------------------------------
   Step 3: hand the gateway's response to the server for
   signature + amount + status verification. Only a PAID result
   from here unlocks the success panel.
------------------------------------------------------------ */
async function verifyPayment(paymentResponse) {
  setPaymentStatus('verifying', 'Verifying payment…');

  try {
    const res = await fetch(PAYMENT_CONFIG.GAS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verifyPayment',
        registrationRef: PAYMENT_STATE.registrationRef,
        orderId: PAYMENT_STATE.orderId,
        gatewayResponse: paymentResponse,
      }),
    });
    const result = await res.json();

    if (result && result.status === 'PAID' && result.registrationId) {
      PAYMENT_STATE.paymentId = result.paymentId;
      setPaymentStatus('paid', 'Payment verified.');
      showSuccessPanel(result.registrationId);
    } else {
      setPaymentStatus('verification_failed', 'We could not verify this payment. Please contact the organizers before retrying.');
    }
  } catch (err) {
    console.error('Verification error:', err);
    setPaymentStatus('verification_failed', 'We could not verify this payment. Please contact the organizers before retrying.');
  }
}

/* ------------------------------------------------------------
   UI state helpers
------------------------------------------------------------ */
function setPaymentStatus(status, message) {
  PAYMENT_STATE.status = status;

  const statusBox = document.getElementById('paymentStatus');
  const statusLabel = document.getElementById('paymentStatusLabel');
  const payButton = document.getElementById('payButton');
  const retryButton = document.getElementById('retryButton');
  const contactBtn = document.getElementById('contactOrganizerBtn');

  if (statusBox) statusBox.dataset.state = status;
  if (statusLabel) statusLabel.textContent = message || status;

  const isTerminalFailure = ['failed', 'cancelled', 'verification_failed'].includes(status);
  if (payButton) payButton.hidden = isTerminalFailure || status === 'paid';
  if (retryButton) retryButton.hidden = !isTerminalFailure;
  if (contactBtn) contactBtn.hidden = status !== 'verification_failed';
}

function showSuccessPanel(registrationId) {
  const form = document.getElementById('registrationForm');
  const panel = document.getElementById('successPanel');
  const teamName = document.getElementById('teamName')?.value || '—';

  if (form) form.hidden = true;
  document.querySelector('.progress').hidden = true;
  if (panel) {
    panel.hidden = false;
    document.getElementById('successRegId').textContent = registrationId;
    document.getElementById('successTeamName').textContent = teamName;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
