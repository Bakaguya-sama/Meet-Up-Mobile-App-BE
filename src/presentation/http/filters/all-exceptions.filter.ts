import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '../../../shared-kernel/domain/domain-error';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    if (exception instanceof DomainError) {
      const statuses: Record<string, number> = {
        INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
        INVALID_TOKEN: HttpStatus.UNAUTHORIZED,
        ACCOUNT_LOCKED: HttpStatus.FORBIDDEN,
        ACCOUNT_NOT_FOUND: HttpStatus.NOT_FOUND,
        ACTIVITY_TAG_NOT_FOUND: HttpStatus.NOT_FOUND,
        INVALID_INPUT: HttpStatus.BAD_REQUEST,
        INVALID_PREFERENCE_LEVEL: HttpStatus.BAD_REQUEST,
        SELF_FRIENDSHIP: HttpStatus.BAD_REQUEST,
        FRIEND_USER_NOT_FOUND: HttpStatus.NOT_FOUND,
        FRIENDSHIP_NOT_FOUND: HttpStatus.NOT_FOUND,
        FRIENDSHIP_RESPONSE_FORBIDDEN: HttpStatus.FORBIDDEN,
      };
      const status = statuses[exception.code] ?? HttpStatus.CONFLICT;
      response.status(status).json({
        statusCode: status,
        code: exception.code,
        message: exception.message,
        path: request.url,
      });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error(
      `Unhandled error for ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      path: request.url,
    });
  }
}
