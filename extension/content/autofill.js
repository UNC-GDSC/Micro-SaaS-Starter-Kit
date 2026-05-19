/**
 * autofill.js — Fill ATS job application forms with resume data.
 *
 * Listens for the custom event 'resumeai:fill' dispatched by overlay.js.
 * Does NOT auto-submit — the user must review and submit manually.
 *
 * Supported ATS:
 *   greenhouse, lever, workable, smartrecruiters, jobvite, ashby,
 *   linkedin (Easy Apply), workday (best-effort generic), generic
 */

// ── Field fill helper ────────────────────────────────────────────────────────

/**
 * Fill a single input/textarea/select and fire synthetic React-compatible events
 * so framework-managed form state updates correctly.
 */
function fillField(el, value) {
  if (!el || value === undefined || value === null || value === '') return false

  const tag = el.tagName.toLowerCase()

  if (tag === 'select') {
    const options = Array.from(el.options)
    // Try exact match first, then prefix match
    const match =
      options.find((o) => o.text.toLowerCase() === String(value).toLowerCase()) ||
      options.find((o) => o.text.toLowerCase().startsWith(String(value).toLowerCase()))
    if (match) {
      el.value = match.value
    } else {
      return false
    }
  } else {
    // Native input value setter bypass (works for React-controlled inputs)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value',
    )?.set
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value',
    )?.set

    if (tag === 'textarea' && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(el, String(value))
    } else if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, String(value))
    } else {
      el.value = String(value)
    }
  }

  // Fire events React and other frameworks listen to
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new Event('blur', { bubbles: true }))
  return true
}

/** Try each selector until one exists in the DOM and return the element. */
function findFirst(...selectors) {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel)
      if (el) return el
    } catch (_) { /* invalid selector */ }
  }
  return null
}

/** Fill first matched selector with value. Returns true on success. */
function fill(value, ...selectors) {
  const el = findFirst(...selectors)
  return el ? fillField(el, value) : false
}

// ── ATS-specific fillers ─────────────────────────────────────────────────────

function fillGreenhouse(r) {
  fill(r.firstName,      '#first_name', 'input[name="first_name"]')
  fill(r.lastName,       '#last_name',  'input[name="last_name"]')
  fill(r.email,          '#email',      'input[name="email"]')
  fill(r.phone,          '#phone',      'input[name="phone"]')
  fill(r.linkedinUrl,    'input[name="job_application[answers_attributes][0][text_value]"]',
                         'input[placeholder*="LinkedIn"]')
  fill(r.websiteUrl,     'input[placeholder*="Website"]', 'input[placeholder*="website"]')
  // Cover letter / additional info textarea
  fill(r.summary,        'textarea[name="cover_letter"]', '#cover_letter')
}

function fillLever(r) {
  const fullName = `${r.firstName} ${r.lastName}`.trim()
  fill(fullName,         'input[name="name"]')
  fill(r.email,          'input[name="email"]')
  fill(r.phone,          'input[name="phone"]')
  fill(r.currentCompany, 'input[name="org"]')
  fill(r.linkedinUrl,    'input[name="urls[LinkedIn]"]', 'input[placeholder*="LinkedIn"]')
  fill(r.websiteUrl,     'input[name="urls[Other]"]',    'input[placeholder*="website"]')
  fill(r.summary,        'textarea[name="comments"]',    '#additional-info')
}

function fillWorkable(r) {
  fill(r.firstName,  '[data-testid="firstname"]',  'input[placeholder*="First name"]',
                     'input[placeholder*="first"]')
  fill(r.lastName,   '[data-testid="lastname"]',   'input[placeholder*="Last name"]',
                     'input[placeholder*="last"]')
  fill(r.email,      '[data-testid="email"]',      'input[type="email"]',
                     'input[placeholder*="Email"]')
  fill(r.phone,      '[data-testid="phone"]',      'input[type="tel"]',
                     'input[placeholder*="Phone"]')
  fill(r.linkedinUrl, 'input[placeholder*="LinkedIn"]', 'input[placeholder*="linkedin"]')
}

function fillSmartRecruiters(r) {
  fill(r.firstName,  'input[id*="firstName"]', 'input[name="firstName"]',
                     'input[placeholder*="First"]')
  fill(r.lastName,   'input[id*="lastName"]',  'input[name="lastName"]',
                     'input[placeholder*="Last"]')
  fill(r.email,      'input[type="email"]',    'input[id*="email"]')
  fill(r.phone,      'input[type="tel"]',      'input[id*="phone"]')
  fill(r.location,   'input[id*="location"]',  'input[placeholder*="Location"]')
}

function fillJobvite(r) {
  fill(r.firstName,  'input[id*="FirstName"]', 'input[name*="FirstName"]',
                     'input[placeholder*="First Name"]')
  fill(r.lastName,   'input[id*="LastName"]',  'input[name*="LastName"]',
                     'input[placeholder*="Last Name"]')
  fill(r.email,      'input[id*="Email"]',     'input[type="email"]')
  fill(r.phone,      'input[id*="Phone"]',     'input[type="tel"]')
  fill(r.linkedinUrl, 'input[placeholder*="LinkedIn"]')
}

