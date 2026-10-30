import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Company (admin)')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Not signed in' })
@ApiForbiddenResponse({ description: 'Missing settings:write permission' })
@Controller({ path: 'admin/company', version: '1' })
export class AdminCompanyController {
  constructor(private readonly company: CompanyService) {}

  @Get()
  @Permissions('settings:write')
  @ApiOperation({ summary: 'Get the full company profile (admin)' })
  @ApiNotFoundResponse()
  get() {
    return this.company.getAdmin();
  }

  @Patch()
  @Permissions('settings:write')
  @ApiOperation({
    summary: 'Create (first time, name required) or update the company profile (admin)',
  })
  @ApiBadRequestResponse()
  update(@Body() dto: UpdateCompanyDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.company.save(dto, actor);
  }
}
