import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Permissions } from '../../../auth/decorators/auth.decorators';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@ApiTags('admin / clients')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in' })
@Controller({ path: 'admin/clients', version: '1' })
export class AdminClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @Permissions('casestudy:read')
  @ApiOperation({ summary: 'List all clients' })
  list() {
    return this.clients.list();
  }

  @Get(':id')
  @Permissions('casestudy:read')
  @ApiOperation({ summary: 'Get client details by ID' })
  @ApiNotFoundResponse({ description: 'Client not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.findOne(id);
  }

  @Post()
  @Permissions('casestudy:write')
  @ApiOperation({ summary: 'Create a new client record' })
  create(@Body() dto: CreateClientDto) {
    return this.clients.create(dto);
  }

  @Put(':id')
  @Permissions('casestudy:write')
  @ApiOperation({ summary: 'Update an existing client' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(id, dto);
  }

  @Delete(':id')
  @Permissions('casestudy:delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a client' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.remove(id);
  }
}
