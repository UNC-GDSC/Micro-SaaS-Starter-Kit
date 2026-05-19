import { Navbar } from '@/components/navbar'

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <h1 className="mb-8 text-4xl font-bold">Terms of Service</h1>

          <div className="prose prose-gray max-w-none">
            <p className="text-lg text-gray-600">Last updated: January 2024</p>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using this service, you accept and agree to be bound by the terms
                and provision of this agreement.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">2. Use License</h2>
              <p>
                Permission is granted to temporarily download one copy of the materials on our
                service for personal, non-commercial transitory viewing only.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">3. Disclaimer</h2>
              <p>
                The materials on our service are provided on an &apos;as is&apos; basis. We make no
                warranties, expressed or implied, and hereby disclaim and negate all other
                warranties including, without limitation, implied warranties or conditions of
                merchantability, fitness for a particular purpose, or non-infringement of
                intellectual property or other violation of rights.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">4. Limitations</h2>
              <p>
                In no event shall our company or its suppliers be liable for any damages (including,
                without limitation, damages for loss of data or profit, or due to business
                interruption) arising out of the use or inability to use our service.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">5. Revisions</h2>
              <p>
                We may revise these terms of service at any time without notice. By using this
                service you are agreeing to be bound by the then current version of these terms of
                service.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">6. Subscription and Billing</h2>
              <p>
                All subscriptions are billed automatically on a recurring basis. You can cancel your
                subscription at any time through your account settings or by contacting support.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
