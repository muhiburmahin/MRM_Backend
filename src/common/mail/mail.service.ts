import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { MailConfig, mailConfig } from './mail.config';
import { MAIL_TRANSPORT, MailTransport } from './mail-transport.interface';

export interface LeadNotificationPayload {
  ref: string;
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  company?: string | null;
  message: string;
  type: string;
}

export interface CustomerConfirmationPayload {
  ref: string;
  name: string;
  email: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(mailConfig.KEY) private readonly cfg: MailConfig,
    @Optional() @Inject(MAIL_TRANSPORT) private readonly transport?: MailTransport,
  ) {}

  /**
   * Notifies company sales / admin of a newly submitted lead or inquiry.
   * Dispatches directly to contact.mrminfotech@gmail.com (or configured recipient).
   * Safe execution: Never throws an error if email transport is disabled or fails.
   */
  async notifyNewLead(lead: LeadNotificationPayload): Promise<boolean> {
    if (!this.cfg.enabled) {
      this.logger.debug(`Mail disabled; skipping lead notification for ref=${lead.ref}`);
      return false;
    }

    const recipient = this.cfg.notifyRecipient;
    if (!recipient) {
      this.logger.warn(`No notification recipient configured; skipping lead alert for ref=${lead.ref}`);
      return false;
    }
    const subject = `[MRM Inquiry Alert] ${lead.name} (${lead.ref}) — ${lead.subject || lead.type}`;

    const text = [
      `MRM InfoTech — New Direct Message Inquiry`,
      `==========================================`,
      ``,
      `Reference Tracking ID: ${lead.ref}`,
      `Submission Type: ${lead.type}`,
      `Sender Name: ${lead.name}`,
      `Corporate Email: ${lead.email}`,
      `Phone Number: ${lead.phone || 'Not provided'}`,
      ...(lead.company ? [`Company / Organization: ${lead.company}`] : []),
      ...(lead.subject ? [`Subject: ${lead.subject}`] : []),
      ``,
      `Message Details:`,
      `----------------`,
      lead.message,
      ``,
      `==========================================`,
      `You can reply directly to this email to contact ${lead.name} (${lead.email}).`,
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Website Inquiry</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #07162C; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0B1E3B; border: 1px solid #1E3557; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
    <div style="background: linear-gradient(135deg, #087FC4 0%, #20B8D5 100%); padding: 24px; text-align: left;">
      <h1 style="margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">MRM InfoTech</h1>
      <p style="margin: 4px 0 0; color: rgba(255,255,255,0.9); font-size: 13px;">New Website Contact Inquiry Alert</p>
    </div>

    <div style="padding: 24px;">
      <div style="margin-bottom: 20px;">
        <span style="display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: rgba(8, 127, 196, 0.15); color: #20B8D5; border: 1px solid rgba(8, 127, 196, 0.3);">
          Tracking Reference: ${lead.ref}
        </span>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 0; font-size: 12px; color: #94A3B8; width: 140px; font-weight: 700; text-transform: uppercase;">Sender Name:</td>
          <td style="padding: 8px 0; font-size: 14px; color: #FFFFFF; font-weight: 600;">${escapeHtml(lead.name)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 12px; color: #94A3B8; font-weight: 700; text-transform: uppercase;">Corporate Email:</td>
          <td style="padding: 8px 0; font-size: 14px; color: #20B8D5; font-weight: 600;">
            <a href="mailto:${escapeHtml(lead.email)}" style="color: #20B8D5; text-decoration: none;">${escapeHtml(lead.email)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 12px; color: #94A3B8; font-weight: 700; text-transform: uppercase;">Phone Number:</td>
          <td style="padding: 8px 0; font-size: 14px; color: #FFFFFF; font-weight: 600;">${escapeHtml(lead.phone || 'Not provided')}</td>
        </tr>
        ${
          lead.company
            ? `<tr>
          <td style="padding: 8px 0; font-size: 12px; color: #94A3B8; font-weight: 700; text-transform: uppercase;">Company:</td>
          <td style="padding: 8px 0; font-size: 14px; color: #FFFFFF; font-weight: 600;">${escapeHtml(lead.company)}</td>
        </tr>`
            : ''
        }
        ${
          lead.subject
            ? `<tr>
          <td style="padding: 8px 0; font-size: 12px; color: #94A3B8; font-weight: 700; text-transform: uppercase;">Subject:</td>
          <td style="padding: 8px 0; font-size: 14px; color: #FFFFFF; font-weight: 600;">${escapeHtml(lead.subject)}</td>
        </tr>`
            : ''
        }
      </table>

      <div style="font-size: 12px; color: #94A3B8; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">
        Inquiry Message:
      </div>
      <div style="background-color: #07162C; border-left: 4px solid #20B8D5; padding: 16px; border-radius: 8px; font-size: 13px; line-height: 1.6; color: #E2E8F0; white-space: pre-wrap;">
${escapeHtml(lead.message)}
      </div>

      <div style="margin-top: 24px; text-align: left;">
        <a href="mailto:${escapeHtml(lead.email)}?subject=Re: Inquiry [${encodeURIComponent(lead.ref)}]" style="display: inline-block; background: linear-gradient(135deg, #087FC4 0%, #20B8D5 100%); color: #FFFFFF; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-weight: 700;">
          Reply Directly to ${escapeHtml(lead.name)}
        </a>
      </div>
    </div>

    <div style="padding: 16px 24px; background-color: #061325; border-top: 1px solid #1E3557; font-size: 11px; color: #64748B; text-align: center;">
      Dispatched by MRM InfoTech Leads Management System &bull; https://mrminfotech.com
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.safeSend(
      {
        to: recipient,
        subject,
        text,
        html,
        replyTo: lead.email,
      },
      lead.ref,
    );
  }

  /**
   * Sends an automated acknowledgment email to the customer who submitted an inquiry.
   * Safe execution: Never throws.
   */
  async sendCustomerConfirmation(customer: CustomerConfirmationPayload): Promise<boolean> {
    if (!this.cfg.enabled) {
      return false;
    }

    const subject = `Inquiry Acknowledgment [Ref: ${customer.ref}] — MRM InfoTech`;
    const text = [
      `Dear ${customer.name},`,
      ``,
      `Thank you for reaching out to MRM InfoTech. We have received your inquiry.`,
      ``,
      `Your reference ID is: ${customer.ref}`,
      ``,
      `Our team will review your requirements and follow up with you within 24 business hours.`,
      ``,
      `Best regards,`,
      `MRM InfoTech Team`,
      `https://mrminfotech.com`,
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Inquiry Acknowledgment</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #07162C; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #E2E8F0;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #0B1E3B; border: 1px solid #1E3557; border-radius: 14px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #087FC4 0%, #20B8D5 100%); padding: 20px; text-align: left;">
      <h2 style="margin: 0; color: #FFFFFF; font-size: 18px; font-weight: 800;">MRM InfoTech</h2>
    </div>
    <div style="padding: 24px; font-size: 13px; line-height: 1.6; color: #CBD5E1;">
      <p style="margin-top: 0;">Dear <strong>${escapeHtml(customer.name)}</strong>,</p>
      <p>Thank you for contacting MRM InfoTech. We have successfully logged your inquiry in our system.</p>
      <div style="background: #07162C; border: 1px solid #1E3557; border-radius: 8px; padding: 12px; margin: 16px 0; text-align: center;">
        <span style="font-size: 11px; color: #94A3B8; text-transform: uppercase; font-weight: 700; display: block;">Tracking Reference ID</span>
        <code style="font-size: 16px; color: #20B8D5; font-weight: 800; font-family: monospace;">${escapeHtml(customer.ref)}</code>
      </div>
      <p>Our engineering team will review your specifications and follow up within 24 business hours.</p>
      <p style="margin-bottom: 0;">Warm regards,<br><strong style="color: #FFFFFF;">MRM InfoTech Team</strong><br><a href="https://mrminfotech.com" style="color: #20B8D5; text-decoration: none;">https://mrminfotech.com</a></p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.safeSend(
      {
        to: customer.email,
        subject,
        text,
        html,
      },
      customer.ref,
    );
  }

  /**
   * Sends a password reset token to the requested user.
   * Safe execution: Never throws.
   */
  async sendPasswordResetEmail(email: string, token: string, name?: string): Promise<boolean> {
    if (!this.cfg.enabled) {
      this.logger.debug(`Mail disabled; skipping password reset email to ${email}`);
      return false;
    }

    const subject = `Reset Your MRM InfoTech Password`;
    const text = [
      `Hello ${name || 'User'},`,
      ``,
      `A request has been made to reset the password for your MRM InfoTech account.`,
      ``,
      `Your password reset token is:`,
      `${token}`,
      ``,
      `This token is valid for 30 minutes. If you did not request a password reset, you can safely ignore this email.`,
      ``,
      `Best regards,`,
      `MRM InfoTech Security Team`,
    ].join('\n');

    return this.safeSend(
      {
        to: email,
        subject,
        text,
      },
      `reset-${Date.now()}`,
    );
  }

  private async safeSend(
    options: { to: string; subject: string; text: string; html?: string; replyTo?: string },
    ref: string,
  ): Promise<boolean> {
    try {
      if (!this.transport) {
        this.logger.log(
          `[DRY-RUN Mail] To: ${options.to} | Subject: ${options.subject} | Ref: ${ref}`,
        );
        return true;
      }
      return await this.transport.send(options);
    } catch (err) {
      this.logger.warn(`Failed to dispatch email for ref=${ref}: ${(err as Error).message}`);
      return false;
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
