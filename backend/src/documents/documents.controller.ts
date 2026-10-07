import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { extname } from 'node:path';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { DocumentsService } from './documents.service';
import { IncomingDocumentFile, MAX_DOCUMENT_SIZE } from './file-validation';

interface AuthenticatedRequest extends Request { user: AuthUser }
type DownloadResponse = Response;

@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('tax-obligations/:taxObligationId/documents')
  list(@Param('taxObligationId', ParseUUIDPipe) obligationId: string) { return this.documents.listForObligation(obligationId); }

  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Post('tax-obligations/:taxObligationId/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_SIZE, files: 1 } }))
  upload(
    @Param('taxObligationId', ParseUUIDPipe) obligationId: string,
    @UploadedFile() file: IncomingDocumentFile | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.documents.upload(obligationId, request.user, file);
  }

  @Get('documents/:id/download')
  async download(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) request: DownloadResponse): Promise<StreamableFile> {
    const result = await this.documents.download(id, user);
    request.setHeader('Content-Type', result.mimeType);
    request.setHeader('Content-Length', result.content.length);
    request.setHeader('Content-Disposition', contentDisposition(result.originalFilename));
    request.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(result.content);
  }

  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> { await this.documents.remove(id, user); }
}

function contentDisposition(originalFilename: string): string {
  const fallback = originalFilename.replace(/[^\x20-\x7e]|["\\]/g, '_').replace(/[;\r\n]/g, '_') || `document${extname(originalFilename)}`;
  const encoded = encodeURIComponent(originalFilename).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
