'use client'

/**
 * InboxShell — client-side shell for the job-email inbox.
 *
 * Receives pre-fetched messages from the server component and handles:
 *  - Filter chip navigation (changes URL → re-renders server component)
 *  - Message selection (changes URL → marks as read server-side)
 *  - Reply via mailto: (opens default mail client)
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InboxClass } from '@prisma/client'
import { formatDistanceToNow } from 'date-fns'

// ── Types mirroring the Prisma select in page.tsx ──────────────────────────

export interface InboxMessageSummary {
  id: string
  fromEmail: string
  fromName: string | null
  subject: string
  bodyText: string
  bodyHtml: string | null
  classification: InboxClass
  receivedAt: Date
  isRead: boolean
  application: { id: string; jobTitle: string; company: string } | null
}

interface Props {
  messages: InboxMessageSummary[]
  selected: InboxMessageSummary | null
  activeFilter: string
  counts: Record<string, number>
  inboxAddress: string | null
}

// ── Filter configuration ───────────────────────────────────────────────────

const FILTERS: { key: string; label: string; class?: string }[] = [
  { key: 'ALL',               label: 'All' },
  { key: 'INTERVIEW_REQUEST', label: 'Interviews' },
  { key: 'QUESTION',          label: 'Questions' },
  { key: 'REJECTION',         label: 'Rejections' },
]

// ── Classification badge styles ────────────────────────────────────────────

function ClassBadge({ cls }: { cls: InboxClass }) {
  const map: Record<InboxClass, string> = {
    INTERVIEW_REQUEST: 'bg-emerald-100 text-emerald-700',
    REJECTION:         'bg-red-100 text-red-700',
    QUESTION:          'bg-blue-100 text-blue-700',
    AUTOMATED:         'bg-slate-100 text-slate-500',
    OTHER:             'bg-slate-100 text-slate-500',
    UNCLASSIFIED:      'bg-slate-100 text-slate-400',
  }
  const labels: Record<InboxClass, string> = {
    INTERVIEW_REQUEST: 'Interview',
    REJECTION:         'Rejection',
    QUESTION:          'Question',
    AUTOMATED:         'Auto',
    OTHER:             'Other',
    UNCLASSIFIED:      '—',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[cls]}`}>
      {labels[cls]}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function InboxShell({ messages, selected, activeFilter, counts, inboxAddress }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function navigate(filter: string, id?: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (filter && filter !== 'ALL') {
      params.set('filter', filter)
    } else {
      params.delete('filter')
    }
    if (id) {
      params.set('id', id)
    } else {
      params.delete('id')
    }
    router.push(`/dashboard/inbox?${params.toString()}`)
  }

  const preview = (text: string, max = 120) =>
    text.length > max ? text.slice(0, max).trimEnd() + '…' : text

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
          {inboxAddress && (
            <p className="mt-0.5 text-sm text-slate-500">
              Recruiters reply to{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                {inboxAddress}
              </code>
            </p>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => {
          const isActive = activeFilter === key
          const count = counts[key] ?? 0
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {messages.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-slate-400">No messages yet.</p>
          {inboxAddress && (
            <p className="mt-2 text-sm text-slate-400">
              Share{' '}
              <code className="rounded bg-slate-100 px-1 font-mono text-xs">{inboxAddress}</code>{' '}
              with your network — recruiter replies will appear here.
            </p>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          {/* ── Message list ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-1 overflow-y-auto lg:max-h-[calc(100vh-220px)]">
            {messages.map((msg) => (
              <button
                key={msg.id}
                onClick={() => navigate(activeFilter, msg.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selected?.id === msg.id
                    ? 'border-slate-900 bg-slate-50'
                    : msg.isRead
                    ? 'border-slate-100 bg-white hover:bg-slate-50'
                    : 'border-slate-200 bg-white font-medium hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`truncate text-sm ${!msg.isRead ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                    {msg.fromName ?? msg.fromEmail}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDistanceToNow(new Date(msg.receivedAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-600">{msg.subject}</p>
                {msg.application && (
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {msg.application.company} — {msg.application.jobTitle}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-1.5">
                  <ClassBadge cls={msg.classification} />
                  {!msg.isRead && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* ── Thread / detail pane ──────────────────────────────────── */}
          {selected ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              {/* Subject + meta */}
              <div className="mb-4 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-semibold text-slate-900">{selected.subject}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                  <span>
                    <strong className="text-slate-700">From:</strong>{' '}
                    {selected.fromName
                      ? `${selected.fromName} <${selected.fromEmail}>`
                      : selected.fromEmail}
                  </span>
                  <span>
                    {new Date(selected.receivedAt).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                  <ClassBadge cls={selected.classification} />
                </div>
                {selected.application && (
                  <p className="mt-1.5 text-sm text-slate-400">
                    Re:{' '}
                    <a
                      href={`/dashboard/applications`}
                      className="text-slate-600 underline-offset-2 hover:underline"
                    >
                      {selected.application.jobTitle} @ {selected.application.company}
                    </a>
                  </p>
                )}
              </div>

              {/* Body */}
              <div className="prose prose-sm max-w-none text-slate-700">
                {selected.bodyHtml ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: selected.bodyHtml }}
                    className="rounded bg-slate-50 p-4 text-sm"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {selected.bodyText}
                  </pre>
                )}
              </div>

              {/* Reply CTA */}
              <div className="mt-6 border-t border-slate-100 pt-4">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`mailto:${selected.fromEmail}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                  >
                    Reply in email client →
                  </a>
                </Button>
                <p className="mt-1 text-xs text-slate-400">
                  Opens your default mail client. Outbound mail via the platform is on the roadmap.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 p-12 text-slate-400">
              Select a message to read it
            </div>
          )}
        </div>
      )}
    </div>
  )
}
