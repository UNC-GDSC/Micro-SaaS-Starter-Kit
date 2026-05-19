'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * /dashboard/settings/automation
 *
 * Lets Pro/Unlimited users control whether per-application AI tailoring
 * is enabled.  Free users see the toggle locked with an upgrade prompt.
 *
 * Preference is persisted via PATCH /api/user/preferences.
 */

function PlanBadge({ tier }: { tier: string }) {
  const colour: Record<string, string> = {
    pro:       'bg-emerald-100 text-emerald-700',
    unlimited: 'bg-purple-100 text-purple-700',
    trial:     'bg-yellow-100 text-yellow-700',
    free:      'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colour[tier] ?? colour.free}`}>
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  )
}

export default function AutomationSettingsPage() {
  const { data: session } = useSession()
  const [tailorEnabled, setTailorEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Derive plan tier from Stripe subscription fields
  const hasActiveSub =
    session?.user?.stripeSubscriptionId &&
    session?.user?.stripeCurrentPeriodEnd &&
    new Date(session.user.stripeCurrentPeriodEnd) > new Date()

  // Rough tier detection — a real app would store tier name in the DB
  const planTier: string = hasActiveSub ? 'pro' : 'free'
  const canTailor = planTier !== 'free'

  // Load current preference from API
  useEffect(() => {
    if (!session?.user) return
    fetch('/api/user/preferences')
      .then((r) => r.json())
      .then((data) => {
        const prefs = data.preferences ?? {}
        // Default: ON for paid, OFF for free
        setTailorEnabled(
          'tailorApplications' in prefs ? Boolean(prefs.tailorApplications) : canTailor
        )
      })
      .catch(() => setLoadError('Could not load preferences'))
  }, [session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = async () => {
    if (!canTailor) return
    const next = !tailorEnabled
    setTailorEnabled(next)
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tailorApplications: next }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setTailorEnabled(!next) // revert on error
    } finally {
      setSaving(false)
    }
  }

  if (!session?.user) return null

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Automation settings</h1>
        <p className="text-slate-500">Control how ResumeAI applies to jobs on your behalf</p>
      </div>

      {loadError && (
        <p className="text-sm text-red-500">{loadError}</p>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Tailor each application
                <PlanBadge tier={planTier} />
              </CardTitle>
              <CardDescription className="mt-1">
                For every job application, ResumeAI uses AI to reorder your resume bullets
                and write a specific cover letter based on the job description.
                Costs ≈&nbsp;$0.01–0.05 per application (gpt-4o-mini).
              </CardDescription>
            </div>
            {/* Toggle switch */}
            <button
              role="switch"
              aria-checked={tailorEnabled}
              disabled={!canTailor || saving}
              onClick={handleToggle}
              className={[
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
                tailorEnabled && canTailor ? 'bg-emerald-600' : 'bg-slate-200',
                !canTailor ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform',
                  tailorEnabled && canTailor ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>
        </CardHeader>

        {!canTailor && (
          <CardContent>
            <p className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
              Per-application tailoring is available on <strong>Pro</strong> and{' '}
              <strong>Unlimited</strong> plans.{' '}
              <a href="/dashboard/billing" className="underline text-emerald-600 hover:text-emerald-700">
                Upgrade to unlock →
              </a>
            </p>
          </CardContent>
        )}

        {canTailor && saved && (
          <CardContent>
            <p className="text-sm text-emerald-600">✓ Saved</p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How tailoring works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <div className="flex gap-3">
            <span className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold">1</span>
            <p>Your stored resume JSON is passed to <code className="bg-slate-100 rounded px-1">gpt-4o-mini</code> along with the job description.</p>
          </div>
          <div className="flex gap-3">
            <span className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold">2</span>
            <p>Bullets are reordered to put the most relevant experience first. No new experience is invented.</p>
          </div>
          <div className="flex gap-3">
            <span className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold">3</span>
            <p>A 200–300 word cover letter is written specifically for that role and company.</p>
          </div>
          <div className="flex gap-3">
            <span className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold">4</span>
            <p>Both are saved to your application so you can inspect exactly what was submitted from the <Link href="/dashboard/applications" className="underline">Applications</Link> page.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
