import { Routes } from '@angular/router';
import { AuthenticatedLayoutComponent } from './layout/authenticated-layout/authenticated-layout.component';
import { authGuard, loginGuard, roleGuard } from './core/guards/auth.guard';

// `title` sets the browser tab title; `data.section` is shown in the top bar.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app' },
  { path: 'login', title: 'Iniciar sesión · TaxFlow', canActivate: [loginGuard], loadComponent: () => import('./auth/login/login.component').then((module) => module.LoginComponent) },
  {
    path: 'app', component: AuthenticatedLayoutComponent, canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', title: 'Inicio · TaxFlow', data: { section: 'Inicio' }, loadComponent: () => import('./dashboard/home-page/home-page.component').then((module) => module.HomePageComponent) },
      { path: 'tax-obligations', title: 'Obligaciones fiscales · TaxFlow', data: { section: 'Obligaciones fiscales' }, loadComponent: () => import('./obligations/tax-obligations-page/tax-obligations-page.component').then((module) => module.TaxObligationsPageComponent) },
      { path: 'tax-obligations/:id', title: 'Detalle de obligación · TaxFlow', data: { section: 'Obligaciones fiscales' }, loadComponent: () => import('./obligations/tax-obligation-detail-page/tax-obligation-detail-page.component').then((module) => module.TaxObligationDetailPageComponent) },
      { path: 'companies', title: 'Empresas · TaxFlow', data: { section: 'Empresas' }, loadComponent: () => import('./companies/companies-page/companies-page.component').then((module) => module.CompaniesPageComponent) },
      { path: 'notifications', title: 'Notificaciones · TaxFlow', data: { section: 'Notificaciones' }, loadComponent: () => import('./notifications/notifications-page/notifications-page.component').then((module) => module.NotificationsPageComponent) },
      { path: 'users', title: 'Usuarios · TaxFlow', canActivate: [roleGuard], data: { roles: ['ADMIN'], section: 'Administración' }, loadComponent: () => import('./users/users-page/users-page.component').then((module) => module.UsersPageComponent) },
      { path: 'countries', title: 'Países · TaxFlow', canActivate: [roleGuard], data: { roles: ['ADMIN'], section: 'Administración' }, loadComponent: () => import('./countries/countries-page/countries-page.component').then((module) => module.CountriesPageComponent) },
      { path: 'audit-logs', title: 'Auditoría · TaxFlow', canActivate: [roleGuard], data: { roles: ['ADMIN', 'TAX_MANAGER'], allowReadOnly: true, section: 'Administración' }, loadComponent: () => import('./audit/audit-logs-page/audit-logs-page.component').then((module) => module.AuditLogsPageComponent) },
    ],
  },
  { path: '**', redirectTo: 'app' },
];
