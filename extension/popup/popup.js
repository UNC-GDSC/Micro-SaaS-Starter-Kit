/**
 * popup.js — ResumeAI Autofill popup controller.
 *
 * States:
 *   loading      → Checking chrome.storage for API key
 *   disconnected → No key stored; show Connect button
 *   connected    → Key found; fetch resume and show Autofill button
 */

const el = (id) => document.getElementById(id)

function showState(name) {
  for (const s of ['loading', 'disconnected', 'connected']) {
    const node = el(`state-${s}`)
    if (node) node.classList.toggle('hidden', s !== name)
  }
}

function setStatus(msg, type = 'info') {
  const node = el('fill-status')
  if (!node) return
  node.textContent = msg
  node.className = `status ${type}`
  node.classList.remove('hidden')
}

function clearStatus() {
  const node = el('fill-status')
  if (node) node.className = 'status hidden'
}

function renderResumeInfo(data) {
  const card = el('resume-info')
  if (!card) return
  const name = [data.firstName, data.lastName].filter(Boolean).join(' ')
  const title = data.currentTitle || data.currentCompany || ''
  card.innerHTML = name
    ? `<div class="resume-name">${escHtml(name)}</div>
       ${title ? `<div class="resume-title">${escHtml(title)}</div>` : ''}`
    : `<div class="resume-missing">Resume found — no name set</div>`
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Init ────────────────────────────────────────────────────────────────────

async function init() {
  showState('loading')

  const { key } = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' })

  if (!key) {
    showState('disconnected')
    return
  }

  showState('connected')

  // Fetch resume data to show preview
  const result = await chrome.runtime.sendMessage({ type: 'GET_RESUME' })
  if (result.ok) {
    renderResumeInfo(result.data)
  } else if (result.error === 'key_invalid') {
    showState('disconnected')
    return
  } else if (result.error === 'no_resume') {
    const card = el('resume-info')
    if (card)
      card.innerHTML = `<div class="resume-missing">No resume yet — <a href="https://resumeai-bot.ru/dashboard/resumes" target="_blank">create one</a></div>`
  }
}

// ── Autofill button ─────────────────────────────────────────────────────────

el('btn-autofill')?.addEventListener('click', async () => {
  const btn = el('btn-autofill')
  clearStatus()
  btn.disabled = true
  btn.textContent = 'Filling…'

  try {
    // Get the active tab and inject autofill via content script message
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      setStatus('No active tab found', 'error')
      return
    }

    const resumeResult = await chrome.runtime.sendMessage({ type: 'GET_RESUME' })
    if (!resumeResult.ok) {
      if (resumeResult.error === 'no_resume') {
        setStatus('No resume found. Create one first.', 'error')
      } else if (resumeResult.error === 'not_connected' || resumeResult.error === 'key_invalid') {
        setStatus('Please reconnect the extension.', 'error')
        setTimeout(() => showState('disconnected'), 1500)
      } else {
        setStatus('Could not load resume. Check your connection.', 'error')
      }
      return
    }

    // Send fill event to the content script on the active tab
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (resumeData) => {
        document.dispatchEvent(
          new CustomEvent('resumeai:fill', { detail: { resumeData } }),
        )
      },
      args: [resumeResult.data],
    })

    setStatus('Fields filled! Review and submit.', 'success')
  } catch (err) {
    setStatus(err.message || 'Autofill failed', 'error')
  } finally {
    btn.disabled = false
    btn.textContent = '✨ Autofill this page'
  }
})

// ── Connect button ──────────────────────────────────────────────────────────

el('btn-connect')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_CONNECT' })
  window.close()
})

// ── Disconnect button ───────────────────────────────────────────────────────

el('btn-disconnect')?.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CLEAR_API_KEY' })
  showState('disconnected')
})

// ── Start ───────────────────────────────────────────────────────────────────

init()
