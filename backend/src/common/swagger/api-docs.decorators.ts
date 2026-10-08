import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from './error-response.dto';

const DEFAULT_ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Invalid request: a parameter, query or body field failed validation.',
  401: 'Missing, invalid or expired access token.',
  403: 'The authenticated user\'s role is not allowed to perform this action.',
  404: 'The resource does not exist.',
  409: 'The request conflicts with the current state of the data.',
  413: 'The uploaded file is larger than 10 MB.',
  429: 'Too many login attempts for this IP and email. Retry after the throttle window.',
};

type ErrorResponse = number | [status: number, description: string];

/** Documents error responses with the shared error body. Pass `[status, description]` to be specific. */
export function ApiErrorResponses(...responses: ErrorResponse[]): MethodDecorator & ClassDecorator {
  return applyDecorators(...responses.map((response) => {
    const [status, description] = Array.isArray(response) ? response : [response, DEFAULT_ERROR_DESCRIPTIONS[response]];
    return ApiResponse({ status, description, type: ErrorResponseDto });
  }));
}

/** Marks routes that require `Authorization: Bearer <token>` (every route except the @Public ones). */
export function ApiJwtAuth(): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiBearerAuth(), ApiErrorResponses(401));
}
