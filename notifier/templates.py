"""
templates.py — Telegram message templates for each notification type.

Each function returns a dict:
  { "text": str, "url": str | None }

The text uses Telegram HTML parse_mode. The url is placed in a single
inline keyboard button labelled "Open Dashboard".
"""
from config import settings

APP = settings.app_url


def submitted(job_title: str, company: str, application_id: str | None = None) -> dict:
    url = f"{APP}/dashboard/applications/{application_id}" if application_id else f"{APP}/dashboard/applications"
    return {
        "text": f"✉️ <b>Applied!</b>\n{_esc(job_title)} at <b>{_esc(company)}</b>",
        "url": url,
    }


def interview_reply(company: str, application_id: str | None = None) -> dict:
    url = f"{APP}/dashboard/applications/{application_id}" if application_id else f"{APP}/dashboard/applications"
    return {
        "text": f"📬 <b>Recruiter reply</b> from <b>{_esc(company)}</b>\nOpen dashboard to read the email.",
        "url": url,
    }


def linkedin_issue() -> dict:
    return {
        "text": "⚠️ <b>LinkedIn needs re-auth</b>\nYour LinkedIn session expired. Please reconnect to keep your campaigns running.",
        "url": f"{APP}/dashboard/settings/automation",
    }


def _esc(s: str) -> str:
    """Escape HTML special characters for Telegram HTML mode."""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
