import Link from 'next/link'
import { PRICING_PLANS } from '@/lib/pricing'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-emerald-600">
            ResumeAI
          </Link>
          <div className="flex items-center gap-6">
            <Link href="#pricing" className="text-sm text-slate-600 hover:text-slate-900">
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Land your next job faster
        </h1>
        <p className="mt-6 max-w-2xl text-xl text-slate-500">
          AI-powered resume tailoring and auto-apply — built for serious job seekers. Let ResumeAI
          handle the applications while you focus on interviews.
        </p>
        <div className="mt-10">
          <Link
            href="/login"
            className="rounded-lg bg-emerald-600 px-8 py-3 text-lg font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Start free &rarr;
          </Link>
        </div>
      </section>

      {/* 3-step flow */}
      <section className="bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-slate-900">How it works</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Build your resume',
                description:
                  'Answer a few questions about your experience and goals. Our AI crafts a tailored, ATS-optimised resume in seconds.',
              },
              {
                step: '2',
                title: 'Set up a campaign',
                description:
                  'Choose job boards, set keywords, locations, and daily limits. We apply to matching roles automatically on your behalf.',
              },
              {
                step: '3',
                title: 'Track & respond',
                description:
                  'Monitor every application in your dashboard. Get notified when recruiters respond and manage interviews in one place.',
              },
            ].map(({ step, title, description }) => (
              <div
                key={step}
                className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">
                  {step}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-3xl font-bold text-slate-900">
            Simple, transparent pricing
          </h2>
          <p className="mb-12 text-center text-slate-500">
            Start for free. Upgrade when you need more power.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl border p-6 ${
                  plan.id === 'pro'
                    ? 'border-emerald-500 bg-emerald-50 shadow-md'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {plan.id === 'pro' && (
                  <div className="mb-3 inline-block rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                    Most popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-3xl font-bold text-slate-900">
                    {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  </span>
                  {plan.period && (
                    <span className="mb-1 text-sm text-slate-500">/ {plan.period}</span>
                  )}
                </div>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="text-emerald-500">&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`mt-6 block w-full rounded-lg px-4 py-2 text-center text-sm font-semibold transition-colors ${
                    plan.id === 'pro'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50 px-4 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-sm text-slate-500 sm:flex-row sm:justify-between">
          <span>&copy; {new Date().getFullYear()} ResumeAI. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-slate-900">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-slate-900">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
