import { Navbar } from '@/components/navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const faqs = [
  {
    question: 'How do I get started?',
    answer:
      'Simply sign up with your Google or GitHub account, choose a plan that fits your needs, and start using the platform immediately.',
  },
  {
    question: 'Can I change my plan later?',
    answer:
      'Yes! You can upgrade or downgrade your plan at any time from your account settings. Changes will be prorated automatically.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards through Stripe, including Visa, Mastercard, American Express, and Discover.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'Yes, all paid plans include a 14-day free trial. You can cancel at any time during the trial period without being charged.',
  },
  {
    question: 'How do I cancel my subscription?',
    answer:
      'You can cancel your subscription at any time from your account settings. Click on "Manage Subscription" to access the billing portal.',
  },
  {
    question: 'What happens to my data if I cancel?',
    answer:
      'Your data will be retained for 30 days after cancellation. You can reactivate your account during this period to restore access.',
  },
  {
    question: 'Do you offer refunds?',
    answer:
      'We offer a 30-day money-back guarantee. If you\'re not satisfied with our service, contact us for a full refund.',
  },
  {
    question: 'How secure is my data?',
    answer:
      'We take security seriously. All data is encrypted in transit and at rest. We use industry-standard security practices and regularly audit our systems.',
  },
  {
    question: 'Can I use the API?',
    answer:
      'Yes! All paid plans include API access. You can generate API keys from your dashboard to integrate with our platform programmatically.',
  },
  {
    question: 'Do you offer support?',
    answer:
      'Yes, we offer email support for all users. Pro and Enterprise plans include priority support with faster response times.',
  },
]

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
            <p className="text-lg text-gray-500">
              Find answers to common questions about our service
            </p>
          </div>

          <div className="grid gap-6">
            {faqs.map((faq, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-12">
            <CardHeader>
              <CardTitle>Still have questions?</CardTitle>
              <CardDescription>
                Can&apos;t find the answer you&apos;re looking for? Contact our support team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Email us at{' '}
                <a href="mailto:support@example.com" className="text-primary underline">
                  support@example.com
                </a>{' '}
                and we&apos;ll get back to you as soon as possible.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
