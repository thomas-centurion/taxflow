import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { Roles } from '../auth/roles.decorator';
import { ApiErrorResponses, ApiJwtAuth } from '../common/swagger/api-docs.decorators';
import { UserRole } from './user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginatedUsersDto, UserOptionDto, UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';
import { PaginationQueryDto } from '../common/pagination-query.dto';

@ApiTags('Users')
@ApiJwtAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @ApiOperation({ summary: 'Active users (id, name, email) for pickers and filters. Any authenticated role.' })
  @Get('options')
  @ApiOkResponse({ type: [UserOptionDto] })
  findOptions() { return this.users.findOptions(); }

  @ApiOperation({ summary: 'Lists users. `search` matches name or email. ADMIN, TAX_MANAGER.' })
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Get()
  @ApiOkResponse({ type: PaginatedUsersDto })
  @ApiErrorResponses(400, 403)
  findAll(@Query() query: PaginationQueryDto) { return this.users.findAll(query); }

  @ApiOperation({ summary: 'Gets a user. ADMIN, TAX_MANAGER.' })
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Get(':id')
  @ApiOkResponse({ type: UserResponseDto })
  @ApiErrorResponses(400, 403, 404)
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.users.findOne(id); }

  @ApiOperation({ summary: 'Creates a user. ADMIN only.' })
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiErrorResponses(400, 403, [409, 'A user with this email already exists.'])
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto) { return this.users.create(dto, actor); }

  @ApiOperation({ summary: 'Updates the provided fields. ADMIN only.' })
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOkResponse({ type: UserResponseDto })
  @ApiErrorResponses(400, 403, 404, [409, 'Duplicate email, or the change would leave no active ADMIN.'])
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) { return this.users.update(id, dto, actor); }

  @ApiOperation({ summary: 'Deletes a user. ADMIN only.' })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOkResponse({ description: 'Deleted. Empty body.' })
  @ApiErrorResponses(400, 403, 404, [409, 'Own account, last active ADMIN, or the user is still referenced (e.g. uploaded documents).'])
  remove(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.users.remove(id, actor); }
}
