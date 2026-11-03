import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { TestimonialsService } from './testimonials.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { AdminQueryTestimonialDto } from './dto/query-testimonial.dto';

@ApiTags('admin / testimonials')
@ApiCookieAuth()
@Controller({ path: 'admin/testimonials', version: '1' })
export class AdminTestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Get()
  @Permissions('content:read')
  @ApiOperation({ summary: 'List all testimonials, including unverified and private entries' })
  list(@Query() query: AdminQueryTestimonialDto) {
    return this.testimonials.listAdmin(query);
  }

  @Get(':id')
  @Permissions('content:read')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.testimonials.findOneAdmin(id);
  }

  @Post()
  @Permissions('content:write')
  create(@Body() dto: CreateTestimonialDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.testimonials.create(dto, actor);
  }

  @Patch(':id')
  @Permissions('content:write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTestimonialDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.testimonials.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions('content:delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a testimonial' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.testimonials.remove(id);
  }
}
