/**
 * /unsubscribed
 *
 * Friendly confirmation shown after one-click unsubscribe from daily digest.
 */

import Link from 'next/link'

export default function UnsubscribedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold">You&apos;re unsubscribed</h1>
        <p className="mb-6 text-muted-foreground">
          We&apos;ve turned off daily digest emails for your account. You won&apos;t receive them
          any more.
        </p>
        <p className="mb-6 text-sm text-muted-foreground">
          You can re-enable them any time from your{' '}
          <Link href="/dashboard/settings/notifications" className="underline">
            notification settings
          </Link>
          .
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
