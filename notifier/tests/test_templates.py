"""
test_templates.py — Unit tests for notifier/templates.py.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import templates


class TestSubmittedTemplate:
    def test_contains_job_title(self):
        msg = templates.submitted("Software Engineer", "Acme Corp")
        assert "Software Engineer" in msg["text"]

    def test_contains_company(self):
        msg = templates.submitted("SWE", "Globex")
        assert "Globex" in msg["text"]

    def test_has_url(self):
        msg = templates.submitted("SWE", "Acme", application_id="abc123")
        assert "abc123" in msg["url"]

    def test_url_fallback_without_id(self):
        msg = templates.submitted("SWE", "Acme")
        assert msg["url"].endswith("/dashboard/applications")

    def test_html_escaping(self):
        msg = templates.submitted("<script>", "A&B Corp")
        assert "<script>" not in msg["text"]
        assert "&amp;" in msg["text"] or "A&amp;B" in msg["text"] or "A&B" not in msg["text"]


class TestInterviewReplyTemplate:
    def test_contains_company(self):
        msg = templates.interview_reply("OpenAI")
        assert "OpenAI" in msg["text"]

    def test_has_url_with_id(self):
        msg = templates.interview_reply("OpenAI", application_id="xyz")
        assert "xyz" in msg["url"]

    def test_emoji_present(self):
        msg = templates.interview_reply("Co")
        assert "📬" in msg["text"]


class TestLinkedInIssueTemplate:
    def test_contains_reauth_mention(self):
        msg = templates.linkedin_issue()
        assert "re-auth" in msg["text"].lower() or "re-auth" in msg["text"]

    def test_has_url(self):
        msg = templates.linkedin_issue()
        assert msg["url"] is not None
        assert "/dashboard/" in msg["url"]

    def test_warning_emoji(self):
        msg = templates.linkedin_issue()
        assert "⚠️" in msg["text"]
