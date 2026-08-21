// ============================================================
// registration.js — Form state, validation, dynamic members
// ============================================================

const REG_STATE = {
  currentStep: 1,
  totalSteps: 5,
  teamSize: 0,
};

document.addEventListener('DOMContentLoaded', () => {
  initTeamSizeWatcher();
  initDescriptionCounter();
  initStepNavigation();
  initRegisterAnother();
});

/* ------------------------------------------------------------
   Dynamic team member fields, driven by the team size select
------------------------------------------------------------ */
function initTeamSizeWatcher() {
  const teamSizeSelect = document.getElementById('teamSize');
  const container = document.getElementById('membersContainer');
  if (!teamSizeSelect || !container) return;

  teamSizeSelect.addEventListener('change', () => {
    const size = parseInt(teamSizeSelect.value, 10) || 0;
    REG_STATE.teamSize = size;
    renderMemberFields(container, size);
  });
}

function renderMemberFields(container, size) {
  // Members 2..size need fields. Member 1 is the team leader (Step 2).
  const existing = container.querySelectorAll('.member-card');
  existing.forEach((card) => card.remove());

  if (size < 2) return;

  for (let i = 2; i <= size; i++) {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.dataset.member = i;
    card.innerHTML = `
      <h3>Member ${i}</h3>
      <div class="field">
        <label for="member${i}Name">Full Name</label>
        <input type="text" id="member${i}Name" name="member${i}Name" maxlength="80" required>
        <span class="field__error" data-error-for="member${i}Name"></span>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="member${i}Email">Email</label>
          <input type="email" id="member${i}Email" name="member${i}Email" required>
          <span class="field__error" data-error-for="member${i}Email"></span>
        </div>
        <div class="field">
          <label for="member${i}Course">Course</label>
          <input type="text" id="member${i}Course" name="member${i}Course" maxlength="60" required>
          <span class="field__error" data-error-for="member${i}Course"></span>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="member${i}Year">Year</label>
          <select id="member${i}Year" name="member${i}Year" required>
            <option value="">Select year</option>
            <option>FY</option><option>SY</option><option>TY</option><option>Final Year</option>
          </select>
          <span class="field__error" data-error-for="member${i}Year"></span>
        </div>
        <div class="field">
          <label for="member${i}Division">Division</label>
          <input type="text" id="member${i}Division" name="member${i}Division" maxlength="10" required>
          <span class="field__error" data-error-for="member${i}Division"></span>
        </div>
      </div>
      <div class="field">
        <label for="member${i}Roll">Roll Number</label>
        <input type="text" id="member${i}Roll" name="member${i}Roll" maxlength="20" required>
        <span class="field__error" data-error-for="member${i}Roll"></span>
      </div>
    `;
    container.appendChild(card);
  }
}

/* ------------------------------------------------------------
   Project description character counter
------------------------------------------------------------ */
function initDescriptionCounter() {
  const textarea = document.getElementById('projectDescription');
  const counter = document.getElementById('descCounter');
  if (!textarea || !counter) return;

  const update = () => {
    counter.textContent = `${textarea.value.length} / ${textarea.maxLength}`;
  };
  textarea.addEventListener('input', update);
  update();
}

/* ------------------------------------------------------------
   Step navigation + per-step validation
------------------------------------------------------------ */
function initStepNavigation() {
  const nextBtn = document.getElementById('nextStep');
  const prevBtn = document.getElementById('prevStep');
  if (!nextBtn || !prevBtn) return;

  nextBtn.addEventListener('click', () => {
    if (!validateStep(REG_STATE.currentStep)) return;

    if (REG_STATE.currentStep < REG_STATE.totalSteps) {
      goToStep(REG_STATE.currentStep + 1);
    }
  });

  prevBtn.addEventListener('click', () => {
    if (REG_STATE.currentStep > 1) goToStep(REG_STATE.currentStep - 1);
  });
}

function goToStep(step) {
  document.querySelectorAll('.reg-panel').forEach((panel) => {
    panel.hidden = parseInt(panel.dataset.panel, 10) !== step;
  });

  document.querySelectorAll('.progress__step').forEach((el) => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.toggle('is-active', s === step);
    el.classList.toggle('is-complete', s < step);
  });

  document.getElementById('prevStep').hidden = step === 1;
  const nextBtn = document.getElementById('nextStep');
  nextBtn.textContent = step === REG_STATE.totalSteps ? 'Submit Registration' : 'Continue';

  REG_STATE.currentStep = step;

  // On the last click of "Continue" at step 4 -> 5, kick off the payment step
  if (step === 5 && typeof window.onPaymentStepEntered === 'function') {
    window.onPaymentStepEntered();
  }

  document.querySelector('.reg-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------
   Validation
------------------------------------------------------------ */
function validateStep(step) {
  const panel = document.querySelector(`.reg-panel[data-panel="${step}"]`);
  if (!panel) return true;

  let valid = true;
  const fields = panel.querySelectorAll('input, select, textarea');

  fields.forEach((field) => {
    clearFieldError(field);
    const value = field.value.trim();

    if (field.required && !value) {
      setFieldError(field, 'This field is required.');
      valid = false;
      return;
    }

    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFieldError(field, 'Enter a valid email address.');
      valid = false;
      return;
    }

    if (field.id === 'leaderMobile' && value && !/^[6-9]\d{9}$/.test(value)) {
      setFieldError(field, 'Enter a valid 10-digit Indian mobile number.');
      valid = false;
      return;
    }

    if (field.type === 'checkbox' && field.required && !field.checked) {
      setFieldError(field, 'You must accept the terms to continue.');
      valid = false;
    }
  });

  return valid;
}

function setFieldError(field, message) {
  field.classList.add('is-invalid');
  const errorEl = document.querySelector(`[data-error-for="${field.id}"]`);
  if (errorEl) errorEl.textContent = message;
}

function clearFieldError(field) {
  field.classList.remove('is-invalid');
  const errorEl = document.querySelector(`[data-error-for="${field.id}"]`);
  if (errorEl) errorEl.textContent = '';
}

/* ------------------------------------------------------------
   Collect all form data into a plain object (used by payment.js)
------------------------------------------------------------ */
function collectRegistrationData() {
  const form = document.getElementById('registrationForm');
  const formData = new FormData(form);
  const data = {};
  formData.forEach((value, key) => { data[key] = value; });
  return data;
}
window.collectRegistrationData = collectRegistrationData;

/* ------------------------------------------------------------
   "Register Another Team" resets the form back to step 1
------------------------------------------------------------ */
function initRegisterAnother() {
  const btn = document.getElementById('registerAnotherBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    document.getElementById('registrationForm').reset();
    document.getElementById('membersContainer').innerHTML = '';
    document.getElementById('successPanel').hidden = true;
    document.getElementById('registrationForm').hidden = false;
    goToStep(1);
  });
}
