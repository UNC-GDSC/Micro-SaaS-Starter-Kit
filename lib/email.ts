import { Resend } from 'resend'

// Lazy singleton — avoids throwing at module-load time when RESEND_API_KEY
// is not set (e.g. during Next.js build-time static analysis or CI).
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

interface EmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  const resend = getResend()
  try {
    const data = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to,
      subject,
      html,
    })

    return { success: true, data }
  } catch (error) {
    console.error('Failed to send email:', error)
    return { success: false, error }
  }
}

export async function sendWelcomeEmail(to: string, name: string) {
  const subject = `Welcome to ${process.env.NEXT_PUBLIC_APP_NAME}!`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Welcome to ${process.env.NEXT_PUBLIC_APP_NAME}!</h1>
      <p>Hi ${name},</p>
      <p>Thank you for signing up! We're excited to have you on board.</p>
      <p>To get started, visit your dashboard and explore all the features we have to offer.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
         style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; margin: 20px 0;">
        Go to Dashboard
      </a>
      <p>If you have any questions, feel free to reply to this email.</p>
      <p>Best regards,<br>The ${process.env.NEXT_PUBLIC_APP_NAME} Team</p>
    </div>
  `

  return sendEmail({ to, subject, html })
}

export async function sendSubscriptionConfirmation(to: string, planName: string) {
  const subject = 'Subscription Confirmed!'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Subscription Confirmed! 🎉</h1>
      <p>Your ${planName} subscription is now active.</p>
      <p>You now have access to all the premium features included in your plan.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
         style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; margin: 20px 0;">
        View Dashboard
      </a>
      <p>Thank you for your business!</p>
      <p>Best regards,<br>The ${process.env.NEXT_PUBLIC_APP_NAME} Team</p>
    </div>
  `

  return sendEmail({ to, subject, html })
}

export async function sendSubscriptionCancellation(to: string) {
  const subject = 'Subscription Cancelled'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Subscription Cancelled</h1>
      <p>Your subscription has been cancelled.</p>
      <p>You'll continue to have access to your current plan until the end of your billing period.</p>
      <p>We're sorry to see you go! If you have any feedback, we'd love to hear it.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/pricing"
         style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; margin: 20px 0;">
        View Plans
      </a>
      <p>Best regards,<br>The ${process.env.NEXT_PUBLIC_APP_NAME} Team</p>
    </div>
  `

  return sendEmail({ to, subject, html })
}
