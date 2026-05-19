'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Application {
  id: string
  jobTitle: string
  company: string
  location: string
  source: string
  status: string
  appliedAt: string | null
  resumeTitle: string | null
  tailored: boolean
}

interface Props {
  applications: Application[]
}

const STATUS_COLORS: Record<string, string> = {
  QUEUED: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  FAILED: 'bg-red-100 text-red-700',
  INTERVIEW: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-orange-100 text-orange-700',
  OFFER: 'bg-green-100 text-green-700',
  WITHDRAWN: 'bg-slate-100 text-slate-400',
}

const ALL_STATUSES = ['QUEUED', 'SUBMITTED', 'FAILED', 'INTERVIEW', 'REJECTED', 'OFFER', 'WITHDRAWN']
const ALL_SOURCES = ['LINKEDIN', 'CAREEROPS', 'ADZUNA', 'ARBEITNOW', 'REMOTEOK', 'THEMUSE', 'MANUAL']

export default function ApplicationsClient({ applications }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [sourceFilter, setSourceFilter] = useState<string>('ALL')

  const filtered = applications.filter((a) => {
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false
    if (sourceFilter !== 'ALL' && a.source !== sourceFilter) return false
    return true
  })

  function exportCsv() {
    const headers = ['Job Title', 'Company', 'Location', 'Source', 'Status', 'Applied At', 'Resume']
    const rows = filtered.map((a) => [
      a.jobTitle,
      a.company,
      a.location,
      a.source,
      a.status,
      a.appliedAt ? new Date(a.appliedAt).toLocaleDateString() : '',
      a.resumeTitle ?? '',
    ])

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Filters + export */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="ALL">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="ALL">All sources</option>
          {ALL_SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <span className="text-sm text-slate-400 ml-auto">{filtered.length} results</span>

        <Button variant="outline" size="sm" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            No applications match your filters.
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
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Location</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Source</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Applied</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Resume</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">AI</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((app) => (
                    <tr
                      key={app.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <Link
                          href={`/dashboard/applications/${app.id}`}
                          className="hover:text-emerald-600 hover:underline"
                        >
                          {app.jobTitle}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{app.company}</td>
                      <td className="px-4 py-3 text-slate-400">{app.location || '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{app.source}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[app.status] ?? 'bg-slate-100 text-slate-500'}`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{app.resumeTitle ?? '—'}</td>
                      <td className="px-4 py-3">
                        {app.tailored && (
                          <span className="text-violet-600 text-xs font-medium" title="AI tailored">✦</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
