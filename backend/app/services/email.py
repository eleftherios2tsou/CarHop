# backend/app/services/email.py
"""
Email service — sends transactional emails via SMTP.

If SMTP_HOST / SMTP_USER are not set, the function falls back to printing
the verification URL to stdout so development still works without credentials.
"""

import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, token: str, settings) -> None:
    """
    Send an email-verification message to *to_email*.

    The email contains a clickable link:
        {FRONTEND_BASE_URL}/?verify={token}

    The App.jsx picks up the ?verify= query param on load and automatically
    calls POST /auth/verify-email/{token}, so the user just has to click once.

    Falls back to stdout logging when SMTP is not configured (dev mode).
    """
    verify_url = f"{settings.frontend_base_url}/?verify={token}"

    if not settings.smtp_host or not settings.smtp_user:
        # Dev fallback — token is visible in Docker logs
        logger.info("[DEV] Verification email skipped (SMTP not configured).")
        logger.info("[DEV] Verification URL for %s: %s", to_email, verify_url)
        print(f"\n[DEV] Verify email link for {to_email}:\n  {verify_url}\n", flush=True)
        return

    subject = "Verify your CarHop account"

    plain = (
        f"Welcome to CarHop!\n\n"
        f"Click the link below to verify your email address:\n\n"
        f"  {verify_url}\n\n"
        f"If you did not create an account, you can safely ignore this message."
    )

    html = f"""\
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#1a1a1a">
  <h2 style="color:#0ea5e9">Welcome to CarHop!</h2>
  <p>Thanks for signing up. Click the button below to verify your email address and activate your account.</p>
  <p style="margin:32px 0">
    <a href="{verify_url}"
       style="background:#0ea5e9;color:#fff;padding:12px 28px;text-decoration:none;
              border-radius:6px;display:inline-block;font-weight:600">
      Verify Email
    </a>
  </p>
  <p style="font-size:13px;color:#666">
    Or paste this URL into your browser:<br>
    <code style="word-break:break-all">{verify_url}</code>
  </p>
  <p style="font-size:12px;color:#999;margin-top:40px">
    If you didn't create a CarHop account, you can safely ignore this email.
  </p>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from, to_email, msg.as_string())
        logger.info("Verification email sent to %s", to_email)
    except Exception as exc:
        # Never let an email failure break registration
        logger.error("Failed to send verification email to %s: %s", to_email, exc)
