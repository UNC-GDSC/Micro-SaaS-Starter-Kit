/**
 * lib/billing/email-refund-confirmation.ts
 *
 * Sends a refund confirmation email via Resend.
 * Deliberately thin — just constructs HTML and delegates to the shared sendEmail helper.
 */
import { sendEmail } from '@/lib/email'

interface RefundConfirmationOptions {
  to: string
  name: string | null | undefined
  /** Amount in the smallest currency unit (cents for USD). */
  amountCents: number
  currency: string
}

export async function sendRefundConfirmationEmail({
  to,
  name,
  amountCents,
  currency,
}: RefundConfirmationOptions) {
  const displayName = name ?? 'there'
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100)

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'ResumeAI'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://resumeai-bot.ru'

  const subject = `Your refund of ${formattedAmount} is on the way`
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
      <h2 style="color:#111">Refund confirmed ✓</h2>
      <p>Hi ${displayName},</p>
      <p>
        We&rsquo;ve processed a full refund of <strong>${formattedAmount}</strong> to your
        original payment method. Bank processing typically takes <strong>5&ndash;10 business days</strong>
        to appear on your statement.
      </p>
      <p>
        Your subscription has been cancelled immediately. You can re-subscribe at any time —
        the refund guarantee applies to your first purchase only.
      </p>
      <p>
        We&rsquo;re sorry ${appName} wasn&rsquo;t the right fit. If you&rsquo;d like to share
        feedback or got a job and want to tell us about it, just reply to this email.
      </p>
      <a href="${appUrl}/pricing"
         style="display:inline-block;padding:12px 24px;background:#000;color:#fff;
                text-decoration:none;border-radius:6px;margin:16px 0">
        View plans
      </a>
      <p style="color:#666;font-size:13px">
        If you did not request this refund, please contact us immediately at
        <a href="mailto:support@resumeai-bot.ru">support@resumeai-bot.ru</a>.
      </p>
      <p>Best regards,<br>The ${appName} Team</p>
    </div>
  `

  return sendEmail({ to, subject, html })
}
