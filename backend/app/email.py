import html
import logging

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from .config import get_settings

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    settings = get_settings()

    if not settings.sendgrid_api_key:
        logger.warning("SENDGRID_API_KEY not set — password reset link: %s", reset_url)
        return

    message = Mail(
        from_email=settings.sender_email,
        to_emails=to_email,
        subject="Reset your five* password",
        html_content=f"""
        <p>Hi,</p>
        <p>We received a request to reset your five* password. Click the link below to choose a new one:</p>
        <p><a href="{reset_url}">{reset_url}</a></p>
        <p>This link expires in 1 hour. If you didn't request a reset, you can ignore this email.</p>
        <p>— The five* team</p>
        """,
    )

    try:
        client = SendGridAPIClient(settings.sendgrid_api_key)
        client.send(message)
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
        raise


# Two emails: the business existed in five* (claimed or not) or it didn't.
FOUND_STATUS = {
    "claimed": "Claimed — the business already sees this in five*.",
    "unclaimed": "Not claimed yet — nobody at the business sees this; deliver it by hand.",
}


def send_claim_notification(
    *,
    listed: bool = True,
    business_name: str,
    business_address: str | None,
    contact_name: str,
    contact_role: str | None,
    contact_email: str,
    contact_phone: str,
    message: str | None,
) -> None:
    """Tell the team inbox someone wants to claim a directory business.

    Background task after the claim is saved; failures are logged, not raised.
    """
    settings = get_settings()
    if listed:
        subject = f"[five*] Claim request: {business_name}"
        intro = "Someone says they run this business and wants to claim it on five*. Reply to reach them."
    else:
        subject = f"[five*] Add my business: {business_name}"
        intro = "Someone runs a business that isn't in five*'s directory and wants it listed. Reply to reach them."
    if not settings.sendgrid_api_key or not settings.feedback_notify_email:
        logger.warning("Email not configured — %s | %s <%s> %s", subject, contact_name, contact_email, contact_phone)
        return

    e = html.escape
    who = contact_name + (f" ({contact_role})" if contact_role else "")
    body = f"""
        <p>{e(intro)}</p>
        <p><strong>Business:</strong> {e(business_name)}<br>
        <strong>Address:</strong> {e(business_address or "—")}</p>
        <p><strong>Contact:</strong> {e(who)}<br>
        <strong>Email:</strong> {e(contact_email)}<br>
        <strong>Phone:</strong> {e(contact_phone)}</p>
        """
    if message:
        body += f'<blockquote style="white-space: pre-wrap">{e(message)}</blockquote>'
    mail = Mail(
        from_email=settings.sender_email,
        to_emails=settings.feedback_notify_email,
        subject=subject,
        html_content=body,
    )
    mail.reply_to = contact_email

    try:
        SendGridAPIClient(settings.sendgrid_api_key).send(mail)
    except Exception:
        logger.exception("Failed to send claim notification for %s", business_name)


def send_feedback_notification(
    *,
    kind: str,
    business_name: str,
    location: str | None,
    content: str,
    submitter_name: str | None,
    submitter_email: str | None,
) -> None:
    """Copy a feedback submission to the team inbox (settings.feedback_notify_email).

    Runs as a background task after the feedback is saved, so a send failure is
    logged rather than raised - the submission itself is never lost.
    """
    settings = get_settings()
    if kind == "not_found":
        subject = f"[five*] Business not found: {business_name}"
        intro = "Someone couldn't find this business in search and told us about it."
        status_line = "Not in five* — find the business and deliver it by hand."
    else:
        subject = f"[five*] Feedback: {business_name}"
        intro = "New feedback for a business in five*."
        status_line = FOUND_STATUS[kind]
    if not settings.sendgrid_api_key or not settings.feedback_notify_email:
        logger.warning("Email not configured — %s | %s | %s", subject, location, content)
        return

    e = html.escape
    sender = " ".join(p for p in (submitter_name, submitter_email) if p) or "Anonymous"
    message = Mail(
        from_email=settings.sender_email,
        to_emails=settings.feedback_notify_email,
        subject=subject,
        html_content=f"""
        <p>{e(intro)}</p>
        <p><strong>Business:</strong> {e(business_name)}<br>
        <strong>Location:</strong> {e(location or "—")}<br>
        <strong>Status:</strong> {e(status_line)}<br>
        <strong>From:</strong> {e(sender)}</p>
        <blockquote style="white-space: pre-wrap">{e(content)}</blockquote>
        """,
    )
    if submitter_email:
        message.reply_to = submitter_email

    try:
        SendGridAPIClient(settings.sendgrid_api_key).send(message)
    except Exception:
        logger.exception("Failed to send feedback notification for %s", business_name)
