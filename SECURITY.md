# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.9.x   | :white_check_mark: |
| < 0.9   | :x:                |

## Reporting a Vulnerability

We take the security of Ralph seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please open a draft security advisory via the [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) feature, or contact the maintainers directly.

Please include the following information:
- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Within 48 hours**: We will acknowledge receipt of your report
- **Within 7 days**: We will provide a preliminary assessment
- **Within 30 days**: We will provide a fix or mitigation plan
- **Within 60 days**: We will publish the vulnerability details (after a fix is available)

### Scope

Security issues that should be reported include, but are not limited to:
- API key exposure or leakage
- Insecure handling of GitHub tokens
- SQL injection vulnerabilities
- Cross-site scripting (XSS) in the Tauri webview
- Buffer overflows in Rust code
- Path traversal vulnerabilities
- Dependency vulnerabilities with known CVEs

### Safe Harbor

We will not take legal action against researchers who:
- Report vulnerabilities in good faith
- Do not access, modify, or delete user data
- Do not disrupt services
- Follow responsible disclosure guidelines

## Security Best Practices for Users

1. **Never commit your `.env` file** - It contains your GitHub token
2. **Use a token with minimal permissions** - Only `public_repo` access is needed
3. **Keep Ralph updated** - Security patches are released regularly
4. **Review dependencies** - Run `cargo audit` periodically to check for known vulnerabilities

## Security Audit

Ralph uses the following security measures:
- `cargo audit` for checking known Rust vulnerabilities
- `npm audit` for checking frontend dependency vulnerabilities
- SQLite parameterized queries to prevent SQL injection
- Tauri's built security model for the desktop application
