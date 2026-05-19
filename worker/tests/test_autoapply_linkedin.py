"""
test_autoapply_linkedin.py — Module-level tests for worker/autoapply/linkedin.py.

Does NOT require a real browser or LinkedIn account.
Tests verify:
  1. The module imports successfully
  2. LinkedInApplicator class exists with the expected public interface
  3. apply() returns an error dict when Playwright is not installed

P16 regression coverage:
  4. _fill_form_defaults does NOT fill text inputs that lack year/experience keywords
  5. _fill_form_defaults DOES fill inputs whose label indicates a numeric field
  6. _is_already_applied returns True when "Applied" badge is present
  7. _run_application_session uses a single browser login (session reuse)
  8. MAX_FORM_STEPS constant is ≥ 15
"""
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def test_linkedin_module_imports():
    """The linkedin module must be importable without Playwright installed."""
    import worker.autoapply.linkedin as linkedin_module  # noqa: F401

    assert linkedin_module is not None


def test_linkedin_applicator_class_exists():
    """LinkedInApplicator must be a class with an async apply() method."""
    from worker.autoapply.linkedin import LinkedInApplicator
    import inspect

    assert inspect.isclass(LinkedInApplicator), "LinkedInApplicator should be a class"
    assert hasattr(LinkedInApplicator, "apply"), "LinkedInApplicator must have apply()"
    assert inspect.iscoroutinefunction(
        LinkedInApplicator.apply
    ), "apply() must be an async method"


@pytest.mark.asyncio
async def test_linkedin_apply_returns_error_when_playwright_not_installed():
    """
    When Playwright is not available, apply() must return a dict with
    success=False and error='playwright_not_installed' without raising.
    """
    with patch("worker.autoapply.linkedin.PLAYWRIGHT_AVAILABLE", False):
        from worker.autoapply.linkedin import LinkedInApplicator

        applicator = LinkedInApplicator()
        result = await applicator.apply(
            email="test@example.com",
            password="hunter2",
            job_title="Software Engineer",
            location="Remote",
        )

    assert isinstance(result, dict), "apply() must return a dict"
    assert result.get("success") is False
    assert result.get("error") == "playwright_not_installed"


def test_captcha_detected_error_is_exception():
    """CaptchaDetectedError must subclass Exception."""
    from worker.autoapply.linkedin import CaptchaDetectedError

    assert issubclass(CaptchaDetectedError, Exception)


def test_not_available_result_structure():
    """_not_available_result() must return the expected dict structure."""
    from worker.autoapply.linkedin import _not_available_result

    result = _not_available_result("some_func")
    assert result["success"] is False
    assert result["error"] == "playwright_not_installed"
    assert result["function"] == "some_func"


# ── P16 regression: _fill_form_defaults ──────────────────────────────────────

def _make_mock_input(value: str = "", placeholder: str = "", aria_label: str = ""):
    """Return an async-mock simulating a Playwright element handle."""
    inp = MagicMock()
    inp.input_value = AsyncMock(return_value=value)
    inp.get_attribute = AsyncMock(side_effect=lambda attr: (
        placeholder if attr == "placeholder" else
        aria_label if attr == "aria-label" else
        None
    ))
    inp.fill = AsyncMock()
    return inp


@pytest.mark.asyncio
async def test_fill_form_defaults_does_not_fill_non_numeric_fields():
    """
    P16 regression: _fill_form_defaults must NOT fill empty text inputs
    that do not have year/experience keywords in their label/placeholder.

    Previously, the function filled ALL empty text inputs with experience_years,
    including city, address, portfolio, LinkedIn URL fields — causing ATS
    validation errors.
    """
    from worker.autoapply.linkedin import _fill_form_defaults

    city_input = _make_mock_input(value="", placeholder="City", aria_label="")
    address_input = _make_mock_input(value="", placeholder="Address", aria_label="")
    portfolio_input = _make_mock_input(value="", placeholder="Portfolio URL", aria_label="")

    mock_page = MagicMock()
    mock_page.query_selector_all = AsyncMock(side_effect=[
        [city_input, address_input, portfolio_input],  # text inputs
        [],  # select elements
    ])

    user_profile = {"experience_years": "3"}
    await _fill_form_defaults(mock_page, user_profile)

    city_input.fill.assert_not_called()
    address_input.fill.assert_not_called()
    portfolio_input.fill.assert_not_called()


@pytest.mark.asyncio
async def test_fill_form_defaults_fills_year_experience_fields():
    """
    P16: _fill_form_defaults MUST fill empty inputs whose placeholder/label
    contains year/experience keywords.
    """
    from worker.autoapply.linkedin import _fill_form_defaults

    years_input = _make_mock_input(value="", placeholder="Years of experience", aria_label="")
    exp_input = _make_mock_input(value="", placeholder="", aria_label="How many years experience")

    mock_page = MagicMock()
    mock_page.query_selector_all = AsyncMock(side_effect=[
        [years_input, exp_input],  # text inputs
        [],  # select elements
    ])

    user_profile = {"experience_years": "5"}
    await _fill_form_defaults(mock_page, user_profile)

    years_input.fill.assert_called_once_with("5")
    exp_input.fill.assert_called_once_with("5")


