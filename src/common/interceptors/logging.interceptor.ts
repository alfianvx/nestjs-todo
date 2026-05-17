import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { catchError, Observable, tap, throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, originalUrl, url } = request;
    const requestUrl = originalUrl ?? url;
    const startTime = Date.now();

    const user = request.user as { id?: number; email?: string } | undefined;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.logger.log(
          `${method} ${requestUrl} ${statusCode} ${duration}ms${user?.id ? ` userId=${user.id}` : ''}`,
        );
      }),

      catchError((error) => {
        const duration = Date.now() - startTime;

        const statusCode =
          error instanceof HttpException ? error.getStatus() : 500;

        this.logger.error(
          `${method} ${requestUrl} ${statusCode} ${duration}ms${user?.id ? ` userId=${user.id}` : ''} message="${error?.message ?? 'Unknown error'}"`,
          error?.stack,
        );

        return throwError(() => error);
      }),
    );
  }
}
