import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Navbar } from '@/components/navbar'
import { SurveyModal } from '@/components/SurveyModal'
import { getPendingSurvey } from '@/lib/pmf/survey'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Check for a pending day-30 interview survey
  const pendingSurvey = session.user?.id
    ? await getPendingSurvey(session.user.id)
    : null

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      {pendingSurvey && <SurveyModal surveyId={pendingSurvey.id} />}
    </div>
  )
}
