import { Module } from '@nestjs/common';
import { BlogController } from './blog.controller';
import { AdminBlogController } from './admin-blog.controller';
import { BlogService } from './blog.service';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BlogController, AdminBlogController],
  providers: [BlogService],
})
export class BlogModule {}
