import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../auth/decorators/auth.decorators';
import { CareersService } from './careers.service';
import { JobSlugParamDto, QueryJobsDto } from './dto/job-query.dto';
import { ApplyJobDto } from './dto/job-write.dto';
import { PublicJobDetail, PublicJobListItem } from './dto/job-response.dto';

@ApiTags('careers')
@Public()
@Controller({ path: 'careers', version: '1' })
export class CareersController {
  constructor(private readonly careers: CareersService) {}

  @Get()
  @ApiOperation({ summary: 'List open career opportunities (public)' })
  @ApiOkResponse({ type: [PublicJobListItem] })
  list(@Query() query: QueryJobsDto) {
    return this.careers.listPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get open career opportunity details by slug (public)' })
  @ApiOkResponse({ type: PublicJobDetail })
  @ApiNotFoundResponse({ description: 'Job not found or closed' })
  get(@Param() params: JobSlugParamDto, @Query('locale') locale?: string) {
    return this.careers.getBySlugPublic(params.slug, locale);
  }

  @Post(':slug/apply')
  @ApiOperation({ summary: 'Apply for an open career opportunity (public)' })
  @ApiCreatedResponse({ description: 'Application submitted successfully' })
  @ApiBadRequestResponse({ description: 'Consent missing or invalid input' })
  @ApiNotFoundResponse({ description: 'Job not found or closed' })
  apply(@Param() params: JobSlugParamDto, @Body() dto: ApplyJobDto) {
    return this.careers.apply(params.slug, dto);
  }
}

