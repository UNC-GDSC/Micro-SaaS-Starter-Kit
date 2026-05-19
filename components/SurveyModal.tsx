'use client'

import { useEffect, useState } from 'react'
import type { SurveyAnswer } from '@/lib/pmf/types'

interface Props {
  surveyId: string
}

export function SurveyModal({ surveyId }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<SurveyAnswer | null>(null)
  const [interviewCount, setInterviewCount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Mark survey as shown on mount
  useEffect(() => {
    fetch('/api/surveys/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyId, action: 'shown' }),
    }).catch(() => {})
    // Open after a short delay so page renders first
    const t = setTimeout(() => setOpen(true), 800)
    return () => clearTimeout(t)
  }, [surveyId])

  if (!open) return null
  if (done) return null

  const handleAnswer = async (answer: SurveyAnswer) => {
    setSelected(answer)
  }

  const handleSubmit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await fetch('/api/surveys/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId,
          action: 'answer',
          answer: selected,
          interviewCount:
            selected === 'yes' && interviewCount ? parseInt(interviewCount, 10) : undefined,
        }),
      })
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDismiss = async () => {
    await fetch('/api/surveys/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyId, action: 'dismiss' }),
    }).catch(() => {})
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="survey-title"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* panel */}
      <div className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-background border shadow-xl p-6 mx-4 mb-0 sm:mb-4">
        {/* close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground text-lg leading-none"
          aria-label="Dismiss survey"
        >
          ×
        </button>

        <h2 id="survey-title" className="text-base font-semibold mb-1">
          Quick question — 30 days in 🎉
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          Did you get any interview requests this month from applications we sent?
        </p>

        {/* answer buttons */}
        <div className="flex gap-2 mb-4">
          {(['yes', 'no', 'not_sure'] as const).map((a) => (
            <button
              key={a}
              onClick={() => handleAnswer(a)}
              className={[
                'flex-1 rounded-lg border py-2 text-sm font-medium transition-colors',
                selected === a
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-accent',
              ].join(' ')}
            >
              {a === 'yes' ? 'Yes!' : a === 'no' ? 'No' : 'Not sure'}
            </button>
          ))}
        </div>

        {/* optional count */}
        {selected === 'yes' && (
          <div className="mb-4">
            <label className="text-xs text-muted-foreground mb-1 block" htmlFor="interview-count">
              How many interview requests? (optional)
            </label>
            <input
              id="interview-count"
              type="number"
              min="1"
              max="99"
              value={interviewCount}
              onChange={(e) => setInterviewCount(e.target.value)}
              placeholder="e.g. 3"
              className="w-24 rounded border border-input bg-background px-2 py-1 text-sm"
            />
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selected || submitting}
          className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          {submitting ? 'Saving…' : 'Submit'}
        </button>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          This takes 5 seconds and helps us improve the service for you.
        </p>
      </div>
    </div>
  )
}
