import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PaginationQueryDto } from '../common/pagination-query.dto';
import { UserRole } from '../users/user-role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}
  @Get() findAll(@Query() query: PaginationQueryDto) { return this.companies.findAll(query); }
  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.companies.findOne(id); }
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER) @Post() create(@CurrentUser() actor: AuthUser, @Body() dto: CreateCompanyDto) { return this.companies.create(dto, actor); }
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER) @Patch(':id') update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) { return this.companies.update(id, dto, actor); }
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER) @Delete(':id') remove(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.companies.remove(id, actor); }
}
