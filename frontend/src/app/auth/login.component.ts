import { HttpErrorResponse } from "@angular/common/http";
import { Component, DestroyRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { catchError, finalize, of, switchMap } from "rxjs";
import { AuthService } from "../core/auth/auth.service";
import { apiErrorMessage } from "../core/errors/api-error-message";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <main class="login-shell">
      <section class="login-aside">
        <div class="aside-brand">
          <span class="brand-icon" aria-hidden="true"
            ><svg class="brand-mark" viewBox="0 0 40 40">
              <path
                d="M5 8h17v4h-6.5v20h-4V12H5zM23 8h12v4h-8v6h7v4h-7v10h-4z"
              /></svg></span
          ><span>TaxFlow</span>
        </div>
        <div class="aside-copy">
          <p class="eyebrow">TAX OPERATIONS</p>
          <h1>Obligaciones fiscales, bajo control.</h1>
          <p>
            Un espacio central para organizar el cumplimiento tributario de tu
            empresa.
          </p>
        </div>
        <small class="aside-foot">Plataforma de gestión fiscal</small>
      </section>
      <section class="login-main">
        <mat-card class="login-card"
          ><div class="mobile-brand">
            <span class="mobile-mark" aria-hidden="true"
              ><svg class="brand-mark" viewBox="0 0 40 40">
                <path
                  d="M5 8h17v4h-6.5v20h-4V12H5zM23 8h12v4h-8v6h7v4h-7v10h-4z"
                /></svg
            ></span>
            TaxFlow
          </div>
          <p class="eyebrow">ACCESO SEGURO</p>
          <h2>Iniciar sesión</h2>
          <p class="subtitle">Ingresá a tu espacio de trabajo.</p>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <mat-form-field appearance="outline"
              ><mat-label>Email</mat-label
              ><input
                matInput
                type="email"
                formControlName="email"
                autocomplete="username"
              /><svg
                matPrefix
                class="field-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M4 6.75h16a1 1 0 0 1 1 1v.5l-9 6-9-6v-.5a1 1 0 0 1 1-1Zm-1 3.9 8.45 5.63a1 1 0 0 0 1.1 0L21 10.65v6.6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6.6Z"
                />
              </svg>
              @if (form.controls.email.hasError("required")) {
                <mat-error>El email es obligatorio.</mat-error>
              } @else if (form.controls.email.hasError("email")) {
                <mat-error>Ingresá un email válido.</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline"
              ><mat-label>Contraseña</mat-label
              ><input
                matInput
                type="password"
                formControlName="password"
                autocomplete="current-password"
              /><svg
                matPrefix
                class="field-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M7 9V7a5 5 0 0 1 10 0v2h1.25A1.75 1.75 0 0 1 20 10.75v8.5A1.75 1.75 0 0 1 18.25 21h-12A1.75 1.75 0 0 1 4.5 19.25v-8.5A1.75 1.75 0 0 1 6.25 9H7Zm2 0h6V7a3 3 0 0 0-6 0v2Zm3 3.25a1.5 1.5 0 0 0-.75 2.8v2.2h1.5v-2.2a1.5 1.5 0 0 0-.75-2.8Z"
                />
              </svg>
              @if (form.controls.password.hasError("required")) {
                <mat-error>La contraseña es obligatoria.</mat-error>
              }
            </mat-form-field>
            @if (errorMessage) {
              <div class="login-error" role="alert">
                <svg class="error-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V6h2v7Z"
                  /></svg
                ><span>{{ errorMessage }}</span>
              </div>
            }
            <button
              mat-flat-button
              color="primary"
              class="submit"
              type="submit"
              [disabled]="loading"
            >
              @if (loading) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                <span
                  >Ingresar<svg
                    class="arrow-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M13.2 5.2 20 12l-6.8 6.8-1.4-1.4 4.4-4.4H4v-2h12.2l-4.4-4.4z"
                    /></svg
                ></span>
              }
            </button>
          </form>
          <p class="security-note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2 4 5v6c0 5.1 3.4 9.2 8 11 4.6-1.8 8-5.9 8-11V5l-8-3Zm0 2.2 6 2.25V11c0 3.9-2.4 7.2-6 8.8-3.6-1.6-6-4.9-6-8.8V6.45l6-2.25Z"
              />
              <path
                d="m8.1 12.2 1.4-1.4 2.1 2.1 4.8-4.8 1.4 1.4-6.2 6.2-3.5-3.5Z"
                transform="translate(0 -0.6)"
              />
            </svg>
            Conexión protegida
          </p>
        </mat-card>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }
      .login-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(320px, 43%) minmax(0, 1fr);
        background: #fff;
      }
      .login-aside {
        background: #193553;
        color: #fff;
        padding: 42px clamp(32px, 6vw, 88px);
        display: flex;
        flex-direction: column;
      }
      .aside-brand {
        display: flex;
        align-items: center;
        gap: 11px;
        font-size: 20px;
        font-weight: 700;
      }
      .brand-icon {
        width: 38px;
        height: 38px;
        border-radius: 9px;
        background: #ffffff1c;
        display: grid;
        place-items: center;
      }
      .brand-mark {
        display: block;
        width: 25px;
        height: 25px;
        fill: currentColor;
      }
      .aside-copy {
        margin: auto 0;
        max-width: 420px;
      }
      .eyebrow {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.13em;
        color: #6483a7;
        margin: 0 0 12px;
      }
      .aside-copy .eyebrow {
        color: #9bb5d0;
      }
      .aside-copy h1 {
        font-size: clamp(34px, 4vw, 52px);
        line-height: 1.1;
        letter-spacing: -0.04em;
        margin: 0 0 18px;
      }
      .aside-copy p:last-child {
        max-width: 340px;
        color: #c5d2df;
        line-height: 1.7;
        font-size: 15px;
      }
      .aside-foot {
        color: #91a6bb;
        font-size: 12px;
      }
      .login-main {
        display: grid;
        place-items: center;
        min-width: 0;
        padding: 32px;
      }
      .login-card {
        box-sizing: border-box;
        min-width: 0;
        width: min(100%, 430px);
        padding: 38px 36px;
        border: 1px solid #e3e8ee;
        box-shadow: 0 18px 55px #1e293b0b !important;
        border-radius: 12px !important;
        font-family: inherit;
        --mat-form-field-container-text-font: Roboto, "Segoe UI", sans-serif;
        --mat-form-field-floating-label-text-font:
          Roboto, "Segoe UI", sans-serif;
      }
      .login-card h2 {
        font-size: 27px;
        margin: 0;
        color: #1c2c3f;
      }
      .subtitle {
        margin: 8px 0 28px;
        color: #68778a;
        font-size: 14px;
      }
      .login-card form {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .login-card mat-form-field {
        width: 100%;
      }
      .field-icon {
        display: block;
        width: 20px;
        height: 20px;
        fill: #738398;
        margin-left: 10px;
        margin-right: 6px;
        flex: 0 0 auto;
      }
      .login-card mat-error {
        line-height: 1.25;
      }
      .submit {
        height: 48px;
        margin-top: 7px;
        font-weight: 600;
        font-family: inherit;
        font-size: 14px;
      }
      .submit span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .arrow-icon {
        width: 18px;
        height: 18px;
        fill: currentColor;
        margin-left: 9px;
      }
      .submit mat-spinner {
        display: inline-block;
      }
      .login-error {
        display: flex;
        gap: 9px;
        align-items: flex-start;
        padding: 11px 12px;
        border-radius: 7px;
        background: #fff0ee;
        color: #ae3d32;
        font-size: 13px;
        line-height: 1.45;
      }
      .error-icon {
        width: 19px;
        height: 19px;
        fill: currentColor;
        flex: 0 0 auto;
      }
      .security-note {
        display: flex;
        justify-content: center;
        gap: 7px;
        align-items: center;
        margin: 26px 0 0;
        color: #8090a1;
        font-size: 12px;
      }
      .security-note svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
        flex: 0 0 auto;
      }
      .mobile-brand {
        display: none;
      }
      @media (max-width: 780px) {
        .login-shell {
          grid-template-columns: minmax(0, 1fr);
        }
        .login-aside {
          display: none;
        }
        .login-main {
          box-sizing: border-box;
          width: 100vw;
          padding: 20px;
        }
        .login-card {
          width: calc(100vw - 40px);
          max-width: 430px;
          padding: 30px 24px;
        }
        .mobile-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #254b77;
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 34px;
        }
        .mobile-mark {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border-radius: 7px;
          background: #e9f1fa;
          color: #2c67aa;
        }
        .mobile-mark .brand-mark {
          width: 22px;
          height: 22px;
        }
      }
      :host ::ng-deep .login-card .mdc-floating-label,
      :host ::ng-deep .login-card .mdc-text-field__input,
      :host ::ng-deep .login-card .mat-mdc-form-field-error,
      :host ::ng-deep .login-card .mat-mdc-form-field-hint-wrapper {
        font-family: Roboto, "Segoe UI", sans-serif !important;
      }

      :host
        ::ng-deep
        .login-card
        .mdc-floating-label:not(.mdc-floating-label--float-above) {
        top: calc(50% - 1px) !important;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = this.fb.nonNullable.group({
    email: [
      "",
      [Validators.required, Validators.email, Validators.maxLength(254)],
    ],
    password: ["", Validators.required],
  });
  loading = false;
  errorMessage = "";

  submit(): void {
    this.errorMessage = "";

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    this.auth
      .login(this.form.getRawValue())
      .pipe(
        switchMap(() => this.auth.loadCurrentUser(true)),

        takeUntilDestroyed(this.destroyRef),

        catchError((error: unknown) => {
          this.errorMessage =
            error instanceof HttpErrorResponse && error.status === 401
              ? "Email o contraseña incorrectos."
              : apiErrorMessage(
                  error,
                  "No se pudo iniciar sesión. Verificá tus credenciales.",
                );

          return of(null);
        }),

        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe((user) => {
        if (user) {
          void this.router.navigate(["/app"]);
        }
      });
  }
}
