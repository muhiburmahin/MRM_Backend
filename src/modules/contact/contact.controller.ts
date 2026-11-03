import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/auth.decorators';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { StartProjectDto } from './dto/start-project.dto';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Submit a contact message with explicit consent (public)' })
  @ApiCreatedResponse()
  create(@Body() dto: CreateContactDto) {
    return this.contactService.create(dto);
  }

  @Post('start-project')
  @Public()
  @ApiOperation({ summary: 'Submit a new project inquiry with qualification details (public)' })
  @ApiCreatedResponse()
  startProject(@Body() dto: StartProjectDto) {
    return this.contactService.createProjectLead(dto);
  }
}