@pytest.mark.asyncio
async def test_fill_form_defaults_skips_already_filled_fields():
    """
    _fill_form_defaults must not overwrite fields that already have a value,
    regardless of their label.
    """
    from worker.autoapply.linkedin import _fill_form_defaults

    already_filled = _make_mock_input(value="7", placeholder="Years of experience", aria_label="")

    mock_page = MagicMock()
    mock_page.query_selector_all = AsyncMock(side_effect=[
        [already_filled],
        [],
    ])

    await _fill_form_defaults(mock_page, {"experience_years": "3"})

    already_filled.fill.assert_not_called()


# ── P16 regression: max steps constant ───────────────────────────────────────

def test_max_form_steps_is_at_least_15():
    """
    P16: The maximum form steps constant must be ≥ 15.
    LinkedIn multi-step applications can have up to 12–14 steps;
    the previous value of 10 caused premature abandonment.
    """
    from worker.autoapply.linkedin import _MAX_FORM_STEPS

    assert _MAX_FORM_STEPS >= 15, (
        f"_MAX_FORM_STEPS should be ≥ 15 (got {_MAX_FORM_STEPS})"
    )


# ── P16 regression: _is_already_applied ──────────────────────────────────────

@pytest.mark.asyncio
async def test_is_already_applied_returns_true_for_applied_badge():
    """
    _is_already_applied must return True when a 'You applied' or 'Applied'
    element is present on the page.
    """
    from worker.autoapply.linkedin import _is_already_applied

    applied_el = MagicMock()
    mock_page = MagicMock()
    # First selector match returns the element
    mock_page.query_selector = AsyncMock(return_value=applied_el)

    result = await _is_already_applied(mock_page)
    assert result is True


@pytest.mark.asyncio
async def test_is_already_applied_returns_false_when_no_badge():
    """
    _is_already_applied must return False when no applied-state selector matches.
    """
    from worker.autoapply.linkedin import _is_already_applied

    mock_page = MagicMock()
    mock_page.query_selector = AsyncMock(return_value=None)

    result = await _is_already_applied(mock_page)
    assert result is False


# ── P16 regression: session reuse (single login) ─────────────────────────────

@pytest.mark.asyncio
async def test_run_application_session_logs_in_once():
    """
    P16: _run_application_session must login exactly once regardless of the
    number of jobs.  The previous implementation called _apply_to_job (which
    creates its own browser + login) per job, multiplying CAPTCHA exposure.
    """
    from worker.autoapply import linkedin as linkedin_module

    login_call_count = 0

    async def count_login(page, email, password):
        nonlocal login_call_count
        login_call_count += 1

    # Mock browser infrastructure
    mock_page = MagicMock()
    mock_page.close = AsyncMock()
    mock_context = MagicMock()
    mock_context.new_page = AsyncMock(return_value=mock_page)
    mock_browser = MagicMock()
    mock_browser.new_context = AsyncMock(return_value=mock_context)
    mock_browser.close = AsyncMock()

    mock_pw_instance = MagicMock()
    mock_pw_instance.chromium = MagicMock()
    mock_pw_instance.chromium.launch = AsyncMock(return_value=mock_browser)
    mock_pw_instance.__aenter__ = AsyncMock(return_value=mock_pw_instance)
    mock_pw_instance.__aexit__ = AsyncMock(return_value=False)

    jobs = [
        {"url": "https://www.linkedin.com/jobs/view/1/", "title": "Eng A", "company": "Acme"},
        {"url": "https://www.linkedin.com/jobs/view/2/", "title": "Eng B", "company": "Globex"},
    ]

    with patch("worker.autoapply.linkedin.PLAYWRIGHT_AVAILABLE", True), \
         patch("worker.autoapply.linkedin.async_playwright", return_value=mock_pw_instance), \
         patch("worker.autoapply.linkedin._login", side_effect=count_login), \
         patch(
             "worker.autoapply.linkedin._apply_to_job_in_context",
             AsyncMock(return_value={"success": True, "error": None, "job_url": "x"}),
         ):
        # Shorten the inter-application delay so the test completes quickly
        with patch("worker.autoapply.linkedin.random") as mock_random:
            mock_random.uniform = MagicMock(return_value=0.001)
            mock_random.randint = MagicMock(return_value=1)
            results = await linkedin_module._run_application_session(
                email="user@example.com",
                password="secret",
                jobs=jobs,
                user_profile={},
                resume_pdf_path="",
            )

    assert login_call_count == 1, (
        f"Expected exactly 1 login for {len(jobs)} jobs, got {login_call_count}. "
        "Each extra login increases CAPTCHA exposure."
    )
    assert len(results) == len(jobs)
