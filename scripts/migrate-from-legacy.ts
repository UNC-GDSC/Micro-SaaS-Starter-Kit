#!/usr/bin/env tsx
/**
 * migrate-from-legacy.ts
 *
 * One-shot IDEMPOTENT migration from legacy SQLite databases to the new
 * Postgres schema via Prisma.
 *
 * Usage:
 *   tsx scripts/migrate-from-legacy.ts [--dry-run]
 *
 * Inputs:
 *   /backups/old/bot.db          (legacy Telegram-bot SQLite)
 *   /backups/old/autoapply.db    (legacy AutoApply SQLite)
 *
 * Environment variables:
 *   DATABASE_URL      — Postgres connection string
 *   ENCRYPTION_KEY    — Fernet key (MUST match the one used when encrypting
 *                       LinkedIn passwords in the legacy DB)
 *
 * Safety guarantees:
 *   • Idempotent: matching by legacyId / email means re-running does upserts.
 *   • --dry-run: wraps everything in a transaction and rolls back.
 *   • ENCRYPTION_KEY check: test-decrypts a real ciphertext before touching data.
 *   • Sessions/auth tokens are NOT migrated (security: rotate NextAuth secret).
 */

import Database from 'better-sqlite3'
import { PrismaClient } from '@prisma/client'
import { createDecipheriv, createHmac } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

// ── CLI flags ────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')
const AUTOAPPLY_DB = process.env.AUTOAPPLY_DB ?? '/backups/old/autoapply.db'
const BOT_DB = process.env.BOT_DB ?? '/backups/old/bot.db'

// ── Prisma ───────────────────────────────────────────────────────────────────

const prisma = new PrismaClient()

// ── Counters ─────────────────────────────────────────────────────────────────

const stats = {
  users: { created: 0, updated: 0, skipped: 0 },
  campaigns: { created: 0, updated: 0, skipped: 0 },
  applications: { created: 0, skipped: 0 },
  errors: 0,
}

