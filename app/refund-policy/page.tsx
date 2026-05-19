import { Navbar } from '@/components/navbar'

export const metadata = {
  title: 'Refund Policy — ResumeAI',
  description: '30-day money-back guarantee. If ResumeAI doesn\'t help you land interviews, get a full refund — no questions asked.',
}

export default function RefundPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold mb-2">Refund Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: May 2026</p>

        <section className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-[15px] leading-relaxed">

          <div>
            <h2 className="text-xl font-semibold mb-3">30-day money-back guarantee</h2>
            <p>
              We offer a full, no-questions-asked refund within <strong>30 days</strong> of your
              first payment. If you subscribed to a paid plan and ResumeAI didn&apos;t help you get
              interviews, contact us or use the self-serve button in your Billing settings and we
              will refund 100&nbsp;% of your first month&apos;s payment immediately.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">How to request a refund</h2>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Go to <strong>Dashboard → Billing → Cancel &amp; request refund</strong> — the
                button appears automatically if you are within the 30-day window.
              </li>
              <li>
                Your subscription is cancelled immediately and the refund is processed via Stripe.
              </li>
              <li>
                You will receive a confirmation email. The amount typically appears on your bank
                statement within <strong>5–10 business days</strong>, depending on your card issuer.
              </li>
            </ol>
            <p className="mt-3">
              Prefer to reach us by email? Write to{' '}
              <a
                href="mailto:support@resumeai-bot.ru"
                className="underline underline-offset-2 hover:text-foreground"
              >
                support@resumeai-bot.ru
              </a>{' '}
              with the subject line &ldquo;Refund request&rdquo;.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">Conditions &amp; limitations</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>The guarantee covers <strong>one refund per customer</strong>.</li>
              <li>
                Refunds apply to your <strong>first subscription payment only</strong>. Renewal
                charges are non-refundable unless required by applicable law.
              </li>
              <li>
                The request must be made within <strong>30 calendar days</strong> of the date of
                your first payment. Requests received after this window cannot be processed under
                this policy.
              </li>
              <li>Annual plan refunds are prorated to the unused portion per applicable law.</li>
              <li>
                We reserve the right to decline refund requests where abuse of the policy is
                suspected (e.g., repeated subscribe-and-refund behaviour across multiple accounts).
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">Renewals</h2>
            <p>
              Monthly subscriptions renew automatically on the same day each month. You may cancel
              at any time from Billing settings; your access continues until the end of the paid
              period. Renewal charges are non-refundable.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">Applicable law</h2>
            <p>
              Nothing in this policy limits rights you may have under applicable consumer protection
              laws, including EU/UK statutory cooling-off rights where they apply.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">Questions</h2>
            <p>
              Email{' '}
              <a
                href="mailto:support@resumeai-bot.ru"
                className="underline underline-offset-2 hover:text-foreground"
              >
                support@resumeai-bot.ru
              </a>{' '}
              — we respond within one business day.
            </p>
          </div>

        </section>
      </main>
    </div>
  )
}
