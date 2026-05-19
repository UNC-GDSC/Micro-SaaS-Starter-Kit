/**
 * Daily Digest email template using React Email.
 *
 * Previewed at https://react.email/preview when run locally.
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import type { DigestApplication } from '@/lib/notifications/digest'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyDigestEmailProps {
  userName: string | null
  applicationsCount: number
  repliesCount: number
  applications: DigestApplication[]
  newReplies: DigestApplication[]
  periodStart: Date
  unsubscribeUrl: string
  dashboardUrl: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    QUEUED: 'Queued',
    SUBMITTED: 'Submitted',
    FAILED: 'Failed',
    INTERVIEW: 'Interview',
    REJECTED: 'Rejected',
    OFFER: 'Offer',
    WITHDRAWN: 'Withdrawn',
  }
  return map[status] ?? status
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ApplicationRow({ app }: { app: DigestApplication }) {
  return (
    <tr>
      <td style={td}>{app.jobTitle}</td>
      <td style={td}>{app.company}</td>
      <td style={{ ...td, color: '#6b7280' }}>{formatDate(app.appliedAt)}</td>
    </tr>
  )
}

function ReplyRow({ app }: { app: DigestApplication }) {
  return (
    <tr>
      <td style={td}>{app.jobTitle}</td>
      <td style={td}>{app.company}</td>
      <td style={{ ...td, color: statusColor(app.status) }}>{statusLabel(app.status)}</td>
    </tr>
  )
}

function statusColor(status: string): string {
  if (status === 'INTERVIEW' || status === 'OFFER') return '#16a34a'
  if (status === 'REJECTED') return '#dc2626'
  return '#6b7280'
}

// ---------------------------------------------------------------------------
// Main template
// ---------------------------------------------------------------------------

export default function DailyDigestEmail({
  userName,
  applicationsCount,
  repliesCount,
  applications,
  newReplies,
  periodStart,
  unsubscribeUrl,
  dashboardUrl,
}: DailyDigestEmailProps) {
  const greeting = userName ? `Hi ${userName.split(' ')[0]},` : 'Hi,'
  const dateLabel = formatDate(periodStart)
  const previewText = `Your ResumeAI activity for ${dateLabel}: ${applicationsCount} application${applicationsCount !== 1 ? 's' : ''} sent${repliesCount > 0 ? `, ${repliesCount} new repl${repliesCount !== 1 ? 'ies' : 'y'}` : ''}.`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Heading style={h1}>Your daily job-search update</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Here&apos;s what happened with your job applications on{' '}
            <strong>{dateLabel}</strong>:
          </Text>

          {/* Stats row */}
          <Section style={statsRow}>
            <table width="100%" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={statCell}>
                    <div style={statNumber}>{applicationsCount}</div>
                    <div style={statLabel}>application{applicationsCount !== 1 ? 's' : ''} sent</div>
                  </td>
                  <td style={statCell}>
                    <div style={statNumber}>{repliesCount}</div>
                    <div style={statLabel}>recruiter repl{repliesCount !== 1 ? 'ies' : 'y'}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Applications table */}
          {applications.length > 0 && (
            <Section>
              <Heading as="h2" style={h2}>Applications sent</Heading>
              <table width="100%" style={table}>
                <thead>
                  <tr>
                    <th style={th}>Role</th>
                    <th style={th}>Company</th>
                    <th style={th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <ApplicationRow key={app.id} app={app} />
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Recruiter replies table */}
          {newReplies.length > 0 && (
            <Section>
              <Heading as="h2" style={h2}>Recruiter activity</Heading>
              <table width="100%" style={table}>
                <thead>
                  <tr>
                    <th style={th}>Role</th>
                    <th style={th}>Company</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {newReplies.map((app) => (
                    <ReplyRow key={app.id} app={app} />
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          <Hr style={hr} />

          {/* CTA */}
          <Section style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
            <Button href={dashboardUrl} style={button}>
              View dashboard
            </Button>
          </Section>

          {/* Footer */}
          <Text style={footer}>
            You&apos;re receiving this because you have a ResumeAI subscription.{' '}
            <Link href={unsubscribeUrl} style={footerLink}>
              Unsubscribe from daily digests
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const body: React.CSSProperties = {
  backgroundColor: '#f9fafb',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  maxWidth: '600px',
  margin: '40px auto',
  padding: '32px 40px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
}

const h1: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: '700',
  color: '#111827',
  marginBottom: '16px',
}

const h2: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: '600',
  color: '#374151',
  marginTop: '24px',
  marginBottom: '8px',
}

const text: React.CSSProperties = {
  fontSize: '15px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '8px 0',
}

const statsRow: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  padding: '16px',
  margin: '20px 0',
}

const statCell: React.CSSProperties = {
  textAlign: 'center' as const,
  padding: '4px 16px',
}

const statNumber: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: '800',
  color: '#111827',
  lineHeight: '1',
}

const statLabel: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  marginTop: '4px',
}

const table: React.CSSProperties = {
  borderCollapse: 'collapse' as const,
  width: '100%',
  fontSize: '14px',
}

const th: React.CSSProperties = {
  textAlign: 'left' as const,
  padding: '6px 8px',
  borderBottom: '2px solid #e5e7eb',
  fontSize: '12px',
  fontWeight: '600',
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

const td: React.CSSProperties = {
  padding: '8px 8px',
  borderBottom: '1px solid #f3f4f6',
  color: '#374151',
}

const hr: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#111827',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '12px 24px',
  borderRadius: '6px',
}

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#9ca3af',
  textAlign: 'center' as const,
  marginTop: '16px',
}

const footerLink: React.CSSProperties = {
  color: '#9ca3af',
  textDecoration: 'underline',
}
