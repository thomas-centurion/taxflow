import { Routes } from '@angular/router';
import { AuthenticatedLayoutComponent } from './layout/authenticated-layout.component';
import { authGuard, loginGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app' },
  { path: 'login', canActivate: [loginGuard], loadComponent: () => import('./auth/login.component').then((module) => module.LoginComponent) },
  {
    path: 'app', component: AuthenticatedLayoutComponent, canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./dashboard/home-page.component').then((module) => module.HomePageComponent) },
      { path: 'users', canActivate: [roleGuard], data: { roles: ['ADMIN'] }, loadComponent: () => import('./users/users-page.component').then((module) => module.UsersPageComponent) },
      { path: 'companies', loadComponent: () => import('./companies/companies-page.component').then((module) => module.CompaniesPageComponent) },
      { path: 'countries', canActivate: [roleGuard], data: { roles: ['ADMIN'] }, loadComponent: () => import('./countries/countries-page.component').then((module) => module.CountriesPageComponent) },
      { path: 'tax-obligations/:id', loadComponent: () => import('./obligations/tax-obligation-detail-page.component').then((module) => module.TaxObligationDetailPageComponent) },
      { path: 'notifications', loadComponent: () => import('./notifications/notifications-page.component').then((module) => module.NotificationsPageComponent) },
      { path: 'audit-logs', canActivate: [roleGuard], data: { roles: ['ADMIN', 'TAX_MANAGER'] }, loadComponent: () => import('./audit/audit-logs-page.component').then((module) => module.AuditLogsPageComponent) },
      { path: 'tax-obligations', loadComponent: () => import('./obligations/tax-obligations-page.component').then((module) => module.TaxObligationsPageComponent) },
    ],
  },
  { path: '**', redirectTo: 'app' },
];
