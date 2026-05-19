/**
 * background.js — ResumeAI Autofill service worker (Manifest V3)
 *
 * Responsibilities:
 *   - Store/retrieve the extension API key in chrome.storage.local
 *   - Fetch resume data from the ResumeAI API (with in-memory cache)
 *   - Record applications via the ResumeAI API
 *   - Open the /extension/connect tab when the user needs to sign in
 */

const BASE_URL = 'https://resumeai-bot.ru'
const STORAGE_KEY = 'resumeai_api_key'
const RESUME_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

// In-memory resume cache (cleared when service worker restarts)
let resumeCache = null
let resumeCacheAt = 0

// ── Helpers ────────────────────────────────────────────────────────────────

async function getApiKey() {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return result[STORAGE_KEY] ?? null
}

async function setApiKey(key) {
  await chrome.storage.local.set({ [STORAGE_KEY]: key })
}

async function clearApiKey() {
  await chrome.storage.local.remove(STORAGE_KEY)
  resumeCache = null
  resumeCacheAt = 0
}

async function fetchResume(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && resumeCache && now - resumeCacheAt < RESUME_CACHE_TTL_MS) {
    return { ok: true, data: resumeCache }
  }

  const apiKey = await getApiKey()
  if (!apiKey) {
    return { ok: false, error: 'not_connected' }
  }

  try {
    const res = await fetch(`${BASE_URL}/api/extension/resume`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (res.status === 401) {
      await clearApiKey()
      return { ok: false, error: 'key_invalid' }
    }
    if (res.status === 404) {
      return { ok: false, error: 'no_resume' }
    }
    if (!res.ok) {
      return { ok: false, error: `server_error_${res.status}` }
    }

    const data = await res.json()
    resumeCache = data
    resumeCacheAt = now
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: 'network_error' }
  }
}

async function recordApplication(payload) {
  const apiKey = await getApiKey()
  if (!apiKey) return { ok: false, error: 'not_connected' }

  try {
    const res = await fetch(`${BASE_URL}/api/extension/applications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) return { ok: false, error: `server_error_${res.status}` }
    const data = await res.json()
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: 'network_error' }
  }
}

// ── Message handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'SAVE_API_KEY': {
      setApiKey(message.key).then(() => {
        resumeCache = null // invalidate cache
        sendResponse({ ok: true })
      })
      return true // keep channel open for async response
    }

    case 'GET_API_KEY': {
      getApiKey().then((key) => sendResponse({ ok: true, key }))
      return true
    }

    case 'CLEAR_API_KEY': {
      clearApiKey().then(() => sendResponse({ ok: true }))
      return true
    }

    case 'GET_RESUME': {
      fetchResume(message.forceRefresh ?? false).then(sendResponse)
      return true
    }

    case 'RECORD_APPLICATION': {
      recordApplication(message.payload).then(sendResponse)
      return true
    }

    case 'OPEN_CONNECT': {
      chrome.tabs.create({ url: `${BASE_URL}/extension/connect` })
      sendResponse({ ok: true })
      return false
    }

    default:
      return false
  }
})
