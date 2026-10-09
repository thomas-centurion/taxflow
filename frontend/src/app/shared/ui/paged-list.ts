import { DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageEvent } from '@angular/material/paginator';
import { BehaviorSubject, Observable, catchError, of, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../core/errors/api-error-message';
import { PaginatedResponse } from '../models/api-response.model';

export interface PageQuery { page: number; limit: number; search: string }

export class PagedList<T> {
  readonly rows = signal<T[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);
  readonly search = signal('');

  private readonly trigger$ = new BehaviorSubject<void>(undefined);

  constructor(load: (query: PageQuery) => Observable<PaginatedResponse<T>>, errorMessage: string, destroyRef: DestroyRef) {
    this.trigger$.pipe(
      tap(() => { this.loading.set(true); this.error.set(''); }),
      // switchmap cancela el request anterior para no mostrar resultados desordenados
      switchMap(() => load({ page: this.pageIndex() + 1, limit: this.pageSize(), search: this.search() }).pipe(
        catchError((error: unknown) => { this.error.set(apiErrorMessage(error, errorMessage)); return of(null); }),
      )),
      takeUntilDestroyed(destroyRef),
    ).subscribe((response) => {
      this.loading.set(false);
      if (!response) return;
      this.rows.set(response.data);
      this.total.set(response.meta.total);
    });
  }

  reload(): void { this.trigger$.next(); }

  setSearch(term: string): void {
    const search = term.trim();
    if (search === this.search()) return;
    this.search.set(search);
    this.pageIndex.set(0);
    this.reload();
  }

  changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.reload();
  }
}
