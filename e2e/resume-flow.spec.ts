import { test, expect } from '@playwright/test'

test('homepage has hero heading and CTA', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /land your next job faster/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /start free/i })).toBeVisible()
})

test('Start free → redirects to /login', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: /start free/i }).click()

  await expect(page).toHaveURL(/\/login/)
})

test('login page has Google and GitHub sign-in buttons', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /continue with github/i })).toBeVisible()
})

test('pricing section is visible on homepage', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /simple, transparent pricing/i })).toBeVisible()
  // All four plan names should appear
  await expect(page.getByText('Free')).toBeVisible()
  await expect(page.getByText('Trial')).toBeVisible()
  await expect(page.getByText('Pro')).toBeVisible()
  await expect(page.getByText('Unlimited')).toBeVisible()
})

test('dashboard redirects unauthenticated users to /login', async ({ page }) => {
  await page.goto('/dashboard')
  // Next.js server redirect should land on login
  await expect(page).toHaveURL(/\/login/)
})
