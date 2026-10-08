import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { extname } from 'node:path';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ApiErrorResponses, ApiJwtAuth } from '../common/swagger/api-docs.decorators';
import { UserRole } from '../users/user-role.enum';
import { DocumentResponseDto } from './dto/document-response.dto';
import { DocumentsService } from './documents.service';
import { ALLOWED_DOCUMENTS, IncomingDocumentFile, MAX_DOCUMENT_SIZE } from './file-validation';

interface AuthenticatedRequest extends Request { user: AuthUser }
type DownloadResponse = Response;

const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_DOCUMENTS).join(', ');
const ALLOWED_MIME_TYPES = [...new Set(Object.values(ALLOWED_DOCUMENTS).map((type) => type.mimeType))];

@ApiTags('Documents')
@ApiJwtAuth()
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @ApiOperation({ summary: 'Lists the documents of an obligation, newest first.' })
  @Get('tax-obligations/:taxObligationId/documents')
  @ApiOkResponse({ type: [DocumentResponseDto] })
  @ApiErrorResponses(400, 404)
  list(@Param('taxObligationId', ParseUUIDPipe) obligationId: string) { return this.documents.listForObligation(obligationId); }

  @ApiOperation({ summary: 'Uploads a document to an obligation (multipart field `file`). ADMIN, TAX_MANAGER.' })
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Post('tax-obligations/:taxObligationId/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_SIZE, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary', description: `Up to 10 MB. Extension, MIME type and content must match: ${ALLOWED_EXTENSIONS}.` } } } })
  @ApiCreatedResponse({ type: DocumentResponseDto })
  @ApiErrorResponses([400, 'Missing or empty file, or a file type that is not allowed.'], 403, 404, 413)
  upload(
    @Param('taxObligationId', ParseUUIDPipe) obligationId: string,
    @UploadedFile() file: IncomingDocumentFile | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.documents.upload(obligationId, request.user, file);
  }

  @ApiOperation({ summary: 'Downloads the file as an attachment. Audited.' })
  @Get('documents/:id/download')
  @ApiProduces(...ALLOWED_MIME_TYPES)
  @ApiOkResponse({ description: 'The file content.', schema: { type: 'string', format: 'binary' } })
  @ApiErrorResponses(400, [404, 'Document, or its stored file, not found.'])
  async download(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) request: DownloadResponse): Promise<StreamableFile> {
    const result = await this.documents.download(id, user);
    request.setHeader('Content-Type', result.mimeType);
    request.setHeader('Content-Length', result.content.length);
    request.setHeader('Content-Disposition', contentDisposition(result.originalFilename));
    request.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(result.content);
  }

  @ApiOperation({ summary: 'Deletes a document and its file. ADMIN, TAX_MANAGER.' })
  @Roles(UserRole.ADMIN, UserRole.TAX_MANAGER)
  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiErrorResponses(400, 403, 404)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> { await this.documents.remove(id, user); }
}

function contentDisposition(originalFilename: string): string {
  const fallback = originalFilename.replace(/[^\x20-\x7e]|["\\]/g, '_').replace(/[;\r\n]/g, '_') || `document${extname(originalFilename)}`;
  const encoded = encodeURIComponent(originalFilename).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
