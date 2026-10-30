import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/auth.decorators';
import { TestimonialsService } from './testimonials.service';
import { QueryTestimonialDto } from './dto/query-testimonial.dto';

/** Public, read-only. Only published testimonials are ever returned. */
@ApiTags('Testimonials')
@Public()
@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Get()
  @ApiOperation({ summary: 'List published testimonials (public)' })
  list(@Query() query: QueryTestimonialDto) {
    return this.testimonials.listPublic(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a published testimonial (public)' })
  detail(@Param('id', ParseUUIDPipe) id: string, @Query('locale') locale = 'en') {
    return this.testimonials.findPublic(id, locale);
  }
}
