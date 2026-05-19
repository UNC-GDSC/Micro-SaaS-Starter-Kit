# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email security reports to: **max737books@gmail.com**

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Disclosure Policy

- We will acknowledge receipt within **48 hours**.
- We aim to confirm the vulnerability within **7 days**.
- We will release a fix within **90 days** of confirmation (sooner for critical issues).
- We will notify you when the fix is released.
- We follow [Coordinated Vulnerability Disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure).

## Scope

In scope:
- Authentication and authorization bypasses
- Data exposure or injection vulnerabilities (XSS, SQLi, SSRF)
- Payment processing logic flaws
- Encryption key handling issues

Out of scope:
- Denial of service via rate limiting
- Missing security headers on non-authenticated pages
- Issues requiring physical access to a device
