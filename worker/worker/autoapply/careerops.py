"""
careerops.py — Playwright-based ATS form auto-filler (CareerOps applicator).

Supports:
  Greenhouse      — boards.greenhouse.io / company.greenhouse.io
  Lever           — jobs.lever.co
  Workable        — apply.workable.com
  SmartRecruiters — jobs.smartrecruiters.com
  Jobvite         — jobs.jobvite.com
  Ashby           — jobs.ashbyhq.com
  Generic         — heuristic detection for any unknown ATS

Usage:
    applicator = CareerOpsApplicator()
    await applicator.start()
    result = await applicator.apply(job_url, user_data)
    await applicator.close()

user_data keys:
    first_name, last_name, email, phone, linkedin_url,
    resume_text, cover_letter, current_company (optional),
    portfolio_url (optional), location (optional)

Result dict:
    status  — "submitted" | "form_not_found" | "error"
    url     — the job URL processed
    ats     — detected ATS name
    error   — present when status="error"

Ported from: autoapply/ats_filler.py
Changes vs source:
  - Replaced logging with structlog
  - Renamed class ATSFiller -> CareerOpsApplicator
  - All log messages in English (source was already English)

P16 improvements (2026-05-19):
  - Workable: re-fills all fields on every step (not just step 0) so late-
    appearing required fields are never left blank.
  - Jobvite: dedicated handler (was falling through to apply_generic_form).
  - Ashby: dedicated handler (was falling through to apply_generic_form).
  - apply(): routes jobvite and ashby to their dedicated handlers.
"""
import random
import re
import tempfile
import os
from typing import Optional

import structlog
from playwright.async_api import async_playwright, BrowserContext, Page

logger = structlog.get_logger(__name__)

_ATS_PATTERNS: dict[str, list[str]] = {
    "greenhouse":      [r"greenhouse\.io", r"boards\.greenhouse"],
    "lever":           [r"jobs\.lever\.co", r"lever\.co/.*jobs"],
    "workable":        [r"apply\.workable\.com", r"workable\.com.*apply"],
    "smartrecruiters": [r"jobs\.smartrecruiters\.com"],
    "jobvite":         [r"jobs\.jobvite\.com"],
    "ashby":           [r"jobs\.ashbyhq\.com"],
}


def detect_ats(url: str) -> str:
    """Return the detected ATS name based on URL patterns, or 'generic'."""
    for ats_name, patterns in _ATS_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, url, re.I):
                return ats_name
    return "generic"


async def _type_slow(page: Page, selector: str, text: str) -> None:
    """Fill a field character-by-character with human-like delays."""
    await page.click(selector)
    await page.wait_for_timeout(random.randint(80, 200))
    for char in text:
        await page.keyboard.type(char, delay=random.randint(25, 70))


async def _fill(page: Page, selector: str, value: str) -> bool:
    """Fill a field if it exists. Returns True on success."""
    try:
        loc = page.locator(selector).first
        if await loc.count() > 0:
            await loc.fill(value)
            await page.wait_for_timeout(random.randint(60, 150))
            return True
    except Exception:
        pass
    return False


async def _upload_resume(page: Page, selector: str, resume_text: str) -> bool:
    """Write resume to a temporary .txt file and upload it via file input."""
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False, encoding="utf-8"
        ) as f:
            f.write(resume_text)
            tmp_path = f.name
        await page.set_input_files(selector, tmp_path)
        os.unlink(tmp_path)
        await page.wait_for_timeout(1000)
        return True
    except Exception as exc:
        logger.warning("careerops.resume_upload_failed", selector=selector, error=str(exc))
        return False


async def _click_apply_button(page: Page) -> bool:
    """Find and click an Apply button if present. Returns True if clicked."""
    for text in [
        "Apply Now",
        "Apply for this Job",
        "Apply for this job",
        "Apply",
        "Easy Apply",
        "Submit Application",
    ]:
        loc = page.locator(f'a:has-text("{text}"), button:has-text("{text}")').first
        if await loc.count() > 0:
            await loc.click()
            await page.wait_for_load_state("networkidle", timeout=10000)
            await page.wait_for_timeout(random.randint(800, 1500))
            return True
    return False


