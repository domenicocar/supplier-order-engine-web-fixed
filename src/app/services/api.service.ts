import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../core/tokens/api-base-url.token';

type RequestOptions = {
  headers?: HttpHeaders | Record<string, string | string[]>;
  params?: HttpParams | Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>;
};

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL).replace(/\/$/, '');

  get<T>(path: string, options?: RequestOptions): Observable<T> {
    return this.http.get<T>(this.buildUrl(path), options);
  }

  getBlob(path: string): Observable<Blob> {
    return this.http.get(this.buildUrl(path), {
      responseType: 'blob'
    });
  }

  post<T>(path: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.post<T>(this.buildUrl(path), body, options);
  }

  delete<T>(path: string, options?: RequestOptions): Observable<T> {
    return this.http.delete<T>(this.buildUrl(path), options);
  }

  postFormData<T>(path: string, formData: FormData): Observable<T> {
    return this.http.post<T>(this.buildUrl(path), formData);
  }

  private buildUrl(path: string): string {
    if (!path.startsWith('/')) {
      return `${this.apiBaseUrl}/${path}`;
    }

    return `${this.apiBaseUrl}${path}`;
  }
}
