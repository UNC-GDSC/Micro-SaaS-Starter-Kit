import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPlanByPriceId } from '@/lib/pricing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const userId = session.user.id

  const [resumes, campaigns, recentApplications, replyCount] = await Promise.all([
    prisma.resume.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.autoApplyCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { resume: { select: { title: true } } },
    }),
    prisma.jobApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { resume: { select: { title: true } } },
    }),
    prisma.inboxMessage.count({ where: { userId } }),
  ])

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const totalApps = await prisma.jobApplication.count({ where: { userId } })
  const weekApps = await prisma.jobApplication.count({
    where: { userId, createdAt: { gte: weekAgo } },
  })
  const interviews = await prisma.jobApplication.count({
    where: { userId, status: 'INTERVIEW' },
  })

  const plan = getPlanByPriceId(session.user.stripePriceId)

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Welcome back, {session.user.name ?? session.user.email}!</p>
      </div>

      {/* KPI strip */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalApps}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{weekApps}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{interviews}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Recruiter Replies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{replyCount}</div>
            <Link href="/dashboard/inbox" className="text-xs text-emerald-600 hover:underline">
              Open inbox →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{plan.name}</div>
            <p className="text-xs text-slate-400">{plan.dailyLimit} apps/day</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Resumes */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Your Resumes</h2>
            <Button asChild size="sm">
              <Link href="/dashboard/resumes/new">+ New resume</Link>
            </Button>
          </div>
          {resumes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-400">
                No resumes yet.{' '}
                <Link href="/dashboard/resumes/new" className="text-emerald-600 underline">
                  Create your first one
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {resumes.map((resume) => (
                <Card key={resume.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-slate-900">{resume.title}</p>
                      {resume.targetRole && (
                        <p className="text-sm text-slate-400">{resume.targetRole}</p>
                      )}
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/resumes/${resume.id}`}>View</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Campaigns */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Active Campaigns</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/campaigns/new">+ New campaign</Link>
            </Button>
          </div>
          {campaigns.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-400">
                No campaigns yet.{' '}
                <Link href="/dashboard/campaigns/new" className="text-emerald-600 underline">
                  Start auto-applying
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {campaigns.map((c) => (
                <Card key={c.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-slate-900">{c.name}</p>
                      <p className="text-sm text-slate-400">
                        {c.resume.title} &middot; {c.source}
                      </p>
                    </div>
                    <CampaignToggleForm id={c.id} isActive={c.isActive} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent applications */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Recent Applications</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/applications">View all</Link>
          </Button>
        </div>
        {recentApplications.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-400">
              No applications yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Job</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Company</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Source</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Applied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentApplications.map((app) => (
                      <tr
                        key={app.id}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{app.jobTitle}</td>
                        <td className="px-4 py-3 text-slate-600">{app.company}</td>
                        <td className="px-4 py-3 text-slate-400">{app.source}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={app.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {app.appliedAt
                            ? new Date(app.appliedAt).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    QUEUED: 'bg-slate-100 text-slate-600',
    SUBMITTED: 'bg-blue-100 text-blue-700',
    FAILED: 'bg-red-100 text-red-700',
    INTERVIEW: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-orange-100 text-orange-700',
    OFFER: 'bg-green-100 text-green-700',
    WITHDRAWN: 'bg-slate-100 text-slate-400',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  )
}

function CampaignToggleForm({ id, isActive }: { id: string; isActive: boolean }) {
  return (
    <form
      action={async () => {
        'use server'
        await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/campaigns/${id}/toggle`,
          { method: 'POST' },
        )
      }}
    >
      <Button type="submit" variant={isActive ? 'default' : 'outline'} size="sm">
        {isActive ? 'Pause' : 'Resume'}
      </Button>
    </form>
  )
}