function fillAshby(r) {
  fill(r.firstName,  '[data-field-id*="firstName"]', '[data-field-id="name"]',
                     'input[placeholder*="First"]')
  fill(r.lastName,   '[data-field-id*="lastName"]',  'input[placeholder*="Last"]')
  fill(`${r.firstName} ${r.lastName}`.trim(), '[data-field-id="name"]')
  fill(r.email,      '[data-field-id="email"]',  'input[type="email"]')
  fill(r.phone,      '[data-field-id="phone"]',  'input[type="tel"]')
  fill(r.linkedinUrl, '[data-field-id="linkedin"]', 'input[placeholder*="LinkedIn"]')
  fill(r.location,   '[data-field-id="location"]', 'input[placeholder*="Location"]')
}

function fillLinkedIn(r) {
  // Easy Apply modal fields
  const formInputs = document.querySelectorAll(
    '.jobs-easy-apply-form-element input[type="text"],' +
    '.jobs-easy-apply-form-element input[type="email"],' +
    '.jobs-easy-apply-form-element input[type="tel"]',
  )

  for (const input of formInputs) {
    const label =
      (input.getAttribute('aria-label') || '').toLowerCase() +
      ' ' +
      (input.getAttribute('placeholder') || '').toLowerCase() +
      ' ' +
      (input.closest('label')?.textContent || '').toLowerCase()

    if (label.includes('first') && !input.value) fillField(input, r.firstName)
    else if (label.includes('last') && !input.value) fillField(input, r.lastName)
    else if ((label.includes('email') || input.type === 'email') && !input.value)
      fillField(input, r.email)
    else if ((label.includes('phone') || input.type === 'tel') && !input.value)
      fillField(input, r.phone)
    else if (label.includes('city') || label.includes('location'))
      if (!input.value) fillField(input, r.location)
    else if (label.includes('linkedin') || label.includes('profile'))
      if (!input.value) fillField(input, r.linkedinUrl)
    else if (/year|experience|how many/i.test(label) && !input.value)
      fillField(input, r.experienceYears)
  }
}

function fillGeneric(r) {
  // Common patterns that cover a wide variety of custom ATS forms
  fill(r.firstName,
    'input[name*="first"][name*="name" i]', 'input[id*="first"][id*="name" i]',
    'input[autocomplete="given-name"]',      'input[placeholder*="First name" i]')
  fill(r.lastName,
    'input[name*="last"][name*="name" i]',  'input[id*="last"][id*="name" i]',
    'input[autocomplete="family-name"]',     'input[placeholder*="Last name" i]')
  fill(`${r.firstName} ${r.lastName}`.trim(),
    'input[autocomplete="name"]',            'input[name="name"]',
    'input[id="name"]',                      'input[placeholder*="Full name" i]')
  fill(r.email,   'input[type="email"]',   'input[autocomplete="email"]')
  fill(r.phone,   'input[type="tel"]',     'input[autocomplete="tel"]',
    'input[name*="phone" i]',               'input[id*="phone" i]')
  fill(r.location,
    'input[autocomplete="address-level2"]', 'input[name*="location" i]',
    'input[placeholder*="City" i]',         'input[placeholder*="Location" i]')
  fill(r.linkedinUrl,
    'input[name*="linkedin" i]',            'input[placeholder*="LinkedIn" i]')
  fill(r.websiteUrl,
    'input[name*="website" i]',             'input[name*="portfolio" i]',
    'input[placeholder*="Website" i]')
}

// ── Main autofill dispatcher ─────────────────────────────────────────────────

function autofill(resumeData) {
  const ats = window.__resumeai_ats || 'generic'
  const r = resumeData

  try {
    switch (ats) {
      case 'greenhouse':      fillGreenhouse(r);      break
      case 'lever':           fillLever(r);           break
      case 'workable':        fillWorkable(r);        break
      case 'smartrecruiters': fillSmartRecruiters(r); break
      case 'jobvite':         fillJobvite(r);         break
      case 'ashby':           fillAshby(r);           break
      case 'linkedin':        fillLinkedIn(r);        break
      default:                fillGeneric(r);         break
    }

    // Always attempt generic fill as a supplement for missed fields
    if (ats !== 'generic') fillGeneric(r)

    document.dispatchEvent(
      new CustomEvent('resumeai:fill_done', { detail: { ats, ok: true } }),
    )
  } catch (err) {
    console.error('[ResumeAI] autofill error:', err)
    document.dispatchEvent(
      new CustomEvent('resumeai:fill_done', {
        detail: { ats, ok: false, error: err.message },
      }),
    )
  }
}

// ── Listen for fill requests from overlay ───────────────────────────────────

document.addEventListener('resumeai:fill', (event) => {
  autofill(event.detail?.resumeData)
})
