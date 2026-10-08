import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { PaginatedResponse } from '../models/api-response.model';
import { PagedList, PageQuery } from './paged-list';

const page = (data: string[], total = data.length): PaginatedResponse<string> => ({ data, meta: { page: 1, limit: 20, total, pageCount: 1 } });

describe('PagedList', () => {
  let destroyRef: DestroyRef;

  beforeEach(() => { destroyRef = TestBed.inject(DestroyRef); });

  it('loads the first page on creation and exposes rows and total', () => {
    const queries: PageQuery[] = [];
    const list = new PagedList((query) => { queries.push(query); return of(page(['a', 'b'], 42)); }, 'Error', destroyRef);
    expect(queries).toEqual([{ page: 1, limit: 20, search: '' }]);
    expect(list.rows()).toEqual(['a', 'b']);
    expect(list.total()).toBe(42);
    expect(list.loading()).toBe(false);
  });

  it('trims the search, returns to the first page and ignores repeated terms', () => {
    const queries: PageQuery[] = [];
    const list = new PagedList((query) => { queries.push(query); return of(page([])); }, 'Error', destroyRef);
    list.changePage({ pageIndex: 2, pageSize: 50, length: 200 });
    list.setSearch('  acme ');
    list.setSearch('acme');
    expect(queries).toEqual([
      { page: 1, limit: 20, search: '' },
      { page: 3, limit: 50, search: '' },
      { page: 1, limit: 50, search: 'acme' },
    ]);
  });

  it('shows the API error and keeps the previous rows', () => {
    let fail = false;
    const list = new PagedList(() => (fail ? throwError(() => new HttpErrorResponse({ status: 503 })) : of(page(['kept']))), 'No se pudieron cargar las empresas.', destroyRef);
    fail = true;
    list.reload();
    expect(list.error()).toMatch(/error en el servidor/);
    expect(list.rows()).toEqual(['kept']);
    expect(list.loading()).toBe(false);
  });

  it('ignores a slow earlier response once a newer request was made', () => {
    const responses: Subject<PaginatedResponse<string>>[] = [];
    const list = new PagedList(() => { const response = new Subject<PaginatedResponse<string>>(); responses.push(response); return response as Observable<PaginatedResponse<string>>; }, 'Error', destroyRef);
    list.setSearch('new');
    responses[1].next(page(['new result']));
    responses[0].next(page(['stale result']));
    expect(list.rows()).toEqual(['new result']);
  });
});
