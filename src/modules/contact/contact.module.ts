import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { AdminLeadsController } from './admin-leads.controller';
import { ContactService } from './contact.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ContactController, AdminLeadsController],
  providers: [ContactService],
})
export class ContactModule {}
