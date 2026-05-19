/**
 * GET /api/extension/resume
 *
 * Returns the user's default resume in a flat shape suitable for autofill.
 * Authenticated via extension Bearer key (scope='extension').
 *
 * Response shape (all fields may be empty strings if not set):
 * {
 *   firstName, lastName, email, phone, location,
 *   linkedinUrl, websiteUrl, currentCompany, currentTitle,
 *   experienceYears, summary
 * }
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateExtensionRequest } from '@/lib/extension-auth'

export async function GET(request: Request) {
  const auth = await validateExtensionRequest(request)
  if (!auth.valid) {
    return new NextResponse(auth.error ?? 'Unauthorized', { status: 401 })
  }

  try {
    // Prefer the default resume; fall back to the most recently created one
    const resume = await prisma.resume.findFirst({
      where: { userId: auth.userId! },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    if (!resume) {
      return NextResponse.json(
        { error: 'No resume found. Create one at resumeai-bot.ru/dashboard/resumes.' },
        { status: 404 },
      )
    }

    // `generated` is a JSON blob from the AI resume builder.
    // We normalise it into a stable flat shape for the extension.
    const g = resume.generated as Record<string, any>

    // Name: prefer split first_name/last_name; fall back to splitting `name`
    let firstName = g.first_name ?? g.firstName ?? ''
    let lastName = g.last_name ?? g.lastName ?? ''
    if (!firstName && !lastName && (g.name ?? g.full_name)) {
      const parts = ((g.name ?? g.full_name) as string).trim().split(/\s+/)
      firstName = parts[0] ?? ''
      lastName = parts.slice(1).join(' ')
    }

    // Current employer: first entry in experience array
    const experience: any[] = Array.isArray(g.experience) ? g.experience : []
    const latestJob = experience[0] ?? {}
    const currentCompany = g.current_company ?? latestJob.company ?? latestJob.employer ?? ''
    const currentTitle = g.current_title ?? g.target_role ?? latestJob.title ?? latestJob.position ?? resume.targetRole ?? ''

    // Years of experience: explicit field or count across experience entries
    const expYears =
      g.experience_years ??
      g.years_of_experience ??
      (experience.length > 0 ? String(experience.length) : '1')

    const flat = {
      firstName,
      lastName,
      email: g.email ?? '',
      phone: g.phone ?? g.phone_number ?? '',
      location: g.location ?? g.city ?? '',
      linkedinUrl: g.linkedin_url ?? g.linkedin ?? '',
      websiteUrl: g.website_url ?? g.website ?? g.portfolio_url ?? '',
      currentCompany,
      currentTitle,
      experienceYears: String(expYears),
      summary: g.summary ?? g.professional_summary ?? g.objective ?? '',
      resumeId: resume.id,
      resumeTitle: resume.title,
    }

    return NextResponse.json(flat)
  } catch (err: any) {
    console.error('[extension/resume] error:', err)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
