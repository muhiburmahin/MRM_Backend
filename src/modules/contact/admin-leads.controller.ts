import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ContactService } from './contact.service';
import { QueryContactDto } from './dto/query-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@ApiTags('admin / leads')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in' })
@ApiForbiddenResponse({ description: 'Missing lead permission' })
@Controller({ path: 'admin/leads', version: '1' })
export class AdminLeadsController {
  constructor(private readonly leads: ContactService) {}

  @Get()
  @Permissions('lead:read')
  @ApiOperation({ summary: 'List leads, newest first' })
  list(@Query() query: QueryContactDto) {
    return this.leads.findAll(query);
  }

  @Get(':id')
  @Permissions('lead:read')
  @ApiOperation({ summary: 'Get lead details and internal notes' })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.findOne(id);
  }

  @Patch(':id')
  @Permissions('lead:write')
  @ApiOperation({ summary: 'Update lead status or assignee, optionally adding an internal note' })
  @ApiNotFoundResponse()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.leads.update(id, dto, actor);
  }

  @Delete(':id')
  @Permissions('lead:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a lead' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.leads.remove(id, actor);
  }
}
