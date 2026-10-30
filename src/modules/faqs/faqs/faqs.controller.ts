import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/auth.decorators';
import { FaqsService } from './faqs.service';
import { QueryFaqDto } from './dto/query-faq.dto';

/** Public, read-only. Only published FAQs are ever returned. */
@ApiTags('FAQs')
@Public()
@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  @ApiOperation({ summary: 'List published FAQs (public)' })
  list(@Query() query: QueryFaqDto) {
    return this.faqs.listPublic(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a published FAQ (public)' })
  detail(@Param('id', ParseUUIDPipe) id: string, @Query('locale') locale = 'en') {
    return this.faqs.findPublic(id, locale);
  }
}
