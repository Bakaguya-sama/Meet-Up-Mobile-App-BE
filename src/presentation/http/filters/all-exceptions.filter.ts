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
        ADMIN_SELF_LOCK: HttpStatus.CONFLICT,
        ACTIVITY_TAG_NOT_FOUND: HttpStatus.NOT_FOUND,
        INVALID_INPUT: HttpStatus.BAD_REQUEST,
        INVALID_PREFERENCE_LEVEL: HttpStatus.BAD_REQUEST,
        SELF_FRIENDSHIP: HttpStatus.BAD_REQUEST,
        FRIEND_USER_NOT_FOUND: HttpStatus.NOT_FOUND,
        FRIENDSHIP_NOT_FOUND: HttpStatus.NOT_FOUND,
        FRIENDSHIP_RESPONSE_FORBIDDEN: HttpStatus.FORBIDDEN,
        FRIENDSHIP_NOT_PENDING: HttpStatus.CONFLICT,
        FRIENDSHIP_NOT_ACCEPTED: HttpStatus.CONFLICT,
        LOCATION_ACCESS_DENIED: HttpStatus.FORBIDDEN,
        INVALID_LOCATION_SAMPLE: HttpStatus.BAD_REQUEST,
        MEETUP_NOT_FOUND: HttpStatus.NOT_FOUND,
        MEETUP_FORBIDDEN: HttpStatus.FORBIDDEN,
        MEETUP_VOTING_CLOSED: HttpStatus.CONFLICT,
        MEETUP_VOTING_OPEN: HttpStatus.CONFLICT,
        CHAT_FORBIDDEN: HttpStatus.FORBIDDEN,
        DIRECT_CHAT_FORBIDDEN: HttpStatus.FORBIDDEN,
        MEETUP_INVITEE_UNAVAILABLE: HttpStatus.BAD_REQUEST,
        MEETUP_INVITE_LINK_NOT_FOUND: HttpStatus.NOT_FOUND,
        MEETUP_INVITE_LINK_FORBIDDEN: HttpStatus.FORBIDDEN,
        MEETUP_INVITE_LINK_INVALID_EXPIRY: HttpStatus.BAD_REQUEST,
        MEETUP_INVITE_RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
        FRIEND_QR_NOT_FOUND: HttpStatus.NOT_FOUND,
        FRIEND_QR_RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
        MEETUP_INSUFFICIENT_PARTICIPANTS: HttpStatus.BAD_REQUEST,
        RECOMMENDATION_INSUFFICIENT_LOCATIONS: HttpStatus.BAD_REQUEST,
        PLACE_SEARCH_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
        INVALID_RECOMMENDATION_REQUEST: HttpStatus.BAD_REQUEST,
        INVALID_RECOMMENDATION_CONTEXT: HttpStatus.UNPROCESSABLE_ENTITY,
        UNSUPPORTED_OPENING_FILTER_FOR_CATEGORY: HttpStatus.BAD_REQUEST,
        INSUFFICIENT_VALID_MEMBERS: HttpStatus.BAD_REQUEST,
        NO_ELIGIBLE_CANDIDATES: HttpStatus.UNPROCESSABLE_ENTITY,
        NO_ROUTABLE_CANDIDATES: HttpStatus.UNPROCESSABLE_ENTITY,
        ROUTE_MATRIX_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
        INVALID_ROUTE_MATRIX_INPUT: HttpStatus.BAD_REQUEST,
        INVALID_RECOMMENDATION_CONFIG: HttpStatus.INTERNAL_SERVER_ERROR,
        INVALID_RECOMMENDATION_NUMERIC: HttpStatus.UNPROCESSABLE_ENTITY,
        IDEMPOTENCY_KEY_REUSED: HttpStatus.CONFLICT,
        RECOMMENDATION_RUN_IN_PROGRESS: HttpStatus.CONFLICT,
        RECOMMENDATION_RUN_NOT_RUNNING: HttpStatus.CONFLICT,
        RECOMMENDATION_RUN_NOT_FOUND: HttpStatus.NOT_FOUND,
        RECOMMENDATION_CANDIDATE_NOT_FOUND: HttpStatus.NOT_FOUND,
        RECOMMENDATION_RUN_FORBIDDEN: HttpStatus.FORBIDDEN,
        RECOMMENDATION_STALE_CONTEXT: HttpStatus.CONFLICT,
        RECOMMENDATION_EVENT_ID_REUSED: HttpStatus.CONFLICT,
        RECOMMENDATION_NOT_SHOWN: HttpStatus.CONFLICT,
      };
      const status = statuses[exception.code] ?? HttpStatus.CONFLICT;
      response.status(status).json({
        statusCode: status,
        code: exception.code,
        message: exception.message,
        path: redactTokenPath(request.url),
      });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error(
      `Unhandled error for ${request.method} ${redactTokenPath(request.url)}`,
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      path: redactTokenPath(request.url),
    });
  }
}

function redactTokenPath(path: string): string {
  return path
    .replace(/(\/meetup-invites\/)[^/?]+/gi, '$1:redacted')
    .replace(/(\/friends\/qr-sessions\/)[^/?]+/gi, '$1:redacted');
}
