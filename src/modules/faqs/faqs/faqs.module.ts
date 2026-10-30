import { Module } from '@nestjs/common';
import { FaqsController } from './faqs.controller';
import { AdminFaqsController } from './admin-faqs.controller';
import { FaqsService } from './faqs.service';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FaqsController, AdminFaqsController],
  providers: [FaqsService],
})
export class FaqsModule {}
