import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/**
 * /dashboard/applications/[id]
 *
 * Application detail view.  Shows:
 *  - Application metadata (job, company, status, applied date)
 *  - If tailored: side-by-side base resume vs what-was-submitted comparison
 *  - The cover letter that was generated and submitted
 *  - Cost metadata (tokens, model) for transparency
 */
export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const { id } = await params

  const app = await prisma.jobApplication.findUnique({
    where: { id },
    include: {
      resume: { select: { title: true, generated: true } },
    },
  })

  if (!app || app.userId !== session.user.id) notFound()

  const hasTailoring = app.tailoredResume !== null

  const formatJson = (obj: unknown) =>
    obj ? JSON.stringify(obj, null, 2) : null

  const statusColour: Record<string, string> = {
    QUEUED:    'bg-slate-100 text-slate-700',
    SUBMITTED: 'bg-emerald-100 text-emerald-700',
    FAILED:    'bg-red-100 text-red-700',
    INTERVIEW: 'bg-blue-100 text-blue-700',
    REJECTED:  'bg-orange-100 text-orange-700',
    OFFER:     'bg-purple-100 text-purple-700',
    WITHDRAWN: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="container mx-auto max-w-6xl py-10 px-4 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900">{app.jobTitle}</h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColour[app.status] ?? 'bg-slate-100 text-slate-700'}`}
          >
            {app.status}
          </span>
          {hasTailoring && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-violet-100 text-violet-700">
              ✦ AI tailored
            </span>
          )}
        </div>
        <p className="text-slate-500 mt-1">
          {app.company}
          {app.location ? ` · ${app.location}` : ''}
          {app.appliedAt ? ` · Applied ${new Date(app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
        </p>
      </div>

      {/* ── Tailoring metadata ──────────────────────────────────────────────── */}
      {hasTailoring && app.tailoringModelUsed && (
        <Card className="border-violet-200 bg-violet-50">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-violet-700">
              <span className="font-medium">AI tailoring applied</span>
              {' '}using <code className="font-mono bg-violet-100 px-1 rounded">{app.tailoringModelUsed}</code>
              {app.tailoringTokensUsed != null && (
                <> · {app.tailoringTokensUsed.toLocaleString()} tokens
                   {' '}(≈${((app.tailoringTokensUsed / 1_000_000) * 0.15).toFixed(4)})</>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Cover letter ─────────────────────────────────────────────────────── */}
      {app.tailoredCoverLetter && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cover letter submitted</CardTitle>
            <CardDescription>Generated specifically for this application</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
              {app.tailoredCoverLetter}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Resume comparison ──────────────────────────────────────────────── */}
      {hasTailoring ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-600">Base resume</CardTitle>
              <CardDescription>
                {app.resume?.title ?? 'Stored resume'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-xs text-slate-600 font-mono bg-slate-50 rounded-lg p-4 overflow-auto max-h-[600px]">
                {formatJson(app.resume?.generated) ?? '(no resume on file)'}
              </pre>
            </CardContent>
          </Card>

          <Card className="border-violet-200">
            <CardHeader>
              <CardTitle className="text-base text-violet-700">What was submitted ✦</CardTitle>
              <CardDescription>Tailored version sent to {app.company}</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-xs text-slate-700 font-mono bg-violet-50 rounded-lg p-4 overflow-auto max-h-[600px]">
                {formatJson(app.tailoredResume) ?? '(no data)'}
              </pre>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resume used</CardTitle>
            <CardDescription>
              {hasTailoring ? 'Tailored version' : 'Base resume — no tailoring applied'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-xs text-slate-600 font-mono bg-slate-50 rounded-lg p-4 overflow-auto max-h-[600px]">
              {formatJson(app.resume?.generated) ?? '(no resume on file)'}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* ── Job URL ────────────────────────────────────────────────────────── */}
      <div className="text-sm text-slate-500">
        <a
          href={app.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-800"
        >
          View original job posting ↗
        </a>
      </div>
    </div>
  )
}
