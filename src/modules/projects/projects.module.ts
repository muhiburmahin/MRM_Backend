import { Module } from '@nestjs/common';
import { AdminProjectsController } from './admin-projects.controller';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

/** Needs PrismaService (global DatabaseModule) and the global guards from AuthModule. */
@Module({
  controllers: [ProjectsController, AdminProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
