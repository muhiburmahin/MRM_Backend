import { Inject, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { MailConfig, mailConfig } from './mail.config';
import { MailTransport, SendMailOptions } from './mail-transport.interface';

@Injectable()
export class NodemailerTransport implements MailTransport {
  private readonly logger = new Logger(NodemailerTransport.name);
  private transporter: Transporter | null = null;
  private warnedNoPassword = false;

  constructor(@Inject(mailConfig.KEY) private readonly cfg: MailConfig) {
    this.initTransporter();
  }

  private initTransporter(): void {
    const { smtp, enabled } = this.cfg;
    if (!enabled) {
      this.logger.log('Email delivery is currently disabled (MAIL_ENABLED=false). Emails will run in dry-run mode.');
      return;
    }

    if (!smtp.user || !smtp.pass) {
      this.logger.warn(
        'SMTP credentials not fully configured (SMTP_USER or SMTP_PASSWORD is empty). Outgoing emails will be logged in dry-run mode until SMTP credentials are provided.',
      );
      return;
    }

    try {
      const isGmail = smtp.host.includes('gmail.com') || smtp.user.includes('@gmail.com');

      if (isGmail && (!smtp.host || smtp.host === 'smtp.gmail.com')) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: smtp.user,
            pass: smtp.pass,
          },
          pool: true,
          maxConnections: 3,
          maxMessages: 100,
        });
      } else {
        this.transporter = nodemailer.createTransport({
          host: smtp.host || 'smtp.gmail.com',
          port: smtp.port || 465,
          secure: smtp.secure ?? (smtp.port === 465),
          auth: {
            user: smtp.user,
            pass: smtp.pass,
          },
          pool: true,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
        });
      }

      this.logger.log(`Nodemailer transport initialized for host=${smtp.host || 'gmail'} user=${smtp.user}`);
    } catch (err) {
      this.logger.error(`Failed to initialize Nodemailer transporter: ${(err as Error).message}`);
      this.transporter = null;
    }
  }

  async send(options: SendMailOptions): Promise<boolean> {
    const { enabled, from, smtp } = this.cfg;

    if (!enabled) {
      this.logger.debug(`[DRY-RUN Mail] To: ${options.to} | Subject: ${options.subject}`);
      return true;
    }

    // Re-check transporter if credentials were added or transporter not yet created
    if (!this.transporter && smtp.user && smtp.pass) {
      this.initTransporter();
    }

    if (!this.transporter) {
      if (!this.warnedNoPassword) {
        this.logger.warn(
          `[Mail Delivery Standby] Email to <${options.to}> simulated. To deliver live emails to ${options.to}, set SMTP_PASSWORD in your .env file.`,
        );
        this.warnedNoPassword = true;
      }
      this.logger.log(`[DRY-RUN Mail] To: ${options.to} | Subject: ${options.subject}`);
      return true;
    }

    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: from || 'MRM InfoTech <contact.mrminfotech@gmail.com>',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email successfully delivered to <${options.to}> [MessageId: ${info.messageId}]`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to <${options.to}>: ${(err as Error).message}`);
      return false;
    }
  }
}

