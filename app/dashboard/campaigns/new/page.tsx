'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const formSchema = z.object({
  resumeId: z.string().min(1, 'Please select a resume'),
  source: z.enum(['LINKEDIN', 'CAREEROPS']),
  keywords: z.string().min(1, 'Enter at least one keyword'),
  locations: z.string(),
  excludeCompanies: z.string(),
  dailyLimit: z.coerce.number().min(1).max(100),
  linkedinEmail: z.string().optional(),
  linkedinPassword: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface Resume {
  id: string
  title: string
}

interface Props {
  resumes?: Resume[]
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loadingResumes, setLoadingResumes] = useState(true)

  // Fetch resumes on mount
  useState(() => {
    fetch('/api/resumes')
      .then((r) => r.json())
      .then((data: Resume[]) => setResumes(Array.isArray(data) ? data : []))
      .catch(() => setResumes([]))
      .finally(() => setLoadingResumes(false))
  })

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      source: 'CAREEROPS',
      dailyLimit: 5,
    },
  })

  const source = watch('source')

  async function onSubmit(data: FormValues) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          keywords: data.keywords.split('\n').map((s) => s.trim()).filter(Boolean),
          locations: data.locations.split('\n').map((s) => s.trim()).filter(Boolean),
          excludeCompanies: data.excludeCompanies.split('\n').map((s) => s.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to create campaign')
      }
      router.push('/dashboard')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-xl py-10 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New campaign</h1>
        <p className="text-slate-500">Set up auto-apply for a batch of jobs.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Campaign settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resume picker */}
            <div>
              <Label htmlFor="resumeId">Resume *</Label>
              {loadingResumes ? (
                <p className="text-sm text-slate-400">Loading resumes…</p>
              ) : (
                <select
                  id="resumeId"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  {...register('resumeId')}
                >
                  <option value="">Select a resume</option>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              )}
              {errors.resumeId && (
                <p className="mt-1 text-xs text-red-500">{errors.resumeId.message}</p>
              )}
            </div>

            {/* Source */}
            <div>
              <Label>Job source *</Label>
              <div className="mt-2 flex gap-4">
                {(['CAREEROPS', 'LINKEDIN'] as const).map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-2">
                    <input type="radio" value={s} {...register('source')} className="accent-emerald-600" />
                    <span className="text-sm">{s}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div>
              <Label htmlFor="keywords">Keywords (one per line) *</Label>
              <textarea
                id="keywords"
                rows={3}
                placeholder="Python developer&#10;Backend engineer&#10;FastAPI"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                {...register('keywords')}
              />
              {errors.keywords && (
                <p className="mt-1 text-xs text-red-500">{errors.keywords.message}</p>
              )}
            </div>

            {/* Locations */}
            <div>
              <Label htmlFor="locations">Locations (one per line)</Label>
              <textarea
                id="locations"
                rows={2}
                placeholder="Berlin&#10;Remote"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                {...register('locations')}
              />
            </div>

            {/* Exclude companies */}
            <div>
              <Label htmlFor="excludeCompanies">Exclude companies (one per line)</Label>
              <textarea
                id="excludeCompanies"
                rows={2}
                placeholder="Acme Corp&#10;Bad Company Inc"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                {...register('excludeCompanies')}
              />
            </div>

            {/* Daily limit */}
            <div>
              <Label htmlFor="dailyLimit">Daily application limit</Label>
              <Input
                id="dailyLimit"
                type="number"
                min={1}
                max={100}
                {...register('dailyLimit')}
              />
              {errors.dailyLimit && (
                <p className="mt-1 text-xs text-red-500">{errors.dailyLimit.message}</p>
              )}
            </div>

            {/* LinkedIn credentials — only shown when source = LINKEDIN */}
            {source === 'LINKEDIN' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                <p className="text-sm font-medium text-amber-800">LinkedIn credentials</p>
                <p className="text-xs text-amber-600">
                  Your password is encrypted before being stored and never exposed in plain text.
                </p>
                <div>
                  <Label htmlFor="linkedinEmail">LinkedIn email</Label>
                  <Input
                    id="linkedinEmail"
                    type="email"
                    placeholder="you@example.com"
                    {...register('linkedinEmail')}
                  />
                </div>
                <div>
                  <Label htmlFor="linkedinPassword">LinkedIn password</Label>
                  <Input
                    id="linkedinPassword"
                    type="password"
                    {...register('linkedinPassword')}
                  />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create campaign'}
          </Button>
        </div>
      </form>
    </div>
  )
}
