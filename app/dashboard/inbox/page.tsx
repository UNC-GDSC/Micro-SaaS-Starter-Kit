/**
 * /dashboard/inbox — Job-email inbox (Prompt 22)
 *
 * Server component: fetches messages, marks selected message as read,
 * then renders InboxShell (client component) with all data pre-loaded.
 *
 * URL state:
 *   ?filter=<InboxClass>  — show only messages of this class (omit for all)
 *   ?id=<messageId>       — selected message (defaults to latest)
 */

export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { InboxClass } from '@prisma/client'
import { InboxShell, type InboxMessageSummary } from './InboxShell'

const VALID_CLASSES = new Set<string>(Object.values(InboxClass))

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; id?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const { filter, id: selectedId } = await searchParams
  const userId = session.user.id

  // Resolve filter
  const classFilter =
    filter && VALID_CLASSES.has(filter) ? (filter as InboxClass) : undefined

  // Fetch messages (include bodyHtml for selected message only via post-filter)
  const messages = await prisma.inboxMessage.findMany({
    where: {
      userId,
      ...(classFilter ? { classification: classFilter } : {}),
    },
    orderBy: { receivedAt: 'desc' },
    take: 60,
    select: {
      id: true,
      fromEmail: true,
      fromName: true,
      subject: true,
      bodyText: true,
      bodyHtml: true,
      classification: true,
      receivedAt: true,
      isRead: true,
      application: {
        select: { id: true, jobTitle: true, company: true },
      },
    },
  })

  // Determine selected message
  const selectedMessage =
    (selectedId ? messages.find((m) => m.id === selectedId) : null) ??
    messages[0] ??
    null

  // Mark selected as read (server-side; no round trip needed)
  if (selectedMessage && !selectedMessage.isRead) {
    await prisma.inboxMessage.update({
      where: { id: selectedMessage.id },
      data: { isRead: true },
    })
    // Reflect in the in-memory list so the UI renders correctly
    const idx = messages.findIndex((m) => m.id === selectedMessage.id)
    if (idx >= 0) messages[idx] = { ...messages[idx], isRead: true }
  }

  // User's inbox address
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { inboxHandle: true },
  })
  const inboxDomain = process.env.INBOX_DOMAIN ?? 'inbox.resumeai-bot.ru'
  const inboxAddress = user?.inboxHandle
    ? `${user.inboxHandle}@${inboxDomain}`
    : null

  // Counts per filter tab (computed from the full unfiltered set)
  const allMessages = classFilter
    ? await prisma.inboxMessage.findMany({
        where: { userId },
        select: { classification: true },
      })
    : messages

  const counts: Record<string, number> = { ALL: 0 }
  for (const m of allMessages) {
    counts['ALL'] = (counts['ALL'] ?? 0) + 1
    counts[m.classification] = (counts[m.classification] ?? 0) + 1
  }

  return (
    <InboxShell
      messages={messages as InboxMessageSummary[]}
      selected={selectedMessage as InboxMessageSummary | null}
      activeFilter={filter ?? 'ALL'}
      counts={counts}
      inboxAddress={inboxAddress}
    />
  )
}
