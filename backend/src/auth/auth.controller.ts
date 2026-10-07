import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from './auth-user';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';

interface AuthenticatedRequest extends Request { user: AuthUser; }

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() credentials: LoginDto) { return this.auth.login(credentials); }

  @Get('me')
  getCurrentUser(@Req() request: AuthenticatedRequest): AuthUser { return request.user; }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: AuthUser) { return this.auth.logout(user); }
}