async def _fill_standard_fields(page: Page, user_data: dict, field_map: dict) -> None:
    """Fill a dict of selector→value pairs, skipping empty values."""
    for sel, val in field_map.items():
        if val:
            await _fill(page, sel, val)


class CareerOpsApplicator:
    """Playwright-based form filler for major ATS platforms."""

    def __init__(self) -> None:
        self.browser = None
        self.context: Optional[BrowserContext] = None
        self._pw = None

    async def start(self) -> None:
        """Launch headless browser and create a browser context."""
        self._pw = await async_playwright().start()
        self.browser = await self._pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )
        self.context = await self.browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
        )

    async def close(self) -> None:
        """Close the browser and stop Playwright."""
        if self.browser:
            await self.browser.close()
        if self._pw:
            await self._pw.stop()

    async def apply(self, job_url: str, user_data: dict) -> dict:
        """
        Route to the appropriate ATS filler based on URL.
        Never raises — returns an error dict on unhandled exception.
        """
        ats = detect_ats(job_url)
        logger.info("careerops.apply.routing", url=job_url, ats=ats)
        try:
            if ats == "greenhouse":
                return await self.apply_greenhouse(job_url, user_data)
            if ats == "lever":
                return await self.apply_lever(job_url, user_data)
            if ats == "workable":
                return await self.apply_workable(job_url, user_data)
            if ats == "smartrecruiters":
                return await self.apply_smartrecruiters(job_url, user_data)
            if ats == "jobvite":
                return await self.apply_jobvite(job_url, user_data)
            if ats == "ashby":
                return await self.apply_ashby(job_url, user_data)
            return await self.apply_generic_form(job_url, user_data)
        except Exception as exc:
            logger.exception("careerops.apply.unhandled_error", url=job_url, error=str(exc))
            return {"status": "error", "url": job_url, "ats": ats, "error": str(exc)}

    # ── Greenhouse ───────────────────────────────────────────────────────────

    async def apply_greenhouse(self, job_url: str, user_data: dict) -> dict:
        """Greenhouse: boards.greenhouse.io/*/jobs/* — standard id-keyed form."""
        page = await self.context.new_page()
        try:
            await page.goto(job_url, timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=15000)
            await page.wait_for_timeout(random.randint(1000, 2000))

            await _fill(page, "#first_name", user_data.get("first_name", ""))
            await _fill(page, "#last_name", user_data.get("last_name", ""))
            await _fill(page, "#email", user_data.get("email", ""))
            await _fill(page, "#phone", user_data.get("phone", ""))

            linkedin = user_data.get("linkedin_url", "")
            for sel in ['input[name*="linkedin"]', 'input[id*="linkedin"]']:
                if linkedin and await _fill(page, sel, linkedin):
                    break

            resume_text = user_data.get("resume_text", "")
            if resume_text:
                for sel in [
                    'input[type="file"][name*="resume"]',
                    'input[type="file"][id*="resume"]',
                    'input[type="file"]',
                ]:
                    if await page.locator(sel).count() > 0:
                        await _upload_resume(page, sel, resume_text)
                        break

            cover_letter = user_data.get("cover_letter", "")
            for sel in ['textarea[name*="cover"]', 'textarea[id*="cover"]', '#cover_letter']:
                if cover_letter and await _fill(page, sel, cover_letter[:2000]):
                    break

            submit = page.locator('input[type="submit"], button[type="submit"]').first
            if await submit.count() > 0:
                await submit.click()
                await page.wait_for_load_state("networkidle", timeout=15000)
                await page.wait_for_timeout(2000)
                logger.info("careerops.greenhouse.submitted", url=job_url)
                return {"status": "submitted", "url": job_url, "ats": "greenhouse"}

            return {"status": "form_not_found", "url": job_url, "ats": "greenhouse"}
        finally:
            await page.close()

    # ── Lever ────────────────────────────────────────────────────────────────

    async def apply_lever(self, job_url: str, user_data: dict) -> dict:
        """Lever: jobs.lever.co/company/job-id — click Apply then fill React form."""
        page = await self.context.new_page()
        try:
            await page.goto(job_url, timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=15000)
            await page.wait_for_timeout(random.randint(1000, 2000))

            await _click_apply_button(page)

            full_name = (
                f"{user_data.get('first_name', '')} "
                f"{user_data.get('last_name', '')}".strip()
            )
            field_map = {
                'input[name="name"]': full_name,
                'input[name="email"]': user_data.get("email", ""),
                'input[name="phone"]': user_data.get("phone", ""),
                'input[name="org"]': user_data.get("current_company", ""),
                'input[name="urls[LinkedIn]"]': user_data.get("linkedin_url", ""),
                'input[name="urls[Portfolio]"]': user_data.get("portfolio_url", ""),
            }
            for sel, val in field_map.items():
                if val:
                    await _fill(page, sel, val)

            resume_text = user_data.get("resume_text", "")
            if resume_text:
                for sel in [
                    'input[type="file"][name*="resume"]',
                    'input[type="file"]',
                ]:
                    if await page.locator(sel).count() > 0:
                        await _upload_resume(page, sel, resume_text)
                        break

            cover_letter = user_data.get("cover_letter", "")
            for sel in [
                'textarea[name*="comments"]',
                'textarea[name*="cover"]',
                'textarea',
            ]:
                if cover_letter and await _fill(page, sel, cover_letter[:2000]):
                    break

            for txt in ["Submit Application", "Submit"]:
                btn = page.locator(f'button[type="submit"]:has-text("{txt}")').first
                if await btn.count() > 0:
                    await btn.click()
                    await page.wait_for_load_state("networkidle", timeout=15000)
                    await page.wait_for_timeout(2000)
                    logger.info("careerops.lever.submitted", url=job_url)
                    return {"status": "submitted", "url": job_url, "ats": "lever"}

            return {"status": "form_not_found", "url": job_url, "ats": "lever"}
        finally:
            await page.close()

    # ── Workable ─────────────────────────────────────────────────────────────

    async def apply_workable(self, job_url: str, user_data: dict) -> dict:
        """
        Workable: apply.workable.com/*/j/*/apply — multi-step wizard.

        KEY FIX (P16): Re-fills form fields on every step, not just before
        the loop.  Workable's wizard conditionally shows fields based on step
        (e.g. step 1: personal info; step 2: questions; step 3: resume).
        The original code filled once then only clicked Next, so anything
        appearing on step 2+ was left blank.
        """
        page = await self.context.new_page()
        try:
            apply_url = (
                job_url if "/apply" in job_url else job_url.rstrip("/") + "/apply"
            )
            await page.goto(apply_url, timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=15000)
            await page.wait_for_timeout(random.randint(1000, 2000))

            for _step in range(5):
                # Re-fill standard fields on every step (new ones may have appeared)
                field_map = {
                    'input[name="firstname"]': user_data.get("first_name", ""),
                    'input[name="lastname"]': user_data.get("last_name", ""),
                    'input[name="email"]': user_data.get("email", ""),
                    'input[name="phone"]': user_data.get("phone", ""),
                    'input[name="address"]': user_data.get("location", ""),
                }
                for sel, val in field_map.items():
                    if val:
                        await _fill(page, sel, val)

                resume_text = user_data.get("resume_text", "")
                if resume_text:
                    for sel in ['input[type="file"]']:
                        if await page.locator(sel).count() > 0:
                            await _upload_resume(page, sel, resume_text)
                            break

                cover_letter = user_data.get("cover_letter", "")
                for sel in [
                    'textarea[name*="cover"]',
                    'textarea[placeholder*="cover"]',
                ]:
                    if cover_letter and await _fill(page, sel, cover_letter[:2000]):
                        break

                # Try Submit first (highest priority)
                submitted = False
                for txt in ["Submit Application", "Submit"]:
                    btn = page.locator(
                        f'button:has-text("{txt}"), input[value="{txt}"]'
                    ).first
                    if await btn.count() > 0:
                        await btn.click()
                        await page.wait_for_load_state("networkidle", timeout=10000)
                        await page.wait_for_timeout(1500)
                        logger.info("careerops.workable.submitted", url=job_url)
                        return {
                            "status": "submitted",
                            "url": job_url,
                            "ats": "workable",
                        }

                # Then try Next / Continue
                advanced = False
                for txt in ["Next", "Continue", "Next Step"]:
                    btn = page.locator(
                        f'button:has-text("{txt}"), input[value="{txt}"]'
                    ).first
                    if await btn.count() > 0:
                        await btn.click()
                        await page.wait_for_load_state("networkidle", timeout=10000)
                        await page.wait_for_timeout(1500)
                        advanced = True
                        break

                if not advanced:
                    break  # No button found — bail out

            return {"status": "form_not_found", "url": job_url, "ats": "workable"}
        finally:
            await page.close()

    # ── SmartRecruiters ───────────────────────────────────────────────────────

    async def apply_smartrecruiters(self, job_url: str, user_data: dict) -> dict:
        """SmartRecruiters: jobs.smartrecruiters.com/company/job-id"""
        page = await self.context.new_page()
        try:
            await page.goto(job_url, timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=15000)
            await page.wait_for_timeout(random.randint(1000, 2000))

            await _click_apply_button(page)

            field_map = {
                'input[name="firstName"]': user_data.get("first_name", ""),
                'input[name="lastName"]': user_data.get("last_name", ""),
                'input[name="email"]': user_data.get("email", ""),
                'input[name="phone"]': user_data.get("phone", ""),
            }
            for sel, val in field_map.items():
                if val:
                    await _fill(page, sel, val)

            resume_text = user_data.get("resume_text", "")
            if resume_text:
                for sel in ['input[type="file"]']:
                    if await page.locator(sel).count() > 0:
                        await _upload_resume(page, sel, resume_text)
                        break

            submit = page.locator('button[type="submit"]').first
            if await submit.count() > 0:
                await submit.click()
                await page.wait_for_load_state("networkidle", timeout=15000)
                await page.wait_for_timeout(2000)
                logger.info("careerops.smartrecruiters.submitted", url=job_url)
                return {"status": "submitted", "url": job_url, "ats": "smartrecruiters"}

            return {"status": "form_not_found", "url": job_url, "ats": "smartrecruiters"}
        finally:
            await page.close()

    # ── Jobvite ───────────────────────────────────────────────────────────────

    async def apply_jobvite(self, job_url: str, user_data: dict) -> dict:
        """
        Jobvite: jobs.jobvite.com — click Apply, fill form, submit.

        NEW in P16: dedicated handler (was falling through to apply_generic_form).
        Jobvite uses id-prefixed inputs and a multi-step flow with a submit
        button type of "submit".
        """
        page = await self.context.new_page()
        try:
            await page.goto(job_url, timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=15000)
            await page.wait_for_timeout(random.randint(1000, 2000))

            await _click_apply_button(page)
            await page.wait_for_timeout(1500)

            field_map = {
                'input#first-name, input[name="firstName"], input[id*="first"]': user_data.get("first_name", ""),
                'input#last-name, input[name="lastName"], input[id*="last"]': user_data.get("last_name", ""),
                'input#email, input[name="email"], input[type="email"]': user_data.get("email", ""),
                'input#phone, input[name="phone"], input[type="tel"]': user_data.get("phone", ""),
                'input[name*="linkedin"], input[id*="linkedin"]': user_data.get("linkedin_url", ""),
            }
            for sel, val in field_map.items():
                if val:
                    await _fill(page, sel, val)

            resume_text = user_data.get("resume_text", "")
            if resume_text:
                for sel in ['input[type="file"]']:
                    if await page.locator(sel).count() > 0:
                        await _upload_resume(page, sel, resume_text)
                        break

            cover_letter = user_data.get("cover_letter", "")
            for sel in [
                'textarea[name*="cover"]',
                'textarea[id*="cover"]',
                'textarea[placeholder*="cover"]',
            ]:
                if cover_letter and await _fill(page, sel, cover_letter[:2000]):
                    break

            # Jobvite may have multiple pages; click Next/Submit up to 4 times
            for _step in range(4):
                for txt in ["Submit Application", "Submit", "Apply"]:
                    btn = page.locator(
                        f'button[type="submit"]:has-text("{txt}"), '
                        f'input[type="submit"][value*="{txt}"]'
                    ).first
                    if await btn.count() > 0:
                        await btn.click()
                        await page.wait_for_load_state("networkidle", timeout=15000)
                        await page.wait_for_timeout(2000)
                        logger.info("careerops.jobvite.submitted", url=job_url)
                        return {"status": "submitted", "url": job_url, "ats": "jobvite"}

                # Try next page
                advanced = False
                for txt in ["Next", "Continue", "Next Step"]:
                    btn = page.locator(f'button:has-text("{txt}")').first
                    if await btn.count() > 0:
                        await btn.click()
                        await page.wait_for_load_state("networkidle", timeout=10000)
                        await page.wait_for_timeout(1500)
                        advanced = True
                        break
                if not advanced:
                    break

            return {"status": "form_not_found", "url": job_url, "ats": "jobvite"}
        finally:
            await page.close()

    # ── Ashby ─────────────────────────────────────────────────────────────────

    async def apply_ashby(self, job_url: str, user_data: dict) -> dict:
        """
        Ashby HQ: jobs.ashbyhq.com — click Apply, fill React form, submit.

        NEW in P16: dedicated handler (was falling through to apply_generic_form).
        Ashby uses data-field-id attributes on inputs; falls back to
        placeholder-based selectors for flexibility.
        """
        page = await self.context.new_page()
        try:
            await page.goto(job_url, timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=15000)
            await page.wait_for_timeout(random.randint(1000, 2000))

            await _click_apply_button(page)
            await page.wait_for_load_state("networkidle", timeout=10000)
            await page.wait_for_timeout(1500)

            # Try data-field-id attrs first, fall back to placeholder/type selectors
            fields: list[tuple[str, str]] = [
                ('input[data-field-id="firstName"], input[placeholder*="First"]', user_data.get("first_name", "")),
                ('input[data-field-id="lastName"], input[placeholder*="Last"]', user_data.get("last_name", "")),
                ('input[data-field-id="email"], input[type="email"]', user_data.get("email", "")),
                ('input[data-field-id="phone"], input[type="tel"]', user_data.get("phone", "")),
                ('input[data-field-id="linkedIn"], input[placeholder*="LinkedIn"]', user_data.get("linkedin_url", "")),
            ]
            for sel, val in fields:
                if val:
                    await _fill(page, sel, val)

            resume_text = user_data.get("resume_text", "")
            if resume_text:
                for sel in [
                    'input[type="file"][aria-label*="resume"]',
                    'input[type="file"]',
                ]:
                    if await page.locator(sel).count() > 0:
                        await _upload_resume(page, sel, resume_text)
                        break

            cover_letter = user_data.get("cover_letter", "")
            for sel in [
                'textarea[data-field-id="coverLetter"]',
                'textarea[placeholder*="cover"]',
                'textarea[placeholder*="Cover"]',
                'textarea',
            ]:
                if cover_letter and await _fill(page, sel, cover_letter[:2000]):
                    break

            submit = page.locator(
                'button[type="submit"], button:has-text("Submit Application"), button:has-text("Submit")'
            ).first
            if await submit.count() > 0:
                await submit.click()
                await page.wait_for_load_state("networkidle", timeout=15000)
                await page.wait_for_timeout(2000)
                logger.info("careerops.ashby.submitted", url=job_url)
                return {"status": "submitted", "url": job_url, "ats": "ashby"}

            return {"status": "form_not_found", "url": job_url, "ats": "ashby"}
        finally:
            await page.close()

    # ── Generic ───────────────────────────────────────────────────────────────

    async def apply_generic_form(self, job_url: str, user_data: dict) -> dict:
        """
        Heuristic form detection for unknown ATS systems.
        Finds fields by name/id/placeholder patterns, fills them, then submits.
        """
        page = await self.context.new_page()
        try:
            await page.goto(job_url, timeout=30000)
            await page.wait_for_load_state("networkidle", timeout=15000)
            await page.wait_for_timeout(random.randint(1000, 2000))

            await _click_apply_button(page)

            full_name = (
                f"{user_data.get('first_name', '')} "
                f"{user_data.get('last_name', '')}".strip()
            )
            email = user_data.get("email", "")
            phone = user_data.get("phone", "")
            linkedin = user_data.get("linkedin_url", "")

            field_patterns: list[tuple[str, list[str]]] = [
                (user_data.get("first_name", ""), [
                    'input[name="first_name"]',
                    'input[name*="first"][name*="name"]',
                    'input[id*="first_name"]',
                    'input[placeholder*="First name"]',
                    'input[placeholder*="First Name"]',
                ]),
                (user_data.get("last_name", ""), [
                    'input[name="last_name"]',
                    'input[name*="last"][name*="name"]',
                    'input[id*="last_name"]',
                    'input[placeholder*="Last name"]',
                    'input[placeholder*="Last Name"]',
                ]),
                (full_name, [
                    'input[name="name"]',
                    'input[name="full_name"]',
                    'input[placeholder*="Full name"]',
                    'input[placeholder*="Your name"]',
                ]),
                (email, [
                    'input[type="email"]',
                    'input[name="email"]',
                    'input[id="email"]',
                    'input[placeholder*="Email"]',
                ]),
                (phone, [
                    'input[type="tel"]',
                    'input[name="phone"]',
                    'input[id="phone"]',
                    'input[placeholder*="Phone"]',
                ]),
                (linkedin, [
                    'input[name*="linkedin"]',
                    'input[id*="linkedin"]',
                    'input[placeholder*="LinkedIn"]',
                ]),
            ]

            filled = 0
            for value, selectors in field_patterns:
                if not value:
                    continue
                for sel in selectors:
                    try:
                        if await page.locator(sel).count() > 0:
                            await _fill(page, sel, value)
                            filled += 1
                            break
                    except Exception:
                        continue

            resume_text = user_data.get("resume_text", "")
            if resume_text:
                for sel in [
                    'input[type="file"][name*="resume"]',
                    'input[type="file"][accept*=".pdf"]',
                    'input[type="file"]',
                ]:
                    if await page.locator(sel).count() > 0:
                        await _upload_resume(page, sel, resume_text)
                        break

            cover_letter = user_data.get("cover_letter", "")
            for sel in [
                'textarea[name*="cover"]',
                'textarea[id*="cover"]',
                'textarea[placeholder*="cover"]',
                'textarea[name*="letter"]',
                'textarea[placeholder*="letter"]',
            ]:
                if cover_letter and await _fill(page, sel, cover_letter[:2000]):
                    break

            if filled == 0:
                logger.warning("careerops.generic.no_fields_filled", url=job_url)
                return {"status": "form_not_found", "url": job_url, "ats": "generic"}

            for txt in ["Submit Application", "Apply Now", "Apply", "Submit"]:
                btn = page.locator(
                    f'button[type="submit"]:has-text("{txt}"), '
                    f'input[type="submit"][value*="{txt}"]'
                ).first
                if await btn.count() > 0:
                    await btn.click()
                    await page.wait_for_load_state("networkidle", timeout=15000)
                    await page.wait_for_timeout(2000)
                    logger.info(
                        "careerops.generic.submitted",
                        url=job_url,
                        fields_filled=filled,
                    )
                    return {
                        "status": "submitted",
                        "url": job_url,
                        "ats": "generic",
                        "fields_filled": filled,
                    }

            # Last resort: any submit button
            fallback = page.locator('button[type="submit"], input[type="submit"]').first
            if await fallback.count() > 0:
                await fallback.click()
                await page.wait_for_load_state("networkidle", timeout=15000)
                await page.wait_for_timeout(2000)
                return {
                    "status": "submitted",
                    "url": job_url,
                    "ats": "generic",
                    "fields_filled": filled,
                }

            return {"status": "form_not_found", "url": job_url, "ats": "generic"}
        finally:
            await page.close()
