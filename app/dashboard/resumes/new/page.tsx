'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const workHistoryItemSchema = z.object({
  company: z.string().min(1, 'Required'),
  role: z.string().min(1, 'Required'),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string(),
  bullets: z.array(z.string()),
})

const educationItemSchema = z.object({
  school: z.string().min(1, 'Required'),
  degree: z.string().min(1, 'Required'),
  year: z.string(),
})

const formSchema = z.object({
  // Step 1
  targetRole: z.string().min(1, 'Required'),
  yearsExp: z.coerce.number().min(0),
  location: z.string().min(1, 'Required'),
  remote: z.boolean(),
  // Step 2
  workHistory: z.array(workHistoryItemSchema),
  // Step 3
  education: z.array(educationItemSchema),
  skills: z.array(z.string()),
  // Step 4
  tone: z.enum(['formal', 'friendly', 'direct']),
})

type FormValues = z.infer<typeof formSchema>

const TOTAL_STEPS = 4

const defaultValues: FormValues = {
  targetRole: '',
  yearsExp: 0,
  location: '',
  remote: false,
  workHistory: [{ company: '', role: '', startDate: '', endDate: '', bullets: [''] }],
  education: [{ school: '', degree: '', year: '' }],
  skills: [''],
  tone: 'formal',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewResumePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  const {
    fields: workFields,
    append: appendWork,
    remove: removeWork,
  } = useFieldArray({ control, name: 'workHistory' })

  const {
    fields: eduFields,
    append: appendEdu,
    remove: removeEdu,
  } = useFieldArray({ control, name: 'education' })

  const {
    fields: skillFields,
    append: appendSkill,
    remove: removeSkill,
  } = useFieldArray({ control, name: 'skills' as never })

  async function onSubmit(data: FormValues) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to create resume')
      }
      const created = await res.json()
      router.push(`/dashboard/resumes/${created.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setSubmitting(false)
    }
  }

  const formValues = watch()

  return (
    <div className="container mx-auto max-w-2xl py-10 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Create a new resume</h1>
        <p className="text-slate-500">Step {step} of {TOTAL_STEPS}</p>
        {/* Progress bar */}
        <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {submitting ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="text-lg font-medium text-slate-700">Crafting your resume…</p>
            <p className="text-sm text-slate-400">This usually takes ~15 s</p>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* ------------------------------------------------------------------ */}
          {/* Step 1 — basics */}
          {/* ------------------------------------------------------------------ */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Basic info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="targetRole">Target role *</Label>
                  <Input id="targetRole" placeholder="e.g. Senior Backend Engineer" {...register('targetRole')} />
                  {errors.targetRole && <p className="mt-1 text-xs text-red-500">{errors.targetRole.message}</p>}
                </div>
                <div>
                  <Label htmlFor="yearsExp">Years of experience</Label>
                  <Input id="yearsExp" type="number" min={0} {...register('yearsExp')} />
                </div>
                <div>
                  <Label htmlFor="location">Location *</Label>
                  <Input id="location" placeholder="e.g. Berlin, Germany" {...register('location')} />
                  {errors.location && <p className="mt-1 text-xs text-red-500">{errors.location.message}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <input id="remote" type="checkbox" className="h-4 w-4" {...register('remote')} />
                  <Label htmlFor="remote">Open to remote</Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* Step 2 — work history */}
          {/* ------------------------------------------------------------------ */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Work history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {workFields.map((field, idx) => (
                  <div key={field.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-700">Position {idx + 1}</span>
                      {workFields.length > 1 && (
                        <button type="button" onClick={() => removeWork(idx)} className="text-xs text-red-500 hover:underline">
                          Remove
                        </button>
                      )}
                    </div>
                    <div>
                      <Label>Company *</Label>
                      <Input placeholder="Acme Corp" {...register(`workHistory.${idx}.company`)} />
                    </div>
                    <div>
                      <Label>Role *</Label>
                      <Input placeholder="Software Engineer" {...register(`workHistory.${idx}.role`)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Start date *</Label>
                        <Input type="month" {...register(`workHistory.${idx}.startDate`)} />
                      </div>
                      <div>
                        <Label>End date</Label>
                        <Input type="month" placeholder="Present" {...register(`workHistory.${idx}.endDate`)} />
                      </div>
                    </div>
                    <div>
                      <Label>Key achievements</Label>
                      <Input placeholder="e.g. Reduced API latency by 40%" {...register(`workHistory.${idx}.bullets.0`)} />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendWork({ company: '', role: '', startDate: '', endDate: '', bullets: [''] })}
                >
                  + Add position
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* Step 3 — education + skills */}
          {/* ------------------------------------------------------------------ */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Education &amp; skills</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="mb-3 font-medium text-slate-700">Education</h3>
                  {eduFields.map((field, idx) => (
                    <div key={field.id} className="mb-4 rounded-lg border border-slate-200 p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Entry {idx + 1}</span>
                        {eduFields.length > 1 && (
                          <button type="button" onClick={() => removeEdu(idx)} className="text-xs text-red-500 hover:underline">
                            Remove
                          </button>
                        )}
                      </div>
                      <div>
                        <Label>School *</Label>
                        <Input placeholder="MIT" {...register(`education.${idx}.school`)} />
                      </div>
                      <div>
                        <Label>Degree *</Label>
                        <Input placeholder="B.Sc. Computer Science" {...register(`education.${idx}.degree`)} />
                      </div>
                      <div>
                        <Label>Graduation year</Label>
                        <Input type="number" placeholder="2020" {...register(`education.${idx}.year`)} />
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendEdu({ school: '', degree: '', year: '' })}
                  >
                    + Add education
                  </Button>
                </div>

                <div>
                  <h3 className="mb-3 font-medium text-slate-700">Skills</h3>
                  {skillFields.map((field, idx) => (
                    <div key={field.id} className="mb-2 flex gap-2">
                      <Input placeholder="e.g. TypeScript" {...register(`skills.${idx}` as const)} />
                      {skillFields.length > 1 && (
                        <Button type="button" variant="outline" size="sm" onClick={() => removeSkill(idx)}>
                          &times;
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendSkill('' as never)}
                  >
                    + Add skill
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* Step 4 — tone + review */}
          {/* ------------------------------------------------------------------ */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Tone &amp; review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Writing tone</Label>
                  <div className="mt-2 flex gap-3">
                    {(['formal', 'friendly', 'direct'] as const).map((t) => (
                      <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2">
                        <input type="radio" value={t} {...register('tone')} className="accent-emerald-600" />
                        <span className="capitalize text-sm">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Review summary */}
                <div className="rounded-lg bg-slate-50 p-4 space-y-2 text-sm text-slate-700">
                  <p><span className="font-medium">Role:</span> {formValues.targetRole || '—'}</p>
                  <p><span className="font-medium">Experience:</span> {formValues.yearsExp} years</p>
                  <p><span className="font-medium">Location:</span> {formValues.location || '—'} {formValues.remote && '· Remote'}</p>
                  <p><span className="font-medium">Positions:</span> {formValues.workHistory.length}</p>
                  <p><span className="font-medium">Education:</span> {formValues.education.length} entries</p>
                  <p><span className="font-medium">Skills:</span> {formValues.skills.filter(Boolean).join(', ') || '—'}</p>
                  <p><span className="font-medium">Tone:</span> {formValues.tone}</p>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="mt-6 flex justify-between">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : (
              <div />
            )}
            {step < TOTAL_STEPS ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create resume'}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
