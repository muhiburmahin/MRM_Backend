import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { MailConfig, mailConfig } from './mail.config';
import { MAIL_TRANSPORT, MailTransport } from './mail-transport.interface';

export interface LeadNotificationPayload {
  ref: string;
  name: string;
  email: string;
  phone?: string | null;
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
   * Safe execution: Never throws an error if email transport is disabled or fails.
   */
  async notifyNewLead(lead: LeadNotificationPayload): Promise<boolean> {
    if (!this.cfg.enabled) {
      this.logger.debug(`Mail disabled; skipping lead notification for ref=${lead.ref}`);
      return false;
    }

    if (!this.cfg.notifyRecipient) {
      this.logger.warn(`No notification recipient configured (MAIL_NOTIFY_RECIPIENT missing)`);
      return false;
    }

    const subject = `[MRM Lead Alert] New Inquiry Received (${lead.ref})`;
    const text = [
      `A new inquiry has been submitted on the MRM InfoTech website.`,
      ``,
      `Reference: ${lead.ref}`,
      `Type: ${lead.type}`,
      `Name: ${lead.name}`,
      `Email: ${lead.email}`,
      `Phone: ${lead.phone || 'N/A'}`,
      ``,
      `Message:`,
      `${lead.message}`,
      ``,
      `Please review and follow up in the MRM Admin Console.`,
    ].join('\n');

    return this.safeSend(
      {
        to: this.cfg.notifyRecipient,
        subject,
        text,
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

    const subject = `Thank you for contacting MRM InfoTech [Ref: ${customer.ref}]`;
    const text = [
      `Dear ${customer.name},`,
      ``,
      `Thank you for reaching out to MRM InfoTech. We have received your inquiry.`,
      ``,
      `Your reference ID is: ${customer.ref}`,
      ``,
      `Our team will review your message and get back to you shortly.`,
      ``,
      `Best regards,`,
      `MRM InfoTech Team`,
      `https://mrminfotech.com`,
    ].join('\n');

    return this.safeSend(
      {
        to: customer.email,
        subject,
        text,
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
    options: { to: string; subject: string; text: string; replyTo?: string },
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
