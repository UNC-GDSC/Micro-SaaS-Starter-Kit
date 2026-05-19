'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EXIT_REASONS, type ExitReason } from '@/lib/pmf/types'

export default function BillingPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [portalLoading, setPortalLoading] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [selectedReason, setSelectedReason] = useState<ExitReason | ''>('')
  const [otherText, setOtherText] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [refunding, setRefunding] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [refundError, setRefundError] = useState('')
  const [cancelled, setCancelled] = useState(false)
  const [refunded, setRefunded] = useState(false)

  const hasActiveSubscription =
    session?.user?.stripeSubscriptionId &&
    session?.user?.stripeCurrentPeriodEnd &&
    new Date(session.user.stripeCurrentPeriodEnd) > new Date()

  // 30-day guarantee eligibility: firstPaidAt within last 30 days and not yet refunded
  const firstPaidAt = session?.user?.firstPaidAt ? new Date(session.user.firstPaidAt) : null
  // Snapshot time once at page load — billing eligibility only needs to be accurate
  // at the moment the page is first viewed, not on every re-render.
  // eslint-disable-next-line react-hooks/purity -- intentional one-time snapshot
  const nowMs = useMemo(() => Date.now(), [])
  const daysSinceFirstPayment = firstPaidAt
    ? (nowMs - firstPaidAt.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity
  const canRequestRefund =
    hasActiveSubscription &&
    !refunded &&
    daysSinceFirstPayment <= 30

  const handleManageBilling = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/create-portal-session', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setPortalLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!selectedReason) {
      setCancelError('Please select a reason before cancelling.')
      return
    }
    setCancelError('')
    setCancelling(true)
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: selectedReason,
          otherText: selectedReason === 'other' ? otherText : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setCancelError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setCancelled(true)
      setShowCancelDialog(false)
      router.refresh()
    } finally {
      setCancelling(false)
    }
  }

  const handleRefund = async () => {
    setRefundError('')
    setRefunding(true)
    try {
      const res = await fetch('/api/billing/refund', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setRefundError(data.error ?? 'Something went wrong. Please contact support.')
        return
      }
      setRefunded(true)
      setShowRefundDialog(false)
      router.refresh()
    } finally {
      setRefunding(false)
    }
  }

  if (!session?.user) return null

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-gray-500">Manage your subscription</p>
      </div>

      {cancelled && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Your subscription has been cancelled. You&apos;ll retain access until the end of your
          current billing period.
          {' '}If you got a job through ResumeAI, we&apos;d love a{' '}
          <a href="mailto:hello@resumeai-bot.ru" className="underline">
            testimonial
          </a>
          !
        </div>
      )}

      {refunded && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Your refund has been processed. You&apos;ll receive a confirmation email shortly.
          Bank processing typically takes 5–10 business days.
        </div>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Your current plan and billing details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">
                  {hasActiveSubscription ? 'Active subscription' : 'Free plan'}
                </p>
                {hasActiveSubscription && session.user.stripeCurrentPeriodEnd && (
                  <p className="text-sm text-muted-foreground">
                    Renews{' '}
                    {new Date(session.user.stripeCurrentPeriodEnd).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
              <Button onClick={handleManageBilling} disabled={portalLoading} variant="outline">
                {portalLoading ? 'Loading…' : 'Manage billing'}
              </Button>
            </div>

            {/* 30-day money-back guarantee banner */}
            {canRequestRefund && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-medium text-amber-900 mb-1">
                  30-day money-back guarantee
                </p>
                <p className="text-xs text-amber-800 mb-2">
                  Not getting interviews? You have{' '}
                  <strong>{Math.max(0, Math.ceil(30 - daysSinceFirstPayment))} days</strong>{' '}
                  left to claim your full refund.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-400 text-amber-900 hover:bg-amber-100 text-xs"
                  onClick={() => setShowRefundDialog(true)}
                >
                  Cancel &amp; request refund
                </Button>
              </div>
            )}

            {hasActiveSubscription && !cancelled && !refunded && (
              <div className="pt-2">
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 text-sm"
                  onClick={() => setShowCancelDialog(true)}
                >
                  Cancel subscription
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel dialog */}
      {showCancelDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCancelDialog(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-background border shadow-xl p-6 mx-4">
            <h2 id="cancel-title" className="text-lg font-semibold mb-1">
              Before you go…
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              We&apos;re sorry to see you leave. Please tell us why — it helps us improve for
              everyone.
            </p>

            <fieldset className="space-y-2 mb-4">
              <legend className="text-sm font-medium mb-2">
                Why are you cancelling?{' '}
                <span className="text-destructive" aria-hidden="true">*</span>
              </legend>
              {EXIT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={[
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                    selectedReason === r.value
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-input hover:bg-accent',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="exit-reason"
                    value={r.value}
                    checked={selectedReason === r.value}
                    onChange={() => setSelectedReason(r.value)}
                    className="sr-only"
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>

            {selectedReason === 'other' && (
              <textarea
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Tell us more (optional)…"
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-4 resize-none"
              />
            )}

            {cancelError && (
              <p className="mb-3 text-sm text-destructive">{cancelError}</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelDialog(false)}
                disabled={cancelling}
              >
                Keep subscription
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancel}
                disabled={cancelling || !selectedReason}
              >
                {cancelling ? 'Cancelling…' : 'Cancel subscription'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Refund confirmation dialog */}
      {showRefundDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-title"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowRefundDialog(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-background border shadow-xl p-6 mx-4">
            <h2 id="refund-title" className="text-lg font-semibold mb-1">
              Claim your 30-day refund
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              We&apos;ll cancel your subscription immediately and issue a full refund to your
              original payment method. Bank processing takes <strong>5–10 business days</strong>.
              This action cannot be undone.
            </p>

            {refundError && (
              <p className="mb-3 text-sm text-destructive">{refundError}</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowRefundDialog(false)}
                disabled={refunding}
              >
                Go back
              </Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleRefund}
                disabled={refunding}
              >
                {refunding ? 'Processing…' : 'Confirm refund'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
