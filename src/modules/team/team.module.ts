import { Module } from '@nestjs/common';
import { AdminTeamController } from './admin-team.controller';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

/** Needs PrismaService (global DatabaseModule) and the global guards from AuthModule. */
@Module({
  controllers: [TeamController, AdminTeamController],
  providers: [TeamService],
})
export class TeamModule {}
