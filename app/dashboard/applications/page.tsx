import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import ApplicationsClient from './applications-client'

export default async function ApplicationsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const applications = await prisma.jobApplication.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { resume: { select: { title: true } } },
  })

  const serialized = applications.map((app) => ({
    id: app.id,
    jobTitle: app.jobTitle,
    company: app.company,
    location: app.location ?? '',
    source: app.source,
    status: app.status,
    appliedAt: app.appliedAt ? app.appliedAt.toISOString() : null,
    resumeTitle: app.resume?.title ?? null,
    tailored: app.tailoredResume !== null,
  }))

  return (
    <div className="container mx-auto max-w-6xl py-10 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Applications</h1>
        <p className="text-slate-500">{serialized.length} total applications</p>
      </div>
      <ApplicationsClient applications={serialized} />
    </div>
  )
}
