import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { CompaniesApiService } from '../core/services/companies-api.service';
import { TaxObligationsApiService } from '../core/services/tax-obligations-api.service';
import { Company } from '../shared/models/company.model';
import { PaginatedResponse } from '../shared/models/api-response.model';
import { TaxObligation } from '../shared/models/tax-obligation.model';

const PAGE_SIZE = 100;

@Injectable({ providedIn: 'root' })
export class DashboardDataService {
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly obligationsApi = inject(TaxObligationsApiService);

  load(): Observable<{ companies: Company[]; obligations: TaxObligation[] }> {
    return forkJoin({
      companies: this.loadAll((page) => this.companiesApi.list(page, PAGE_SIZE)),
      obligations: this.loadAll((page) => this.obligationsApi.list({ page, limit: PAGE_SIZE })),
    });
  }

  private loadAll<T>(fetchPage: (page: number) => Observable<PaginatedResponse<T>>): Observable<T[]> {
    return fetchPage(1).pipe(
      switchMap((firstPage) => {
        const remainingPages = Array.from(
          { length: Math.max(firstPage.meta.pageCount - 1, 0) },
          (_, index) => index + 2,
        );
        if (!remainingPages.length) return of(firstPage.data);
        return forkJoin(remainingPages.map(fetchPage)).pipe(
          map((pages) => [firstPage, ...pages].flatMap((page) => page.data)),
        );
      }),
    );
  }
}
