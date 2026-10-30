import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/auth.decorators';
import { CompanyService } from './company.service';

/** Public, read-only. */
@ApiTags('Company')
@Public()
@Controller('company')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  @Get()
  @ApiOperation({ summary: 'Get the public company profile (public)' })
  get() {
    return this.company.getPublic();
  }
}
