import { test, expect } from '@playwright/test'

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/ResumeAI/)

  const heading = page.getByRole('heading', {
    name: /Launch Your SaaS/i,
  })
  await expect(heading).toBeVisible()
})

test('pricing page displays plans', async ({ page }) => {
  await page.goto('/pricing')

  const heading = page.getByRole('heading', {
    name: /Simple, Transparent Pricing/i,
  })
  await expect(heading).toBeVisible()

  // Check that at least one pricing card is visible
  await expect(page.locator('text=Free')).toBeVisible()
})

test('login page loads', async ({ page }) => {
  await page.goto('/login')

  const heading = page.getByRole('heading', {
    name: /Welcome back/i,
  })
  await expect(heading).toBeVisible()

  // Check OAuth buttons are present
  await expect(page.locator('text=Continue with Google')).toBeVisible()
  await expect(page.locator('text=Continue with GitHub')).toBeVisible()
})
