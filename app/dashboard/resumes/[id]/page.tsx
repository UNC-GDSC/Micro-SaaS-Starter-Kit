import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ResumeDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const resume = await prisma.resume.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!resume) notFound()

  // generated is a Json field — cast to a loose object for rendering
  const generated = resume.generated as Record<string, unknown>

  return (
    <div className="container mx-auto max-w-3xl py-10 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{resume.title}</h1>
          {resume.targetRole && (
            <p className="text-slate-500">{resume.targetRole}</p>
          )}
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">← Dashboard</Link>
          </Button>
          <Button
            size="sm"
            disabled
            title="Coming soon"
            className="cursor-not-allowed opacity-60"
          >
            Download PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resume content</CardTitle>
        </CardHeader>
        <CardContent>
          <ResumeDisplay data={generated} />
        </CardContent>
      </Card>
    </div>
  )
}

function ResumeDisplay({ data }: { data: Record<string, unknown> }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-slate-400">Resume content not yet generated.</p>
  }

  return (
    <div className="space-y-6 text-sm text-slate-700">
      {Object.entries(data).map(([section, value]) => (
        <section key={section}>
          <h3 className="mb-2 text-base font-semibold capitalize text-slate-900">
            {section.replace(/_/g, ' ')}
          </h3>
          <SectionValue value={value} />
        </section>
      ))}
    </div>
  )
}

function SectionValue({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return <p className="text-slate-600">{value}</p>
  }
  if (Array.isArray(value)) {
    return (
      <ul className="list-inside list-disc space-y-1 text-slate-600">
        {value.map((item, i) => (
          <li key={i}>
            {typeof item === 'object' && item !== null ? (
              <span>{JSON.stringify(item)}</span>
            ) : (
              String(item)
            )}
          </li>
        ))}
      </ul>
    )
  }
  if (typeof value === 'object' && value !== null) {
    return (
      <div className="space-y-1">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k}>
            <span className="font-medium capitalize">{k.replace(/_/g, ' ')}: </span>
            <span className="text-slate-600">{String(v)}</span>
          </div>
        ))}
      </div>
    )
  }
  return <span className="text-slate-600">{String(value)}</span>
}
