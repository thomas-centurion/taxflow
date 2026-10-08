import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { PaginationQueryDto } from '../common/pagination-query.dto';
import { ApiErrorResponses, ApiJwtAuth } from '../common/swagger/api-docs.decorators';
import { UserRole } from '../users/user-role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { CompaniesService } from './companies.service';
import { CompanyResponseDto, PaginatedCompaniesDto } from './dto/company-response.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Companies')
@ApiJwtAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @ApiOperation({ summary: 'Lists companies. `search` matches name, tax ID or email.' })
  @Get()
  @ApiOkResponse({ type: PaginatedCompaniesDto })
  @ApiErrorResponses(400)
  findAll(@Query() query: PaginationQueryDto) { return this.companies.findAll(query); }

  @ApiOperation({ summary: 'Gets a company.' })
  @Get(':id')
  @ApiOkResponse({ type: CompanyResponseDto })
  @ApiErrorResponses(400, 404)
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.companies.findOne(id); }

  @ApiOperation({ summary: 'Creates a company. ADMIN, TAX_MANAGER.' })
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Post()
  @ApiCreatedResponse({ type: CompanyResponseDto })
  @ApiErrorResponses(400, 403, [404, 'The country does not exist.'], [409, 'A company with this tax ID already exists in the country.'])
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateCompanyDto) { return this.companies.create(dto, actor); }

  @ApiOperation({ summary: 'Updates the provided fields. ADMIN, TAX_MANAGER.' })
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Patch(':id')
  @ApiOkResponse({ type: CompanyResponseDto })
  @ApiErrorResponses(400, 403, 404, [409, 'Duplicate tax ID in the country, or the country of a company with tax obligations cannot change.'])
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) { return this.companies.update(id, dto, actor); }

  @ApiOperation({ summary: 'Deletes a company without obligations or documents. ADMIN, TAX_MANAGER.' })
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Delete(':id')
  @ApiOkResponse({ description: 'Deleted. Empty body.' })
  @ApiErrorResponses(400, 403, 404, [409, 'The company is still referenced by tax obligations or documents.'])
  remove(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.companies.remove(id, actor); }
}
