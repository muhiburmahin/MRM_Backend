import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MailModule } from '../../common/mail/mail.module';
import { CareersController } from './careers.controller';
import { AdminCareersController } from './admin-careers.controller';
import { CareersService } from './careers.service';

@Module({
  imports: [DatabaseModule, MailModule],
  controllers: [CareersController, AdminCareersController],
  providers: [CareersService],
  exports: [CareersService],
})
export class CareersModule {}
