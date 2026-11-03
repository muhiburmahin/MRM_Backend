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
import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { AdminQueryFaqDto } from './dto/query-faq.dto';

@ApiTags('admin / FAQs')
@ApiCookieAuth()
@Controller({ path: 'admin/faqs', version: '1' })
export class AdminFaqsController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  @Permissions('content:read')
  @ApiOperation({ summary: 'List all FAQs, including unpublished entries' })
  list(@Query() query: AdminQueryFaqDto) {
    return this.faqs.listAdmin(query);
  }

  @Get(':id')
  @Permissions('content:read')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.faqs.findOneAdmin(id);
  }

  @Post()
  @Permissions('content:write')
  create(@Body() dto: CreateFaqDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.faqs.create(dto, actor);
  }

  @Patch(':id')
  @Permissions('content:write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFaqDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.faqs.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions('content:delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an FAQ' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.faqs.remove(id);
  }
}
