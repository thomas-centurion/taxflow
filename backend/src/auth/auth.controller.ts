import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoginThrottlerGuard } from './login-throttler.guard';
import { Request } from 'express';
import { AuthUser } from './auth-user';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { ApiErrorResponses, ApiJwtAuth } from '../common/swagger/api-docs.decorators';
import { AuthUserDto, LoginResponseDto, LogoutResponseDto } from './auth-response.dto';

interface AuthenticatedRequest extends Request { user: AuthUser; }

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({ summary: 'Exchanges email and password for a JWT. Public and rate limited per IP and email.' })
  @Public()
  @UseGuards(LoginThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiErrorResponses(400, [401, 'Invalid credentials, or the account is inactive.'], 429)
  login(@Body() credentials: LoginDto) { return this.auth.login(credentials); }

  @ApiOperation({ summary: 'Returns the authenticated user.' })
  @Get('me')
  @ApiJwtAuth()
  @ApiOkResponse({ type: AuthUserDto })
  getCurrentUser(@Req() request: AuthenticatedRequest): AuthUser { return request.user; }

  @ApiOperation({ summary: 'Records the logout in the audit log. JWTs are stateless: the client discards the token.' })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiJwtAuth()
  @ApiOkResponse({ type: LogoutResponseDto })
  logout(@CurrentUser() user: AuthUser) { return this.auth.logout(user); }
}
