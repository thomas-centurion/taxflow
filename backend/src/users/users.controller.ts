import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { PaginationQueryDto } from '../common/pagination-query.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  // Available to every authenticated role: responsible-user pickers and filters only need active users' names.
  @Get('options') findOptions() { return this.users.findOptions(); }
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER) @Get() findAll(@Query() query: PaginationQueryDto) { return this.users.findAll(query); }
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER) @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.users.findOne(id); }
  @Roles(UserRole.ADMIN) @Post() create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto) { return this.users.create(dto, actor); }
  @Roles(UserRole.ADMIN) @Patch(':id') update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) { return this.users.update(id, dto, actor); }
  @Roles(UserRole.ADMIN) @Delete(':id') remove(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.users.remove(id, actor); }
}