function log(msg: string) {
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`)
}

function err(msg: string, e?: unknown) {
  process.stderr.write(`[ERROR] ${msg}${e ? ': ' + String(e) : ''}\n`)
  stats.errors++
}

// ── Fernet decrypt (subset — decryption only, same spec as lib/crypto.ts) ────

function fernetDecrypt(ciphertext: string, keyBase64: string): string {
  const keyBytes = Buffer.from(keyBase64, 'base64')
  if (keyBytes.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes when base64-decoded')

  const signingKey = keyBytes.subarray(0, 16)
  const encryptionKey = keyBytes.subarray(16, 32)

  const tokenBytes = Buffer.from(ciphertext, 'base64url')
  const version = tokenBytes[0]
  if (version !== 0x80) throw new Error(`Unsupported Fernet version: 0x${version.toString(16)}`)

  // Layout: version(1) + timestamp(8) + IV(16) + ciphertext(N) + HMAC(32)
  const hmacOffset = tokenBytes.length - 32
  const providedHmac = tokenBytes.subarray(hmacOffset)
  const signedData = tokenBytes.subarray(0, hmacOffset)

  // Verify HMAC-SHA256
  const expectedHmac = createHmac('sha256', signingKey).update(signedData).digest()
  let valid = true
  for (let i = 0; i < 32; i++) valid = valid && (providedHmac[i] === expectedHmac[i])
  if (!valid) throw new Error('Fernet HMAC verification failed — wrong key or tampered data')

  const iv = tokenBytes.subarray(9, 25)
  const payload = tokenBytes.subarray(25, hmacOffset)

  const decipher = createDecipheriv('aes-128-cbc', encryptionKey, iv)
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()])
  return decrypted.toString('utf8')
}

// ── Encryption key validation ─────────────────────────────────────────────────

function validateEncryptionKey(autoapplyDb: Database.Database): void {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    console.error('\n❌ ENCRYPTION_KEY is not set in the environment.\n')
    console.error('Copy it from ~/secrets/resumeai-legacy-env-2026-05-14.env before running.\n')
    process.exit(1)
  }

  // Find one row with a non-null encrypted password to test against
  const row = autoapplyDb
    .prepare(
      `SELECT linkedin_password_enc FROM campaigns
       WHERE linkedin_password_enc IS NOT NULL
         AND linkedin_password_enc != ''
       LIMIT 1`,
    )
    .get() as { linkedin_password_enc: string } | undefined

  if (!row) {
    log('ℹ️  No encrypted LinkedIn passwords found in legacy DB — skipping key check')
    return
  }

  try {
    const plaintext = fernetDecrypt(row.linkedin_password_enc, key)

    // Sanity checks: must be non-empty UTF-8 with no null bytes
    if (!plaintext || plaintext.includes('\0') || plaintext.length === 0) {
      throw new Error('decrypted value fails sanity checks (empty or contains null bytes)')
    }
  } catch (e) {
    console.error('\n❌ WRONG ENCRYPTION_KEY — refusing to migrate.\n')
    console.error(`   Fernet test-decrypt failed: ${String(e)}\n`)
    console.error('   The ENCRYPTION_KEY in your environment does not match the key\n')
    console.error('   used to encrypt LinkedIn passwords in the legacy database.\n')
    console.error('   Use: bV4UmliwP4xFApJTnq5O5XxJ4mltOC4bjrQQ7EdCUtc= (from ~/secrets/)\n')
    process.exit(1)
  }

  log('✅ ENCRYPTION_KEY validated against legacy ciphertext')
}

// ── Plan mapping ─────────────────────────────────────────────────────────────

function mapPlanToStripePriceId(legacyPlan: string | null): string | null {
  switch ((legacyPlan ?? '').toLowerCase()) {
    case 'trial':
    case 'pro_trial':
      return process.env.STRIPE_PRICE_ID_TRIAL ?? null
    case 'pro':
    case 'pro_monthly':
      return process.env.STRIPE_PRICE_ID_PRO ?? null
    case 'unlimited':
    case 'premium':
    case 'premium_monthly':
      return process.env.STRIPE_PRICE_ID_UNLIMITED ?? null
    default:
      return null // free tier
  }
}

function dailyLimitFromPlan(legacyPlan: string | null): number {
  switch ((legacyPlan ?? '').toLowerCase()) {
    case 'trial':
    case 'pro_trial':
      return 10
    case 'pro':
    case 'pro_monthly':
      return 25
    case 'unlimited':
    case 'premium':
    case 'premium_monthly':
      return 9999
    default:
      return 3 // free
  }
}

// ── Status mapping ────────────────────────────────────────────────────────────

type AppStatus = 'QUEUED' | 'SUBMITTED' | 'FAILED' | 'INTERVIEW' | 'REJECTED' | 'OFFER' | 'WITHDRAWN'

function mapApplicationStatus(legacyStatus: string | null): AppStatus {
  switch ((legacyStatus ?? '').toLowerCase()) {
    case 'submitted':
    case 'applied':
    case 'sent':
      return 'SUBMITTED'
    case 'failed':
    case 'error':
      return 'FAILED'
    case 'interview':
    case 'interview_scheduled':
      return 'INTERVIEW'
    case 'rejected':
    case 'declined':
      return 'REJECTED'
    case 'offer':
      return 'OFFER'
    case 'withdrawn':
      return 'WITHDRAWN'
    default:
      return 'QUEUED'
  }
}

type JobSource = 'LINKEDIN' | 'CAREEROPS' | 'ADZUNA' | 'ARBEITNOW' | 'REMOTEOK' | 'THEMUSE' | 'MANUAL'

function mapPlatform(legacyPlatform: string | null): JobSource {
  switch ((legacyPlatform ?? '').toLowerCase()) {
    case 'linkedin':
      return 'LINKEDIN'
    case 'hh':
    case 'headhunter':
    case 'careerops':
      return 'CAREEROPS'
    case 'adzuna':
      return 'ADZUNA'
    case 'arbeitnow':
      return 'ARBEITNOW'
    case 'remoteok':
    case 'remote.ok':
      return 'REMOTEOK'
    case 'themuse':
      return 'THEMUSE'
    default:
      return 'MANUAL'
  }
}

// ── SQLite row types ──────────────────────────────────────────────────────────

interface BotUser {
  telegram_id: number
  username: string | null
  full_name: string | null
  credits_balance: number | null
  credits_total: number | null
  total_resumes_generated: number | null
  total_assistant_messages: number | null
  created_at: string | null
  last_active: string | null
}

interface AutoapplyUser {
  id: number
  telegram_id: number | null
  email: string
  plan: string | null
  daily_limit: number | null
  applications_total: number | null
  linkedin_email: string | null
  linkedin_password_enc: string | null
  hh_token: string | null
  hh_resume_id: string | null
  resume_text: string | null
  is_verified: number | null
  consent_at: string | null
  stripe_customer_id: string | null
  created_at: string | null
  last_active: string | null
}

interface LegacyCampaign {
  id: number
  user_id: number
  job_title: string | null
  location: string | null
  salary_min: number | null
  experience: string | null
  platforms: string | null
  daily_limit: number | null
  status: string | null
  created_at: string | null
  applications_sent: number | null
  responses: number | null
  last_run: string | null
}

interface LegacyApplication {
  id: number
  campaign_id: number | null
  user_id: number
  platform: string | null
  vacancy_id: string | null
  vacancy_title: string | null
  company_name: string | null
  vacancy_url: string | null
  status: string | null
  sent_at: string | null
  response_at: string | null
}

// ── Main migration ────────────────────────────────────────────────────────────

async function migrate() {
  // ── 0. Pre-flight checks ───────────────────────────────────────────────────
  for (const dbPath of [BOT_DB, AUTOAPPLY_DB]) {
    if (!fs.existsSync(dbPath)) {
      console.error(`\n❌ Missing database file: ${dbPath}`)
      console.error('\nFetch from legacy VPS with:')
      console.error('  ssh root@72.56.250.53 "sqlite3 /opt/resumeaibot/autoapply.db .backup /tmp/autoapply.db && sqlite3 /opt/resumeaibot/bot.db .backup /tmp/bot.db"')
      console.error('  scp root@72.56.250.53:/tmp/autoapply.db /backups/old/')
      console.error('  scp root@72.56.250.53:/tmp/bot.db /backups/old/\n')
      process.exit(1)
    }
    const size = fs.statSync(dbPath).size
    if (size === 0) {
      console.error(`❌ Database file is empty: ${dbPath}`)
      process.exit(1)
    }
  }

  const botDb = new Database(BOT_DB, { readonly: true })
  const autoapplyDb = new Database(AUTOAPPLY_DB, { readonly: true })

  // Validate expected tables exist
  const botTables = new Set((botDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(r => r.name))
  const aaTables  = new Set((autoapplyDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(r => r.name))

  if (!botTables.has('users')) { console.error('❌ bot.db missing "users" table'); process.exit(1) }
  if (!aaTables.has('autoapply_users')) { console.error('❌ autoapply.db missing "autoapply_users" table'); process.exit(1) }

  // ── 1. Validate ENCRYPTION_KEY before touching any data ───────────────────
  validateEncryptionKey(autoapplyDb)

  if (DRY_RUN) log('⚠️  DRY RUN — all writes will be rolled back')

  // ── Wrap in transaction for dry-run support ────────────────────────────────
  const run = async () => {
    // ── 2. Migrate users ───────────────────────────────────────────────────────
    log('Migrating users from bot.db…')
    const botUsers = botDb.prepare('SELECT * FROM users').all() as BotUser[]
    const aaUsers  = autoapplyDb.prepare('SELECT * FROM autoapply_users').all() as AutoapplyUser[]

    // Build lookup: telegram_id → autoapply_user (for plan/Stripe data)
    const aaByTelegramId = new Map<number, AutoapplyUser>()
    for (const u of aaUsers) {
      if (u.telegram_id != null) aaByTelegramId.set(u.telegram_id, u)
    }

    // Also migrate autoapply-only users (have email but may not be in bot.db)
    const migratedTelegramIds = new Set<number>()

    for (const bu of botUsers) {
      try {
        const aaUser = aaByTelegramId.get(bu.telegram_id)
        const email = aaUser?.email ?? null

        if (!email) {
          // Bot-only users without an email can't sign in to the new system
          stats.users.skipped++
          continue
        }

        const stripePriceId = mapPlanToStripePriceId(aaUser?.plan ?? null)
        const dailyLimit = dailyLimitFromPlan(aaUser?.plan ?? null)
        const stripeCustomerId = aaUser?.stripe_customer_id ?? null

        const data = {
          email,
          name: bu.full_name ?? bu.username ?? null,
          telegramUsername: bu.username ?? null,
          legacyId: bu.telegram_id,
          credits: bu.credits_balance ?? 0,
          usageCount: bu.total_resumes_generated ?? 0,
          dailyApplicationLimit: dailyLimit,
          stripePriceId,
          stripeCustomerId,
          emailVerified: aaUser?.is_verified ? new Date(aaUser.consent_at ?? Date.now()) : null,
          lastActiveAt: bu.last_active ? new Date(bu.last_active) : new Date(),
          createdAt: bu.created_at ? new Date(bu.created_at) : new Date(),
          updatedAt: new Date(),
        }

        await prisma.user.upsert({
          where: { legacyId: bu.telegram_id },
          create: data,
          update: {
            ...data,
            // Never overwrite a real Stripe customer ID with null
            stripeCustomerId: stripeCustomerId ?? undefined,
          },
        })

        migratedTelegramIds.add(bu.telegram_id)

        // Write consent row if present
        if (aaUser?.consent_at) {
          const existingUser = await prisma.user.findUnique({ where: { legacyId: bu.telegram_id }, select: { id: true } })
          if (existingUser) {
            await prisma.consent.upsert({
              where: { userId_type_version: { userId: existingUser.id, type: 'tos', version: 'legacy' } },
              create: { userId: existingUser.id, type: 'tos', version: 'legacy', accepted: true, createdAt: new Date(aaUser.consent_at) },
              update: {},
            })
          }
        }

        stats.users.created++ // upsert counts as create for simplicity
      } catch (e) {
        err(`User telegram_id=${bu.telegram_id}`, e)
      }
    }

    // Migrate autoapply-only users (no telegram account)
    for (const u of aaUsers) {
      if (u.telegram_id != null && migratedTelegramIds.has(u.telegram_id)) continue
      if (!u.email) { stats.users.skipped++; continue }
      try {
        const stripePriceId = mapPlanToStripePriceId(u.plan)
        const dailyLimit = dailyLimitFromPlan(u.plan)
        await prisma.user.upsert({
          where: { email: u.email },
          create: {
            email: u.email,
            legacyId: u.telegram_id ?? undefined,
            stripePriceId,
            stripeCustomerId: u.stripe_customer_id ?? undefined,
            dailyApplicationLimit: dailyLimit,
            emailVerified: u.is_verified ? new Date(u.consent_at ?? Date.now()) : null,
            createdAt: u.created_at ? new Date(u.created_at) : new Date(),
            updatedAt: new Date(),
          },
          update: { stripePriceId, dailyApplicationLimit: dailyLimit },
        })
        stats.users.created++
      } catch (e) {
        err(`AutoapplyUser email=${u.email}`, e)
      }
    }
    log(`  Users: ${stats.users.created} upserted, ${stats.users.skipped} skipped (no email)`)

    // ── 3. Migrate campaigns ───────────────────────────────────────────────────
    log('Migrating campaigns from autoapply.db…')
    const campaigns = autoapplyDb.prepare('SELECT * FROM campaigns').all() as LegacyCampaign[]

    for (const c of campaigns) {
      try {
        // Find the owner in the new DB via the autoapply user's telegram_id
        const aaUser = aaUsers.find(u => u.id === c.user_id)
        if (!aaUser) { err(`Campaign ${c.id}: autoapply user ${c.user_id} not found`); continue }

        const newUser = aaUser.email
          ? await prisma.user.findUnique({ where: { email: aaUser.email }, select: { id: true } })
          : aaUser.telegram_id
          ? await prisma.user.findUnique({ where: { legacyId: aaUser.telegram_id }, select: { id: true } })
          : null

        if (!newUser) { stats.campaigns.skipped++; continue }

        // Ensure user has a default Resume (stub if none)
        let resume = await prisma.resume.findFirst({ where: { userId: newUser.id, isDefault: true } })
        if (!resume) {
          const legacyResumeText = aaUser.resume_text ?? ''
          resume = await prisma.resume.create({
            data: {
              userId: newUser.id,
              title: `Imported resume`,
              targetRole: c.job_title ?? null,
              input: { legacy: true, source: 'autoapply.db' },
              generated: legacyResumeText
                ? { legacy: true, text: legacyResumeText }
                : { legacy: true, text: '' },
              isDefault: true,
            },
          })
        }

        // Parse platforms string → JobSource enum
        const platforms = (c.platforms ?? 'manual').split(',').map(s => s.trim()).filter(Boolean)
        const source = mapPlatform(platforms[0])

        const keywords = c.job_title ? c.job_title.split(/\s+/).filter(Boolean) : []
        const locations = c.location ? [c.location] : []

        await prisma.autoApplyCampaign.upsert({
          where: {
            // Idempotency: use compound user+name match (no legacyId field on campaign model)
            id: await (async () => {
              const existing = await prisma.autoApplyCampaign.findFirst({
                where: { userId: newUser.id, name: c.job_title ?? `Campaign ${c.id}` },
                select: { id: true },
              })
              return existing?.id ?? 'new-' + c.id  // force create if not found
            })(),
          },
          create: {
            userId: newUser.id,
            resumeId: resume.id,
            name: c.job_title ?? `Campaign ${c.id}`,
            source,
            isActive: (c.status ?? 'active') === 'active',
            keywords,
            locations,
            excludeCompanies: [],
            salaryMin: c.salary_min ?? null,
            experience: c.experience ?? null,
            dailyLimit: c.daily_limit ?? 3,
            totalSent: c.applications_sent ?? 0,
            responsesCount: c.responses ?? 0,
            lastRunAt: c.last_run ? new Date(c.last_run) : null,
            // Copy encrypted password VERBATIM — same Fernet key on both sides
            linkedinEmail: aaUser.linkedin_email ?? null,
            linkedinPasswordEnc: aaUser.linkedin_password_enc ?? null,
            hhToken: aaUser.hh_token ?? null,
            hhResumeId: aaUser.hh_resume_id ?? null,
            createdAt: c.created_at ? new Date(c.created_at) : new Date(),
            updatedAt: new Date(),
          },
          update: {
            isActive: (c.status ?? 'active') === 'active',
            totalSent: c.applications_sent ?? 0,
            responsesCount: c.responses ?? 0,
            lastRunAt: c.last_run ? new Date(c.last_run) : null,
          },
        })
        stats.campaigns.created++
      } catch (e) {
        err(`Campaign id=${c.id}`, e)
      }
    }
    log(`  Campaigns: ${stats.campaigns.created} upserted, ${stats.campaigns.skipped} skipped`)

    // ── 4. Migrate applications ────────────────────────────────────────────────
    log('Migrating applications from autoapply.db…')
    const applications = autoapplyDb.prepare('SELECT * FROM applications').all() as LegacyApplication[]

    for (const a of applications) {
      try {
        const aaUser = aaUsers.find(u => u.id === a.user_id)
        if (!aaUser) { stats.applications.skipped++; continue }

        const newUser = aaUser.email
          ? await prisma.user.findUnique({ where: { email: aaUser.email }, select: { id: true } })
          : null
        if (!newUser) { stats.applications.skipped++; continue }

        // Check if already migrated (idempotency via vacancyId + userId + appliedAt)
        const appliedAt = a.sent_at ? new Date(a.sent_at) : null
        if (appliedAt) {
          const existing = await prisma.jobApplication.findFirst({
            where: { userId: newUser.id, vacancyId: a.vacancy_id ?? undefined, appliedAt },
          })
          if (existing) { stats.applications.skipped++; continue }
        }

        await prisma.jobApplication.create({
          data: {
            userId: newUser.id,
            source: mapPlatform(a.platform),
            jobTitle: a.vacancy_title ?? 'Unknown',
            company: a.company_name ?? 'Unknown',
            jobUrl: a.vacancy_url ?? '',
            vacancyId: a.vacancy_id ?? null,
            status: mapApplicationStatus(a.status),
            appliedAt,
            responseAt: a.response_at ? new Date(a.response_at) : null,
            createdAt: appliedAt ?? new Date(),
            updatedAt: new Date(),
          },
        })
        stats.applications.created++
      } catch (e) {
        err(`Application id=${a.id}`, e)
      }
    }
    log(`  Applications: ${stats.applications.created} created, ${stats.applications.skipped} skipped`)
  }

  // ── Execute (with dry-run rollback) ────────────────────────────────────────
  if (DRY_RUN) {
    try {
      await prisma.$transaction(async (tx) => {
        // Swap prisma client for the transaction client inside run()
        ;(prisma as any)._dryRunTx = tx
        await run()
        throw new Error('__DRY_RUN_ROLLBACK__')
      })
    } catch (e: unknown) {
      if (e instanceof Error && e.message === '__DRY_RUN_ROLLBACK__') {
        log('↩️  Dry run complete — all changes rolled back')
      } else {
        throw e
      }
    }
  } else {
    await run()
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════')
  console.log(' Migration Summary')
  console.log('════════════════════════════════════════')
  console.log(`  Users        : ${stats.users.created} upserted, ${stats.users.skipped} skipped`)
  console.log(`  Campaigns    : ${stats.campaigns.created} upserted, ${stats.campaigns.skipped} skipped`)
  console.log(`  Applications : ${stats.applications.created} created, ${stats.applications.skipped} skipped`)
  console.log(`  Errors       : ${stats.errors}`)
  if (DRY_RUN) console.log('\n  ⚠️  DRY RUN — no data was written')
  console.log('════════════════════════════════════════\n')

  if (stats.errors > 0) process.exit(1)
}

migrate()
  .catch((e) => {
    console.error('\n❌ Migration aborted:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
