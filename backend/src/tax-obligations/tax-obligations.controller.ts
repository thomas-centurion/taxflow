import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { UserRole } from '../users/user-role.enum';
import { CreateTaxObligationDto } from './dto/create-tax-obligation.dto';
import { TaxObligationQueryDto } from './dto/tax-obligation-query.dto';
import { UpdateTaxObligationDto } from './dto/update-tax-obligation.dto';
import { TaxObligationsService } from './tax-obligations.service';

@Controller('tax-obligations')
export class TaxObligationsController {
  constructor(private readonly obligations: TaxObligationsService) {}
  @Get() findAll(@Query() query: TaxObligationQueryDto) { return this.obligations.findAll(query); }
  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.obligations.findOne(id); }
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER) @Post() create(@CurrentUser() actor: AuthUser, @Body() dto: CreateTaxObligationDto) { return this.obligations.create(dto, actor); }
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER) @Patch(':id') update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaxObligationDto) { return this.obligations.update(id, dto, actor); }
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER) @Delete(':id') remove(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.obligations.remove(id, actor); }
}
