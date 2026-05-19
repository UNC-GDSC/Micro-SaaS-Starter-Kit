/**
 * Admin email gate for /admin/pmf route.
 * Reads ADMIN_EMAILS env var (comma-separated list of email addresses).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(email.toLowerCase())
}
