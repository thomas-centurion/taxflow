import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(error: unknown, fallback = 'No se pudo completar la solicitud.'): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'No se pudo conectar con el servidor. Revisá que la API esté disponible.';
  if (error.status === 401) return 'Tu sesión venció. Iniciá sesión nuevamente.';
  if (error.status === 403) return 'No tenés permisos para realizar esta acción.';
  if (error.status === 404) return 'No se encontró el recurso solicitado.';
  if (error.status === 409) {
    const body = error.error as { message?: string } | null;
    return typeof body?.message === 'string' ? body.message : 'Ya existe un registro con esos datos o hay información relacionada.';
  }
  if (error.status === 413) return 'El archivo supera el tamaño máximo permitido de 10 MB.';
  if (error.status >= 500) return 'Ocurrió un error en el servidor. Intentá nuevamente.';
  if (error.status === 400) {
    const body = error.error as { message?: string | string[] } | null;
    const messages = body?.message;
    if (Array.isArray(messages) && messages.length) return messages.join('. ');
    if (typeof messages === 'string') return messages;
    return 'Revisá los datos ingresados.';
  }
  return fallback;
}
