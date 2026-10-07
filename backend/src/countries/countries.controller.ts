import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PaginationQueryDto } from '../common/pagination-query.dto';
import { UserRole } from '../users/user-role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { CountriesService } from './countries.service';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

@Controller('countries')
export class CountriesController {
  constructor(private readonly countries: CountriesService) {}
  @Get() findAll(@Query() query: PaginationQueryDto) { return this.countries.findAll(query); }
  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.countries.findOne(id); }
  @Roles(UserRole.ADMIN) @Post() create(@CurrentUser() actor: AuthUser, @Body() dto: CreateCountryDto) { return this.countries.create(dto, actor); }
  @Roles(UserRole.ADMIN) @Patch(':id') update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCountryDto) { return this.countries.update(id, dto, actor); }
  @Roles(UserRole.ADMIN) @Delete(':id') remove(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.countries.remove(id, actor); }
}
