import { Navbar } from '@/components/navbar'

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <h1 className="mb-8 text-4xl font-bold">Privacy Policy</h1>

          <div className="prose prose-gray max-w-none">
            <p className="text-lg text-gray-600">Last updated: January 2024</p>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
              <p>
                We collect information you provide directly to us when you create an account,
                including your name, email address, and payment information through our payment
                processor Stripe.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>To provide, maintain, and improve our services</li>
                <li>To process transactions and send related information</li>
                <li>To send technical notices and support messages</li>
                <li>To respond to your comments and questions</li>
                <li>To monitor and analyze trends, usage, and activities</li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">3. Information Sharing</h2>
              <p>
                We do not share your personal information with third parties except as described in
                this policy. We may share information with:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Service providers who perform services on our behalf (e.g., Stripe for payment processing)</li>
                <li>Law enforcement when required by law</li>
                <li>Other parties with your consent</li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
              <p>
                We take reasonable measures to help protect your personal information from loss,
                theft, misuse, unauthorized access, disclosure, alteration, and destruction.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
              <p>
                You have the right to access, update, or delete your personal information at any
                time through your account settings. You may also contact us to exercise these rights.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">6. Cookies</h2>
              <p>
                We use cookies and similar tracking technologies to track activity on our service
                and hold certain information. You can instruct your browser to refuse all cookies or
                to indicate when a cookie is being sent.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">7. Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. We will notify you of any
                changes by posting the new privacy policy on this page and updating the &quot;Last
                updated&quot; date.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold mb-4">8. Contact Us</h2>
              <p>
                If you have any questions about this privacy policy, please contact us through your
                account settings or by email.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
