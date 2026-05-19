'use client'

/**
 * /dashboard/settings/notifications
 *
 * Toggle daily digest emails and set the user's timezone for delivery timing.
 * Preferences are persisted via PATCH /api/user/notifications.
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Common IANA timezones for the picker — covers most users
const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
]

export default function NotificationsSettingsPage() {
  const { data: session } = useSession()

  const [digestEnabled, setDigestEnabled] = useState(true)
  const [timezone, setTimezone] = useState('UTC')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Load current settings
  useEffect(() => {
    if (!session?.user) return
    fetch('/api/user/notifications')
      .then((r) => r.json())
      .then((data) => {
        setDigestEnabled(data.dailyDigestEnabled ?? true)
        setTimezone(data.timezone ?? 'UTC')
      })
      .catch(() => setLoadError('Could not load notification settings'))
  }, [session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/user/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyDigestEnabled: digestEnabled, timezone }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (!session?.user) return null

  const hasActiveSub =
    session.user.stripeSubscriptionId &&
    session.user.stripeCurrentPeriodEnd &&
    new Date(session.user.stripeCurrentPeriodEnd) > new Date()

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Notification settings</h1>
        <p className="text-gray-500">Control how and when we email you</p>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daily activity digest</CardTitle>
          <CardDescription>
            A morning summary of applications sent and recruiter replies from the previous day.
            Only sent on days when there is activity to report.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Digest toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-sm">Daily digest email</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Delivered at 8 am in your chosen timezone
              </p>
            </div>
            <button
              role="switch"
              aria-checked={digestEnabled}
              onClick={() => {
                if (hasActiveSub) setDigestEnabled((v) => !v)
              }}
              disabled={!hasActiveSub}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                digestEnabled ? 'bg-primary' : 'bg-muted',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                  digestEnabled ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
          </div>

          {/* Timezone picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="timezone-select">
              Delivery timezone
            </label>
            <select
              id="timezone-select"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={!hasActiveSub || !digestEnabled}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Digest is sent at 8:00 am in this timezone.
            </p>
          </div>

          {/* Free-tier notice */}
          {!hasActiveSub && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Daily digest emails are available on paid plans.{' '}
              <a href="/pricing" className="font-medium underline">
                Upgrade to unlock
              </a>
            </div>
          )}

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !hasActiveSub}>
              {saving ? 'Saving…' : 'Save preferences'}
            </Button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">Saved!</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
