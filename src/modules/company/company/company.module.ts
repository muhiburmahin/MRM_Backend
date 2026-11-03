import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { AdminCompanyController } from './admin-company.controller';
import { AdminClientsController } from './admin-clients.controller';
import { CompanyService } from './company.service';
import { ClientsService } from './clients.service';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CompanyController, AdminCompanyController, AdminClientsController],
  providers: [CompanyService, ClientsService],
  exports: [CompanyService, ClientsService],
})
export class CompanyModule {}
