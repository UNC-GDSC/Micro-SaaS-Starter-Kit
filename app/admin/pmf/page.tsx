import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/pmf/admin'
import {
  getTodayMetrics,
  getLast30DaysMetrics,
  getCohortRetention,
  getReferralMetrics,
  getExitReasonHistogram,
  getLastUpdated,
} from '@/lib/pmf/queries'

// ── helpers ──────────────────────────────────────────────────────────────

function Tile({
  title,
  value,
  sub,
  accent,
}: {
  title: string
  value: string | number
  sub?: string
  accent?: 'green' | 'red' | 'yellow'
}) {
  const accentClass =
    accent === 'green'
      ? 'text-green-600'
      : accent === 'red'
        ? 'text-red-600'
        : accent === 'yellow'
          ? 'text-yellow-600'
          : 'text-foreground'

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accentClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  )
}

function pctStr(v: number | null): string {
  return v === null ? '—' : `${v}%`
}

function centsStr(cents: number): string {
  const sign = cents >= 0 ? '+' : '-'
  const abs = Math.abs(cents)
  return `${sign}$${(abs / 100).toFixed(2)}`
}

// ── page ─────────────────────────────────────────────────────────────────

export default async function PmfDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!isAdminEmail(session?.user?.email)) {
    redirect('/dashboard')
  }

  const [today, last30, cohort, referral, exitReasons] = await Promise.all([
    getTodayMetrics(),
    getLast30DaysMetrics(),
    getCohortRetention(),
    getReferralMetrics(),
    getExitReasonHistogram(),
  ])

  const updatedAt = getLastUpdated()

  // interview rate: prefer survey-based, fall back to app-status-based
  const interviewRate =
    last30.interviewRateSurvey !== null
      ? `${last30.interviewRateSurvey}% (survey)`
      : last30.interviewRateApps !== null
        ? `${last30.interviewRateApps}% (app status)`
        : '—'

  const interviewAccent =
    last30.interviewRateSurvey !== null && last30.interviewRateSurvey >= 10
      ? ('green' as const)
      : last30.interviewRateSurvey !== null && last30.interviewRateSurvey < 5
        ? ('red' as const)
        : undefined

  return (
    <div className="min-h-screen bg-background">
      {/* header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">ResumeAI — PMF Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              Admin only · Last updated {updatedAt.toLocaleTimeString()} · Cache TTL 15 min
            </p>
          </div>
          <a href="/dashboard" className="text-xs text-muted-foreground hover:underline">
            ← Dashboard
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* TODAY */}
        <Section title="Today">
          <Tile title="New free signups" value={today.newFreeSignups} />
          <Tile
            title="Free → Paid conversions"
            value={today.freeToPaidConversions}
            accent={today.freeToPaidConversions > 0 ? 'green' : undefined}
          />
          <Tile
            title="Cancellations"
            value={today.cancellationsToday}
            accent={today.cancellationsToday > 0 ? 'yellow' : undefined}
          />
          <Tile
            title="Net new MRR"
            value={centsStr(today.netNewMrrCents)}
            sub="approx from plan prices"
            accent={
              today.netNewMrrCents > 0
                ? 'green'
                : today.netNewMrrCents < 0
                  ? 'red'
                  : undefined
            }
          />
        </Section>

        {/* LAST 30 DAYS */}
        <Section title="Last 30 days">
          <Tile
            title="Applications submitted"
            value={last30.appsSubmitted}
            sub={`of ${last30.appsTotal} total · ${pctStr(last30.submissionSuccessRate)} success`}
            accent={
              last30.submissionSuccessRate !== null && last30.submissionSuccessRate < 2
                ? 'red'
                : undefined
            }
          />
          <Tile
            title="Interview rate"
            value={interviewRate}
            sub={`target ≥10% · ${last30.appsWithInterview} interview-status apps`}
            accent={interviewAccent}
          />
          <Tile
            title="Apps marked 'Got Job' (offer)"
            value={last30.appsMarkedGotJob}
            accent={last30.appsMarkedGotJob > 0 ? 'green' : undefined}
          />
          <Tile
            title="Cancellations (refund rate)"
            value={`${last30.refundsIssued} (${pctStr(last30.refundRate)})`}
            accent={
              last30.refundRate !== null && last30.refundRate > 15 ? 'red' : undefined
            }
          />
        </Section>

        {/* COHORT RETENTION */}
        <Section title="Cohort retention">
          {cohort.map((c) => (
            <Tile
              key={c.days}
              title={`Still subscribed at D${c.days}`}
              value={c.retentionRate !== null ? `${c.retentionRate}%` : '—'}
              sub={
                c.cohortSize > 0
                  ? `${c.stillSubscribed} of ${c.cohortSize} from that cohort`
                  : 'No paid users joined ~' + c.days + ' days ago'
              }
              accent={
                c.retentionRate === null
                  ? undefined
                  : c.days === 30 && c.retentionRate >= 85
                    ? 'green'
                    : c.days === 30 && c.retentionRate < 70
                      ? 'red'
                      : c.days === 60 && c.retentionRate >= 65
                        ? 'green'
                        : c.days === 60 && c.retentionRate < 50
                          ? 'red'
                          : c.days === 90 && c.retentionRate >= 40
                            ? 'green'
                            : c.days === 90 && c.retentionRate < 25
                              ? 'red'
                              : undefined
              }
            />
          ))}
        </Section>

        {/* REFERRAL LOOP */}
        <Section title="Referral loop">
          <Tile
            title="Got-a-job exits this month"
            value={referral.gotJobExitsThisMonth}
            accent={referral.gotJobExitsThisMonth > 0 ? 'green' : undefined}
          />
          <Tile
            title="Referral signups from them"
            value={
              referral.referralCoefficient !== null
                ? `${referral.referralSignups} (×${referral.referralCoefficient.toFixed(2)})`
                : '— (tracking not active)'
            }
          />
        </Section>

        {/* EXIT REASON HISTOGRAM */}
        {exitReasons.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Why people leave (last 30 days)
            </h2>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              {exitReasons.map((r) => (
                <div key={r.reason} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="w-48 truncate font-medium">{r.label}</span>
                  <div className="flex-1">
                    <div
                      className="h-4 rounded bg-primary/20"
                      style={{
                        width: `${Math.round(
                          (r.count / exitReasons.reduce((s, x) => s + x.count, 0)) * 100
                        )}%`,
                        minWidth: '4px',
                      }}
                    />
                  </div>
                  <span className="w-6 text-right tabular-nums text-muted-foreground">
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PMF status summary */}
        <section className="rounded-lg border border-dashed bg-muted/30 px-6 py-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">PMF criteria (all three for 60 days)</p>
          <ul className="space-y-0.5">
            <li>Interview rate ≥ 10% per paying user</li>
            <li>D30 retention ≥ 70% · D90 ≥ 40%</li>
            <li>Referral coefficient ≥ 0.5</li>
          </ul>
          <p className="mt-2 text-xs">
            Source: <code>docs/PMF_FRAMEWORK.md</code>
          </p>
        </section>
      </main>
    </div>
  )
}
