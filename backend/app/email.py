# backend/app/email.py
"""
Email notification helpers.
All functions are fire-and-forget: if SMTP is not configured or sending fails,
the error is logged but never re-raised, so booking actions always succeed.
"""
from __future__ import annotations

import logging
import smtplib
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


# ── Low-level send ──────────────────────────────────────────────────────────


def _wrap(body: str) -> str:
    """Wrap a body fragment in a consistent CarHop HTML email shell."""
    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:32px;background:#f6f3ee;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;
              border:1px solid #e6dfd6;overflow:hidden">
    <div style="background:linear-gradient(135deg,#1f6f54,#c98b2b);padding:20px 24px">
      <div style="color:#fff;font-weight:800;font-size:20px;letter-spacing:-0.02em">CarHop</div>
      <div style="color:rgba(255,255,255,0.80);font-size:13px;margin-top:2px">P2P Car Rental</div>
    </div>
    <div style="padding:24px;color:#1f2937;line-height:1.6">
      {body}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #e6dfd6;
                font-size:12px;color:#5b6472">
      CarHop &middot; You're receiving this because you have an account on CarHop.
    </div>
  </div>
</body>
</html>"""


def send_email(to: str, subject: str, body_html: str) -> None:
    """
    Send a single email via SMTP.
    Silently returns if SMTP is not configured.
    Logs (but does not raise) on send errors.
    """
    if not settings.smtp_host or not settings.smtp_user:
        return  # SMTP not configured — skip silently

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password or "")
            server.sendmail(settings.smtp_from, to, msg.as_string())
        logger.info("Email sent to %s — %s", to, subject)
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)


# ── Notification helpers ─────────────────────────────────────────────────────


def notify_booking_requested(
    owner_email: str,
    owner_name: str,
    renter_name: str,
    car: str,
    start: date,
    end: date,
) -> None:
    subject = f"New booking request for your {car}"
    body = f"""
      <h2 style="margin:0 0 12px;font-size:18px">New booking request 🚗</h2>
      <p>Hi <strong>{owner_name}</strong>,</p>
      <p><strong>{renter_name}</strong> has requested to rent your <strong>{car}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr>
          <td style="padding:8px 0;color:#5b6472;font-size:13px">Dates</td>
          <td style="padding:8px 0;font-weight:600">{start} &rarr; {end}</td>
        </tr>
      </table>
      <p>Log in to CarHop to approve or reject this request.</p>
    """
    send_email(owner_email, subject, _wrap(body))


def notify_booking_approved(
    renter_email: str,
    renter_name: str,
    car: str,
    start: date,
    end: date,
) -> None:
    subject = f"Booking confirmed: {car}"
    body = f"""
      <h2 style="margin:0 0 12px;font-size:18px">Your booking is confirmed ✅</h2>
      <p>Hi <strong>{renter_name}</strong>,</p>
      <p>Great news! Your booking for <strong>{car}</strong> has been approved.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr>
          <td style="padding:8px 0;color:#5b6472;font-size:13px">Dates</td>
          <td style="padding:8px 0;font-weight:600">{start} &rarr; {end}</td>
        </tr>
      </table>
      <p>Enjoy your trip!</p>
    """
    send_email(renter_email, subject, _wrap(body))


def notify_booking_rejected(
    renter_email: str,
    renter_name: str,
    car: str,
    start: date,
    end: date,
) -> None:
    subject = f"Booking update: {car}"
    body = f"""
      <h2 style="margin:0 0 12px;font-size:18px">Booking not approved</h2>
      <p>Hi <strong>{renter_name}</strong>,</p>
      <p>Unfortunately, your booking request for <strong>{car}</strong> was not approved
         by the owner.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr>
          <td style="padding:8px 0;color:#5b6472;font-size:13px">Dates</td>
          <td style="padding:8px 0;font-weight:600">{start} &rarr; {end}</td>
        </tr>
      </table>
      <p>Head back to the marketplace to find another available car.</p>
    """
    send_email(renter_email, subject, _wrap(body))


def notify_booking_cancelled(
    owner_email: str,
    owner_name: str,
    renter_name: str,
    car: str,
    start: date,
    end: date,
) -> None:
    subject = f"Booking cancelled: {car}"
    body = f"""
      <h2 style="margin:0 0 12px;font-size:18px">Booking cancelled</h2>
      <p>Hi <strong>{owner_name}</strong>,</p>
      <p><strong>{renter_name}</strong> has cancelled their booking for your
         <strong>{car}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr>
          <td style="padding:8px 0;color:#5b6472;font-size:13px">Dates</td>
          <td style="padding:8px 0;font-weight:600">{start} &rarr; {end}</td>
        </tr>
      </table>
      <p>Those dates are now free again on your listing.</p>
    """
    send_email(owner_email, subject, _wrap(body))


def notify_dispute_opened(
    recipient_email: str,
    recipient_name: str,
    opener_name: str,
    car: str,
    booking_id: int,
) -> None:
    subject = f"Dispute opened on booking #{booking_id}"
    body = f"""
      <h2 style="margin:0 0 12px;font-size:18px">A dispute has been opened</h2>
      <p>Hi <strong>{recipient_name}</strong>,</p>
      <p><strong>{opener_name}</strong> has opened a dispute on your booking for
         <strong>{car}</strong> (booking #{booking_id}).</p>
      <p>Log in to CarHop to view the details. Our team will review and resolve it shortly.</p>
    """
    send_email(recipient_email, subject, _wrap(body))


def notify_dispute_resolved(
    recipient_email: str,
    recipient_name: str,
    resolution: str,
    note: str | None,
    car: str,
    booking_id: int,
) -> None:
    subject = f"Dispute resolved on booking #{booking_id}"
    note_html = f"<p><strong>Resolution note:</strong> {note}</p>" if note else ""
    body = f"""
      <h2 style="margin:0 0 12px;font-size:18px">Dispute resolved</h2>
      <p>Hi <strong>{recipient_name}</strong>,</p>
      <p>The dispute on booking #{booking_id} for <strong>{car}</strong> has been
         <strong>{resolution}</strong> by the CarHop team.</p>
      {note_html}
      <p>If you have further questions, please contact support.</p>
    """
    send_email(recipient_email, subject, _wrap(body))


def notify_payment_received(
    owner_email: str,
    owner_name: str,
    renter_name: str,
    car: str,
    amount: int,
    currency: str,
) -> None:
    subject = f"Escrow payment received for your {car}"
    body = f"""
      <h2 style="margin:0 0 12px;font-size:18px">Escrow payment received</h2>
      <p>Hi <strong>{owner_name}</strong>,</p>
      <p><strong>{renter_name}</strong> has paid <strong>{amount} {currency}</strong>
         into escrow for the rental of <strong>{car}</strong>.</p>
      <p>Funds are held securely and will be released to you after the rental ends.</p>
    """
    send_email(owner_email, subject, _wrap(body))


def notify_escrow_released(
    owner_email: str,
    owner_name: str,
    car: str,
    amount: int,
    currency: str,
) -> None:
    subject = f"Payout released: {car}"
    body = f"""
      <h2 style="margin:0 0 12px;font-size:18px">Your payout has been released</h2>
      <p>Hi <strong>{owner_name}</strong>,</p>
      <p><strong>{amount} {currency}</strong> has been released from escrow to your
         account for the rental of <strong>{car}</strong>.</p>
      <p>Thank you for hosting on CarHop!</p>
    """
    send_email(owner_email, subject, _wrap(body))
