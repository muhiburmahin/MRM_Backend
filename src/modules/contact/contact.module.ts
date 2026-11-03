import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { AdminLeadsController } from './admin-leads.controller';
import { ContactService } from './contact.service';
import { DatabaseModule } from '../../database/database.module';
import { MailModule } from '../../common/mail/mail.module';

@Module({
  imports: [DatabaseModule, MailModule],
  controllers: [ContactController, AdminLeadsController],
  providers: [ContactService],
})
export class ContactModule {}
