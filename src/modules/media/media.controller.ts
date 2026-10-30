import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { MediaService } from './media.service';
import { QueryMediaDto } from './dto/query-media.dto';
import { UploadMediaDto } from './dto/upload-media.dto';

@ApiTags('admin / media')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in' })
@ApiForbiddenResponse({ description: 'Missing media permission' })
@Controller({ path: 'admin/media', version: '1' })
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @Permissions('media:upload')
  @ApiOperation({
    summary: 'Register media metadata after storage by the configured storage pipeline',
  })
  @ApiCreatedResponse()
  create(@Body() dto: UploadMediaDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.mediaService.create(dto, actor);
  }

  @Get()
  @Permissions('media:upload')
  @ApiOperation({ summary: 'List media assets (paginated)' })
  findAll(@Query() query: QueryMediaDto) {
    return this.mediaService.findAll(query);
  }

  @Get(':id')
  @Permissions('media:upload')
  @ApiOperation({ summary: 'Get media metadata' })
  @ApiNotFoundResponse()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.findOne(id);
  }

  @Delete(':id')
  @Permissions('media:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a media asset metadata record (does not delete provider-stored bytes)',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.mediaService.remove(id, actor);
  }
}
