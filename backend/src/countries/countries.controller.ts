import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { PaginationQueryDto } from '../common/pagination-query.dto';
import { ApiErrorResponses, ApiJwtAuth } from '../common/swagger/api-docs.decorators';
import { UserRole } from '../users/user-role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { CountriesService } from './countries.service';
import { CountryResponseDto, PaginatedCountriesDto } from './dto/country-response.dto';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

@ApiTags('Countries')
@ApiJwtAuth()
@Controller('countries')
export class CountriesController {
  constructor(private readonly countries: CountriesService) {}

  @ApiOperation({ summary: 'Lists countries. `search` matches name or code.' })
  @Get()
  @ApiOkResponse({ type: PaginatedCountriesDto })
  @ApiErrorResponses(400)
  findAll(@Query() query: PaginationQueryDto) { return this.countries.findAll(query); }

  @ApiOperation({ summary: 'Gets a country.' })
  @Get(':id')
  @ApiOkResponse({ type: CountryResponseDto })
  @ApiErrorResponses(400, 404)
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.countries.findOne(id); }

  @ApiOperation({ summary: 'Creates a country. ADMIN only.' })
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiCreatedResponse({ type: CountryResponseDto })
  @ApiErrorResponses(400, 403, [409, 'A country with this code already exists.'])
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateCountryDto) { return this.countries.create(dto, actor); }

  @ApiOperation({ summary: 'Updates the provided fields. ADMIN only.' })
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOkResponse({ type: CountryResponseDto })
  @ApiErrorResponses(400, 403, 404, [409, 'A country with this code already exists.'])
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCountryDto) { return this.countries.update(id, dto, actor); }

  @ApiOperation({ summary: 'Deletes a country without companies or obligations. ADMIN only.' })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOkResponse({ description: 'Deleted. Empty body.' })
  @ApiErrorResponses(400, 403, 404, [409, 'The country is still referenced by companies or tax obligations.'])
  remove(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.countries.remove(id, actor); }
}
