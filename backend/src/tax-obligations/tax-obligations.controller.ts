import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { ApiErrorResponses, ApiJwtAuth } from '../common/swagger/api-docs.decorators';
import { UserRole } from '../users/user-role.enum';
import { CreateTaxObligationDto } from './dto/create-tax-obligation.dto';
import { TaxObligationQueryDto } from './dto/tax-obligation-query.dto';
import { PaginatedTaxObligationsDto, TaxObligationResponseDto } from './dto/tax-obligation-response.dto';
import { UpdateTaxObligationDto } from './dto/update-tax-obligation.dto';
import { TaxObligationsService } from './tax-obligations.service';

const INVALID_STATUS = 'Invalid status transition or status/due date combination (e.g. OVERDUE with a future due date).';

@ApiTags('Tax Obligations')
@ApiJwtAuth()
@Controller('tax-obligations')
export class TaxObligationsController {
  constructor(private readonly obligations: TaxObligationsService) {}

  @ApiOperation({ summary: 'Lists obligations ordered by due date, with optional filters. `search` matches the obligation or company name.' })
  @Get()
  @ApiOkResponse({ type: PaginatedTaxObligationsDto })
  @ApiErrorResponses(400)
  findAll(@Query() query: TaxObligationQueryDto) { return this.obligations.findAll(query); }

  @ApiOperation({ summary: 'Gets an obligation with its company, country and responsible user.' })
  @Get(':id')
  @ApiOkResponse({ type: TaxObligationResponseDto })
  @ApiErrorResponses(400, 404)
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.obligations.findOne(id); }

  @ApiOperation({ summary: 'Creates an obligation (status defaults to PENDING). ADMIN, TAX_MANAGER.' })
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Post()
  @ApiCreatedResponse({ type: TaxObligationResponseDto })
  @ApiErrorResponses([400, 'Validation failed, or the country does not match the company country.'], 403, [404, 'Company or active responsible user not found.'], [409, INVALID_STATUS])
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateTaxObligationDto) { return this.obligations.create(dto, actor); }

  @ApiOperation({ summary: 'Updates the provided fields. Status changes follow the allowed transitions. ADMIN, TAX_MANAGER.' })
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Patch(':id')
  @ApiOkResponse({ type: TaxObligationResponseDto })
  @ApiErrorResponses([400, 'Validation failed, or the country does not match the company country.'], 403, [404, 'Obligation, company or active responsible user not found.'], [409, INVALID_STATUS])
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaxObligationDto) { return this.obligations.update(id, dto, actor); }

  @ApiOperation({ summary: 'Deletes an obligation without documents. ADMIN, TAX_MANAGER.' })
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Delete(':id')
  @ApiOkResponse({ description: 'Deleted. Empty body.' })
  @ApiErrorResponses(400, 403, 404, [409, 'Delete the associated documents first.'])
  remove(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.obligations.remove(id, actor); }
}
