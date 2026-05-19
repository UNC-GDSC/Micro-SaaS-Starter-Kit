/**
 * lib/inbox/classify.ts
 *
 * Two-phase email classifier for the job-search inbox:
 *
 *  1. Fast regex pass — auto-responders are stamped AUTOMATED immediately,
 *     no API call needed.
 *
 *  2. OpenAI gpt-4o-mini — classifies the remaining messages into one of:
 *     INTERVIEW_REQUEST | REJECTION | QUESTION | AUTOMATED | OTHER
 *
 *     Falls back to UNCLASSIFIED on any error so the inbound webhook is
 *     never blocked by a failing AI call.
 *
 * OPENAI_API_KEY env var is required for AI classification; if absent the
 * function returns UNCLASSIFIED immediately.
 */

export type InboxClassification =
  | 'INTERVIEW_REQUEST'
  | 'REJECTION'
  | 'QUESTION'
  | 'AUTOMATED'
  | 'OTHER'
  | 'UNCLASSIFIED'

// Regex matching common auto-responder sender patterns
const AUTO_RESPONDER_RE =
  /^(no.?reply|do.?not.?reply|noreply|no-reply|automated?|notifications?|alerts?|newsletters?|news|mailer|daemon|postmaster|bounces?|support-noreply|info-noreply)\s*@/i

export function isAutoResponder(fromEmail: string): boolean {
  return AUTO_RESPONDER_RE.test(fromEmail.trim().toLowerCase())
}

interface ClassifyParams {
  fromEmail: string
  subject: string
  bodyText: string
}

interface ClassifyResult {
  classification: InboxClassification
  confidence: number
}

const SYSTEM_PROMPT = `You classify recruiter email replies to job applications.
Reply with ONLY a JSON object — no prose, no markdown, no code fences.

Valid classes:
- INTERVIEW_REQUEST: invitation to interview, phone screen, video call, or meeting
- REJECTION: application declined or position filled
- QUESTION: recruiter asking for more information or clarifications
- AUTOMATED: application confirmation, receipt, or system-generated message
- OTHER: anything that does not fit the above

JSON schema: {"class":"<CLASS>","confidence":<0.0-1.0>}`

export async function classifyEmail(params: ClassifyParams): Promise<ClassifyResult> {
  const { fromEmail, subject, bodyText } = params

  // ── Phase 1: fast auto-responder detection ──────────────────────────────
  if (isAutoResponder(fromEmail)) {
    return { classification: 'AUTOMATED', confidence: 1.0 }
  }

  // ── Phase 2: OpenAI classification ──────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { classification: 'UNCLASSIFIED', confidence: 0 }
  }

  const userMessage = [
    `From: ${fromEmail}`,
    `Subject: ${subject}`,
    `Body (first 500 chars): ${bodyText.slice(0, 500)}`,
  ].join('\n')

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0,
        max_tokens: 80,
      }),
    })

    if (!res.ok) {
      console.error('[inbox/classify] OpenAI error', res.status)
      return { classification: 'UNCLASSIFIED', confidence: 0 }
    }

    const data = await res.json()
    const text: string = data.choices?.[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(text) as { class?: string; confidence?: number }

    const VALID = new Set<InboxClassification>([
      'INTERVIEW_REQUEST', 'REJECTION', 'QUESTION', 'AUTOMATED', 'OTHER',
    ])
    const cls = parsed.class as InboxClassification

    return {
      classification: VALID.has(cls) ? cls : 'OTHER',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
    }
  } catch (err) {
    console.error('[inbox/classify] classification failed', err)
    return { classification: 'UNCLASSIFIED', confidence: 0 }
  }
}
