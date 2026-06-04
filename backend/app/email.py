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
