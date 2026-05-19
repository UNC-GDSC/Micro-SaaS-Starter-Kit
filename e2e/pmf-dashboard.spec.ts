import { test, expect } from '@playwright/test'

/**
 * PMF dashboard E2E tests.
 * These tests run against the running dev/preview server.
 *
 * Requires env vars:
 *   ADMIN_EMAIL     - email of an admin user seeded in test DB
 *   ADMIN_PASSWORD  - (not used with OAuth; skip login flow in CI)
 *
 * Non-admin and unauthenticated access is tested via direct URL navigation.
 */

test.describe('PMF dashboard — /admin/pmf', () => {
  test('redirects unauthenticated users to dashboard (not 200)', async ({ page }) => {
    const res = await page.goto('/admin/pmf')
    // Should be redirected — final URL must not be /admin/pmf
    expect(page.url()).not.toContain('/admin/pmf')
    // Acceptable final destinations: /login or /dashboard
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })

  test('shows all metric sections when logged in as admin', async ({ page, context }) => {
    // Inject a session cookie if PLAYWRIGHT_SESSION_COOKIE is set (set by CI seeding)
    const sessionCookie = process.env.PLAYWRIGHT_SESSION_COOKIE
    if (!sessionCookie) {
      test.skip()
      return
    }
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: sessionCookie,
        domain: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').hostname,
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ])

    await page.goto('/admin/pmf')
    await expect(page).toHaveURL(/\/admin\/pmf/)

    // All four section headings should be visible
    await expect(page.getByText('Today', { exact: false })).toBeVisible()
    await expect(page.getByText('Last 30 days', { exact: false })).toBeVisible()
    await expect(page.getByText('Cohort retention', { exact: false })).toBeVisible()
    await expect(page.getByText('Referral loop', { exact: false })).toBeVisible()

    // Metric tiles render (zero values are fine in empty test DB)
    await expect(page.getByText('New free signups')).toBeVisible()
    await expect(page.getByText('Interview rate')).toBeVisible()
    await expect(page.getByText(/Still subscribed at D30/)).toBeVisible()
  })
})

test.describe('Day-30 survey modal', () => {
  test('modal appears for a user with a pending survey', async ({ page, context }) => {
    const surveySessionCookie = process.env.PLAYWRIGHT_SURVEY_SESSION_COOKIE
    if (!surveySessionCookie) {
      test.skip()
      return
    }
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: surveySessionCookie,
        domain: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').hostname,
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ])

    await page.goto('/dashboard')

    // Modal should appear after the 800ms delay
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 3000 })
    await expect(modal.getByText(/interview requests/i)).toBeVisible()

    // All three answer buttons present
    await expect(page.getByRole('button', { name: 'Yes!' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'No' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Not sure' })).toBeVisible()

    // Dismiss closes modal
    await page.getByLabel('Dismiss survey').click()
    await expect(modal).not.toBeVisible()
  })

  test('submitting an answer closes the modal', async ({ page, context }) => {
    const surveySessionCookie = process.env.PLAYWRIGHT_SURVEY_SESSION_COOKIE
    if (!surveySessionCookie) {
      test.skip()
      return
    }
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: surveySessionCookie,
        domain: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').hostname,
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ])

    await page.goto('/dashboard')
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: 'No' }).click()
    await page.getByRole('button', { name: 'Submit' }).click()

    await expect(modal).not.toBeVisible({ timeout: 3000 })
  })
})
