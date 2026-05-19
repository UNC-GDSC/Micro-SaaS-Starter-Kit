/**
 * detect.js — Detect which ATS the current page belongs to.
 *
 * Sets window.__resumeai_ats to one of:
 *   'greenhouse' | 'lever' | 'workable' | 'smartrecruiters' |
 *   'jobvite'    | 'ashby' | 'linkedin' | 'workday' | 'icims' |
 *   'taleo'      | 'generic'
 *
 * Also notifies overlay.js via a custom event.
 */
;(function detectAts() {
  const url = location.href.toLowerCase()

  function classify(u) {
    if (u.includes('greenhouse.io')) return 'greenhouse'
    if (u.includes('lever.co')) return 'lever'
    if (u.includes('workable.com')) return 'workable'
    if (u.includes('smartrecruiters.com')) return 'smartrecruiters'
    if (u.includes('jobvite.com')) return 'jobvite'
    if (u.includes('ashbyhq.com')) return 'ashby'
    if (u.includes('linkedin.com')) return 'linkedin'
    if (u.includes('myworkdayjobs.com')) return 'workday'
    if (u.includes('icims.com')) return 'icims'
    if (u.includes('taleo.net') || u.includes('taleo.com')) return 'taleo'
    return 'generic'
  }

  const ats = classify(url)
  window.__resumeai_ats = ats

  // Let overlay.js know the ATS is identified
  document.dispatchEvent(new CustomEvent('resumeai:ats_detected', { detail: { ats } }))
})()
