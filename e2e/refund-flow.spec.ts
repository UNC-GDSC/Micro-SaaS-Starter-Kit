/**
 * e2e/refund-flow.spec.ts
 *
 * Playwright end-to-end tests for the 30-day money-back guarantee flow.
 *
 * Prerequisites (set in .env.test.local or CI secrets):
 *   E2E_BASE_URL        — app URL (default: http://localhost:3000)
 *   E2E_USER_EMAIL      — test user email
 *   E2E_USER_PASSWORD   — test user password (if credentials auth is enabled)
 *
 * The tests mock /api/billing/refund so no real Stripe calls are made.
 */
import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function mockSessionWithSubscription(page: Page) {
  // Intercept next-auth session to return a paying user within the 30-day window
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'user-e2e-001',
          name: 'Test User',
          email: 'test@example.com',
          stripeSubscriptionId: 'sub_e2e_001',
          stripeCurrentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
          // firstPaidAt 5 days ago — well within 30-day window
          firstPaidAt: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
        },
        expires: new Date(Date.now() + 3600 * 1000).toISOString(),
      }),
    })
  )
}

async function mockRefundApiSuccess(page: Page) {
  await page.route('**/api/billing/refund', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, amountCents: 1999, currency: 'usd' }),
    })
  )
}

async function mockRefundApiError(page: Page, reason: string, message: string) {
  await page.route('**/api/billing/refund', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: message, reason }),
    })
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('30-day money-back guarantee — billing page', () => {
  test.beforeEach(async ({ page }) => {
    await mockSessionWithSubscription(page)
    await page.goto(`${BASE_URL}/dashboard/billing`)
  })

  test('shows guarantee banner with days-remaining counter', async ({ page }) => {
    await expect(page.getByText('30-day money-back guarantee')).toBeVisible()
    await expect(page.getByText(/days left to claim/)).toBeVisible()
  })

  test('shows "Cancel & request refund" button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /cancel & request refund/i })).toBeVisible()
  })

  test('opens refund confirmation dialog on button click', async ({ page }) => {
    await page.getByRole('button', { name: /cancel & request refund/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Claim your 30-day refund')).toBeVisible()
  })

  test('closes refund dialog when "Go back" is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /cancel & request refund/i }).click()
    await page.getByRole('button', { name: /go back/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('processes refund successfully and shows confirmation', async ({ page }) => {
    await mockRefundApiSuccess(page)
    await page.getByRole('button', { name: /cancel & request refund/i }).click()
    await page.getByRole('button', { name: /confirm refund/i }).click()

    // Success banner should appear; dialog should close
    await expect(page.getByText(/refund has been processed/i)).toBeVisible()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('shows error message when refund API returns 422', async ({ page }) => {
    await mockRefundApiError(
      page,
      'outside_30_day_window',
      'Your 30-day money-back window has passed.'
    )
    await page.getByRole('button', { name: /cancel & request refund/i }).click()
    await page.getByRole('button', { name: /confirm refund/i }).click()

    await expect(page.getByText(/30-day money-back window has passed/i)).toBeVisible()
    // Dialog stays open so user can read the error
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

test.describe('Pricing page — guarantee banner', () => {
  test('shows 30-day guarantee banner above pricing cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`)
    await expect(page.getByText('30-day money-back guarantee')).toBeVisible()
    await expect(page.getByRole('link', { name: /see policy/i })).toBeVisible()
  })

  test('guarantee banner links to /refund-policy', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`)
    const link = page.getByRole('link', { name: /see policy/i })
    await expect(link).toHaveAttribute('href', '/refund-policy')
  })

  test('pricing page no longer shows Trial card', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`)
    await expect(page.getByText('Trial')).not.toBeVisible()
  })
})

test.describe('Refund policy page', () => {
  test('loads and shows key policy sections', async ({ page }) => {
    await page.goto(`${BASE_URL}/refund-policy`)
    await expect(page.getByRole('heading', { name: /refund policy/i })).toBeVisible()
    await expect(page.getByText('30-day money-back guarantee')).toBeVisible()
    await expect(page.getByText('Conditions')).toBeVisible()
    await expect(page.getByText('one refund per customer')).toBeVisible()
  })
})
