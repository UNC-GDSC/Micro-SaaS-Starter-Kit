/**
 * overlay.js — Floating autofill button injected into ATS pages.
 *
 * Uses Shadow DOM to isolate styles from the host page.
 * Lifecycle: idle → loading → filling → done/error → (auto-reset after 3s)
 */
;(function initOverlay() {
  // Don't inject twice (e.g. on SPA navigation firing content scripts twice)
  if (document.getElementById('resumeai-overlay-host')) return

  // ── Shadow host ────────────────────────────────────────────────────────────
  const host = document.createElement('div')
  host.id = 'resumeai-overlay-host'
  // Positioned via overlay.css applied to the host element itself
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'closed' })

  // ── Inner styles ───────────────────────────────────────────────────────────
  const style = document.createElement('style')
  style.textContent = `
    :host { all: initial; }
    .btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      border-radius: 9999px;
      border: none;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      background: #2563eb;
      box-shadow: 0 4px 14px rgba(37,99,235,.45);
      transition: transform .15s, box-shadow .15s;
      user-select: none;
      outline: none;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(37,99,235,.55); }
    .btn:active { transform: translateY(0); }
    .btn.loading  { background: #4b5563; cursor: wait; }
    .btn.filling  { background: #7c3aed; }
    .btn.done     { background: #059669; }
    .btn.error    { background: #dc2626; cursor: pointer; }
    .spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `
  shadow.appendChild(style)

  // ── Button ─────────────────────────────────────────────────────────────────
  const btn = document.createElement('button')
  btn.className = 'btn'
  btn.setAttribute('aria-label', 'ResumeAI Autofill')
  shadow.appendChild(btn)

  let state = 'idle'
  let resetTimer = null

  function setState(s, label) {
    state = s
    btn.className = `btn ${s === 'idle' ? '' : s}`
    btn.innerHTML = ''

    if (s === 'loading' || s === 'filling') {
      const spinner = document.createElement('span')
      spinner.className = 'spinner'
      btn.appendChild(spinner)
    } else {
      const icon = document.createElement('span')
      icon.textContent =
        s === 'done' ? '✓' : s === 'error' ? '✕' : '✨'
      btn.appendChild(icon)
    }

    const text = document.createElement('span')
    text.textContent = label || defaultLabel(s)
    btn.appendChild(text)
  }

  function defaultLabel(s) {
    return {
      idle:    'Autofill',
      loading: 'Loading…',
      filling: 'Filling…',
      done:    'Done!',
      error:   'Error — retry',
    }[s] || 'Autofill'
  }

  function scheduleReset(ms = 3000) {
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => setState('idle'), ms)
  }

  // ── Click handler ──────────────────────────────────────────────────────────
  btn.addEventListener('click', async () => {
    if (state === 'loading' || state === 'filling') return
    clearTimeout(resetTimer)
    setState('loading')

    // Ask background for resume data
    let response
    try {
      response = await chrome.runtime.sendMessage({ type: 'GET_RESUME' })
    } catch (err) {
      setState('error', 'Extension error')
      scheduleReset()
      return
    }

    if (!response.ok) {
      if (response.error === 'not_connected' || response.error === 'key_invalid') {
        setState('error', 'Connect ResumeAI first')
        // Open connect page
        await chrome.runtime.sendMessage({ type: 'OPEN_CONNECT' })
        scheduleReset(5000)
      } else if (response.error === 'no_resume') {
        setState('error', 'No resume found')
        scheduleReset()
      } else {
        setState('error', 'Network error')
        scheduleReset()
      }
      return
    }

    setState('filling')

    // Dispatch fill event for autofill.js to handle synchronously
    document.dispatchEvent(
      new CustomEvent('resumeai:fill', { detail: { resumeData: response.data } }),
    )
  })

  // ── Listen for fill completion ─────────────────────────────────────────────
  document.addEventListener('resumeai:fill_done', (event) => {
    if (event.detail?.ok) {
      setState('done')
    } else {
      setState('error', 'Fill failed')
    }
    scheduleReset()
  })

  // ── Initial render ─────────────────────────────────────────────────────────
  setState('idle')

  // Hide the overlay on ATS pages where the form isn't visible yet (LinkedIn
  // Easy Apply appears only after clicking "Easy Apply" on the listing).
  // Show it as soon as any form appears.
  if (window.__resumeai_ats === 'linkedin') {
    btn.style.display = 'none'
    const observer = new MutationObserver(() => {
      if (document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-form-element')) {
        btn.style.display = 'flex'
        observer.disconnect()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }
})()
