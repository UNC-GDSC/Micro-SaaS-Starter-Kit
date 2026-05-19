import { Navbar } from '@/components/navbar'
import { PricingCards } from '@/components/pricing-cards'

export const metadata = {
  title: 'Pricing — ResumeAI',
  description: 'Simple, transparent pricing with a 30-day money-back guarantee. No risk.',
}

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="mb-12 text-center">
              <h1 className="mb-4 text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                Simple, Transparent Pricing
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                Start free. Upgrade when you need more applications.
              </p>
            </div>

            {/* 30-day money-back guarantee banner */}
            <div className="mx-auto mb-10 flex max-w-2xl items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4 dark:border-green-800 dark:bg-green-950">
              <span className="text-2xl" aria-hidden="true">🛡️</span>
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">
                  30-day money-back guarantee
                </p>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Not getting interviews? Get a full refund within 30 days — no questions asked.{' '}
                  <a href="/refund-policy" className="underline underline-offset-2 hover:opacity-80">
                    See policy →
                  </a>
                </p>
              </div>
            </div>

            <PricingCards />
          </div>
        </section>
      </main>
    </div>
  )
}
