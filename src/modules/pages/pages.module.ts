import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AdminPagesController } from './pages/admin-pages.controller';
import { PagesController } from './pages/pages.controller';
import { PagesService } from './pages/pages.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PagesController, AdminPagesController],
  providers: [PagesService],
})
export class PagesModule {}
