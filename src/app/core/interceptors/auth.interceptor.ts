import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, from, of, switchMap, throwError } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { AuthService } from '../../features/auth/services/auth.service';
import { AuthStore } from '../../features/auth/stores/auth.store';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly apiBaseUrl = inject(API_BASE_URL).replace(/\/$/, '');
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!req.url.startsWith(this.apiBaseUrl)) {
      return next.handle(req);
    }

    const sessionToken = this.authStore.session()?.access_token ?? null;

    if (sessionToken) {
      console.log('[AuthInterceptor] using in-memory session token', req.method, req.url);
      return next.handle(this.cloneWithAuthorization(req, sessionToken)).pipe(
        catchError((error: unknown) => this.handleHttpError(error))
      );
    }

    console.log('[AuthInterceptor] resolving token via Supabase getSession', req.method, req.url);
    return from(this.authService.getAccessToken()).pipe(
      catchError((error: unknown) => {
        console.error('[AuthInterceptor] getAccessToken failed before request', error);
        return of(null);
      }),
      switchMap((token) => {
        const authRequest = token ? this.cloneWithAuthorization(req, token) : req;

        return next.handle(authRequest).pipe(
          catchError((error: unknown) => this.handleHttpError(error))
        );
      })
    );
  }

  private handleHttpError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        void this.authStore.handleUnauthorized();
      }

      if (error.status === 403 && this.isSuspendedError(error)) {
        this.authStore.setSuspendedMessage('Account sospeso. Contattaci.');
      }
    }

    return throwError(() => error);
  }

  private cloneWithAuthorization(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
    return req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private isSuspendedError(error: HttpErrorResponse): boolean {
    const errorBody = error.error;
    const errorMessage =
      (typeof errorBody === 'string' && errorBody) ||
      (typeof errorBody?.message === 'string' && errorBody.message) ||
      (typeof error.message === 'string' && error.message) ||
      '';

    return /sospes|suspend/i.test(errorMessage);
  }
}
