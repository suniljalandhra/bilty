import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BiltyService } from '../modules/bilty/bilty.service';
import { CompanyService } from '../modules/company/company.service';
import { ShareService } from '../modules/print/share.service';
import { renderBiltyPdf, printOptions } from '../modules/print/pdf';
import { actorOf } from '../modules/auth/access';
import { Public, type AuthedRequest } from './security';
@Controller()
export class PrintController {
  constructor(
    @Inject(BiltyService) private readonly biltys: BiltyService,
    @Inject(CompanyService) private readonly companies: CompanyService,
    @Inject(ShareService) private readonly shares: ShareService,
  ) {}
  @Get('biltys/:id/pdf') async pdf(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query() raw: unknown,
    @Res() res: Response,
  ) {
    const options = printOptions.parse(raw),
      record = await this.biltys.get(actorOf(req.principal), id);
    const company = record.companySnapshot ?? (await this.companies.get(req.principal)).profile;
    const buffer = await renderBiltyPdf(record, options, company);
    this.send(res, buffer);
  }
  @Post('biltys/:id/shares') create(
    @Req() r: AuthedRequest,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.shares.create(r.principal, id, b);
  }
  @Get('biltys/:id/shares') list(@Req() r: AuthedRequest, @Param('id') id: string) {
    return this.shares.list(r.principal, id);
  }
  @Delete('biltys/:id/shares/:shareId') revoke(
    @Req() r: AuthedRequest,
    @Param('id') id: string,
    @Param('shareId') shareId: string,
  ) {
    return this.shares.revoke(r.principal, id, shareId);
  }
  @Public() @Get('shared/:token') async shared(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const value = await this.shares.resolve(token);
    this.send(res, await renderBiltyPdf(value.record, value.options));
  }
  private send(res: Response, buffer: Buffer) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="bilty.pdf"');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.send(buffer);
  }
}
