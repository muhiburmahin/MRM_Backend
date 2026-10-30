import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AdminNavigationController } from './navigation/admin-navigation.controller';
import { NavigationService } from './navigation/navigation.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminNavigationController],
  providers: [NavigationService],
})
export class NavigationModule {}
