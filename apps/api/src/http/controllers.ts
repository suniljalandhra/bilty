import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../modules/auth/auth.service';
import { CompanyService } from '../modules/company/company.service';
import { PartyService, pageSchema } from '../modules/party/party.service';
import { BiltyService } from '../modules/bilty/bilty.service';
import { actorOf } from '../modules/auth/access';
import type { AuthConfig } from '../modules/auth/config';
import { printData } from '../modules/bilty/domain';
import { Public, cookie, cookieOptions, requireOrigin, type AuthedRequest } from './security';
import {
  biltyQuery,
  callbackQuery,
  cancelBody,
  draftBody,
  editBody,
  fullData,
  versionBody,
  registerBody,
  loginBody,
  tokenBody,
  emailBody,
  resetPasswordBody,
  addPasswordBody,
} from './contracts';
export const CONFIG = Symbol('AUTH_CONFIG');
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: AuthConfig,
  ) {}
  @Public() @Get('google') async google(@Query() query: unknown, @Res() res: Response) {
    const { invite } = z.strictObject({ invite: z.string().optional() }).parse(query);
    const flow = await this.auth.beginLogin(invite);
    res.cookie('bilty_oauth', flow.browserToken, { ...cookieOptions(this.config), maxAge: 600000 });
    res.redirect(flow.url);
  }
  @Public() @Get('google/callback') async callback(
    @Query() query: unknown,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ) {
    res.clearCookie('bilty_oauth', cookieOptions(this.config));
    try {
      const denied = z.object({ state: z.string(), error: z.string() }).safeParse(query);
      if (denied.success) {
        await this.auth.discardLogin(denied.data.state, cookie(req, 'bilty_oauth'));
        throw new Error('Sign-in cancelled');
      }
      const { state, code } = callbackQuery.parse(query);
      const tokens = await this.auth.finishLogin(state, cookie(req, 'bilty_oauth'), code);
      this.setRefresh(res, tokens);
      res.redirect(this.config.FRONTEND_URL + '/auth/callback');
    } catch {
      res.clearCookie('bilty_refresh', cookieOptions(this.config));
      res.redirect(this.config.FRONTEND_URL + '/login?error=sign_in_failed');
    }
  }

  private setRefresh(res: Response, tokens: { refreshToken: string; expiresAt: string }) {
    res.cookie('bilty_refresh', tokens.refreshToken, {
      ...cookieOptions(this.config),
      expires: new Date(tokens.expiresAt),
    });
  }
  @Public() @Post('register') @HttpCode(201) async register(@Body() raw: unknown) {
    const { email, password, name } = registerBody.parse(raw);
    await this.auth.register(email, password, name);
    return { message: 'Verification email sent' };
  }
  @Public() @Post('verify-email') @HttpCode(200) async verifyEmail(
    @Body() raw: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token } = tokenBody.parse(raw);
    const tokens = await this.auth.verifyEmail(token);
    this.setRefresh(res, tokens);
    return { accessToken: tokens.accessToken, expiresIn: 900 };
  }
  @Public() @Post('login') @HttpCode(200) async login(
    @Body() raw: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password } = loginBody.parse(raw);
    const tokens = await this.auth.loginWithPassword(email, password);
    this.setRefresh(res, tokens);
    return { accessToken: tokens.accessToken, expiresIn: 900 };
  }
  @Public() @Post('forgot-password') @HttpCode(200) async forgotPassword(@Body() raw: unknown) {
    const { email } = emailBody.parse(raw);
    await this.auth.forgotPassword(email);
    return { message: 'If the account exists, a reset email was sent' };
  }
  @Public() @Post('reset-password') @HttpCode(200) async resetPassword(@Body() raw: unknown) {
    const { token, password } = resetPasswordBody.parse(raw);
    await this.auth.resetPassword(token, password);
    return { message: 'Password updated' };
  }
  @Post('add-password') @HttpCode(200) async addPassword(
    @Req() req: AuthedRequest,
    @Body() raw: unknown,
  ) {
    const { password } = addPasswordBody.parse(raw);
    await this.auth.addPassword(req.principal, password);
    return { message: 'Password added' };
  }
  @Public() @Post('resend-verification') @HttpCode(200) async resendVerification(
    @Body() raw: unknown,
  ) {
    const { email } = emailBody.parse(raw);
    await this.auth.resendVerification(email);
    return { message: 'If the account exists and is unverified, an email was sent' };
  }
  @Public() @Post('refresh') @HttpCode(200) async refresh(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    requireOrigin(req, this.config);
    try {
      const tokens = await this.auth.refresh(cookie(req, 'bilty_refresh'));
      this.setRefresh(res, tokens);
      return { accessToken: tokens.accessToken, expiresIn: 900 };
    } catch (error) {
      res.clearCookie('bilty_refresh', cookieOptions(this.config));
      throw error;
    }
  }
  @Get('me') me(@Req() req: AuthedRequest) {
    return this.auth.me(req.principal);
  }
  @Post('onboard') onboard(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.auth.onboard(req.principal, body);
  }
  @Post('logout') @HttpCode(200) logout(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.endSession(req, res, false);
  }
  @Post('logout-all') @HttpCode(200) logoutAll(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.endSession(req, res, true);
  }
  private async endSession(req: AuthedRequest, res: Response, all: boolean) {
    requireOrigin(req, this.config);
    await this.auth.logout(req.principal, all);
    res.clearCookie('bilty_refresh', cookieOptions(this.config));
    return { loggedOut: true };
  }
}
@Controller('company')
export class CompanyController {
  constructor(@Inject(CompanyService) private readonly service: CompanyService) {}
  @Get() get(@Req() r: AuthedRequest) {
    return this.service.get(r.principal);
  }
  @Patch() update(@Req() r: AuthedRequest, @Body() b: unknown) {
    return this.service.update(r.principal, b);
  }
  @Get('members') members(@Req() r: AuthedRequest) {
    return this.service.members(r.principal);
  }
  @Delete('members/:id') revoke(@Req() r: AuthedRequest, @Param('id') id: string) {
    return this.service.revokeMember(r.principal, id);
  }
}
@Controller('invites')
export class InviteController {
  constructor(@Inject(CompanyService) private readonly service: CompanyService) {}
  @Post() create(@Req() r: AuthedRequest, @Body() b: unknown) {
    return this.service.createInvite(r.principal, b);
  }
  @Get() list(@Req() r: AuthedRequest) {
    return this.service.invites(r.principal);
  }
  @Public() @Get('verify/:token') verify(@Param('token') token: string) {
    return this.service.verifyInvite(token);
  }
  @Delete(':id') revoke(@Req() r: AuthedRequest, @Param('id') id: string) {
    return this.service.revokeInvite(r.principal, id);
  }
}
@Controller('parties')
export class PartyController {
  constructor(@Inject(PartyService) private readonly service: PartyService) {}
  @Post() create(@Req() r: AuthedRequest, @Body() b: unknown) {
    return this.service.create(r.principal, b);
  }
  @Get() list(@Req() r: AuthedRequest, @Query() q: unknown) {
    return this.service.list(r.principal, q);
  }
  @Get(':id') get(@Req() r: AuthedRequest, @Param('id') id: string) {
    return this.service.get(r.principal, id);
  }
  @Patch(':id') update(@Req() r: AuthedRequest, @Param('id') id: string, @Body() b: unknown) {
    return this.service.update(r.principal, id, b);
  }
  @Delete(':id') archive(@Req() r: AuthedRequest, @Param('id') id: string) {
    return this.service.archive(r.principal, id);
  }
}
@Controller('biltys')
export class BiltyController {
  constructor(@Inject(BiltyService) private readonly service: BiltyService) {}
  @Post() create(@Req() r: AuthedRequest, @Body() raw: unknown) {
    const b = draftBody.parse(raw);
    return this.service.createDraft(actorOf(r.principal), b.data);
  }
  @Get() list(@Req() r: AuthedRequest, @Query() raw: unknown) {
    const q = biltyQuery.parse(raw);
    return this.service.list(actorOf(r.principal), q.limit, q.offset, q);
  }
  @Get(':id') get(@Req() r: AuthedRequest, @Param('id') id: string) {
    return this.service.get(actorOf(r.principal), id);
  }
  @Put(':id') edit(@Req() r: AuthedRequest, @Param('id') id: string, @Body() raw: unknown) {
    const b = editBody.parse(raw);
    return this.service.edit(
      actorOf(r.principal),
      id,
      b.expectedVersion,
      fullData(b.data),
      b.reason,
    );
  }
  @Post(':id/issue') issue(@Req() r: AuthedRequest, @Param('id') id: string, @Body() raw: unknown) {
    return this.service.issue(actorOf(r.principal), id, versionBody.parse(raw).expectedVersion);
  }
  @Post(':id/cancel') cancel(
    @Req() r: AuthedRequest,
    @Param('id') id: string,
    @Body() raw: unknown,
  ) {
    const b = cancelBody.parse(raw);
    return this.service.cancel(actorOf(r.principal), id, b.expectedVersion, b.reason);
  }
  @Get(':id/history') history(@Req() r: AuthedRequest, @Param('id') id: string) {
    return this.service.history(actorOf(r.principal), id);
  }
  @Get(':id/print') async print(@Req() r: AuthedRequest, @Param('id') id: string) {
    return printData(await this.service.get(actorOf(r.principal), id));
  }
}
