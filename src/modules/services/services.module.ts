import { Module } from '@nestjs/common';
import { AdminServicesController } from './admin-services.controller';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

/** Needs PrismaService (global DatabaseModule) and the global guards from AuthModule. */
@Module({
  controllers: [ServicesController, AdminServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
