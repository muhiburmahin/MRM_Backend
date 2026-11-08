import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { mailConfig } from './mail.config';
import { MailService } from './mail.service';
import { MAIL_TRANSPORT } from './mail-transport.interface';
import { NodemailerTransport } from './nodemailer.transport';

@Module({
  imports: [ConfigModule.forFeature(mailConfig)],
  providers: [
    NodemailerTransport,
    {
      provide: MAIL_TRANSPORT,
      useExisting: NodemailerTransport,
    },
    MailService,
  ],
  exports: [MailService, NodemailerTransport, MAIL_TRANSPORT],
})
export class MailModule {}
