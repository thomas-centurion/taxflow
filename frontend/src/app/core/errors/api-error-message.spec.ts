import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error-message';

const httpError = (status: number, message?: string | string[]) =>
  new HttpErrorResponse({ status, error: message === undefined ? null : { statusCode: status, message } });

describe('apiErrorMessage', () => {
  it('translates known business errors into actionable Spanish messages', () => {
    expect(apiErrorMessage(httpError(409, 'Invalid status transition from APPROVED to PENDING.')))
      .toBe('No se puede pasar de "Aprobada" a "Pendiente". Las obligaciones aprobadas o canceladas no se pueden reabrir.');
    expect(apiErrorMessage(httpError(409, 'The system must keep at least one active ADMIN.'))).toMatch(/al menos un administrador activo/);
    expect(apiErrorMessage(httpError(404, 'Active responsible user not found.'))).toMatch(/ya no está activo/);
  });

  it('keeps unknown API messages and joins validation lists', () => {
    expect(apiErrorMessage(httpError(409, 'Something specific happened.'))).toBe('Something specific happened.');
    expect(apiErrorMessage(httpError(400, ['name should not be empty', 'dueDate must be a valid date'])))
      .toBe('name should not be empty. dueDate must be a valid date');
  });

  it('maps transport and generic statuses to clear messages', () => {
    expect(apiErrorMessage(httpError(0))).toMatch(/No se pudo conectar/);
    expect(apiErrorMessage(httpError(401))).toMatch(/sesión venció/);
    expect(apiErrorMessage(httpError(403))).toMatch(/permisos/);
    expect(apiErrorMessage(httpError(404, 'Company not found.'))).toMatch(/No se encontró el registro/);
    expect(apiErrorMessage(httpError(413))).toMatch(/10 MB/);
    expect(apiErrorMessage(httpError(429))).toMatch(/Demasiados intentos/);
    expect(apiErrorMessage(httpError(503))).toMatch(/error en el servidor/);
  });

  it('falls back for anything that is not an HTTP error', () => {
    expect(apiErrorMessage(new Error('boom'), 'No se pudo guardar.')).toBe('No se pudo guardar.');
    expect(apiErrorMessage(undefined)).toBe('No se pudo completar la solicitud.');
  });
});
