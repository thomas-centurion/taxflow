import { HttpErrorResponse } from '@angular/common/http';
import { statusLabel } from '../../shared/presentation/labels';
import { TaxObligationStatus } from '../../shared/models/tax-obligation.model';

const KNOWN_MESSAGES: [RegExp, (match: RegExpMatchArray) => string][] = [
  [/^Invalid status transition from (\w+) to (\w+)\.?$/, (m) => `No se puede pasar de "${statusLabel(m[1] as TaxObligationStatus)}" a "${statusLabel(m[2] as TaxObligationStatus)}". Las obligaciones aprobadas o canceladas no se pueden reabrir.`],
  [/^Only obligations with a past due date can be marked as OVERDUE\.?$/, () => 'Solo se puede marcar como vencida una obligación cuya fecha de vencimiento ya pasó.'],
  [/^An overdue obligation can only be reopened after moving its due date to today or later\.?$/, () => 'Para reabrir una obligación vencida, primero cambiá su vencimiento a hoy o una fecha posterior.'],
  [/^The system must keep at least one active ADMIN\.?$/, () => 'Tiene que quedar al menos un administrador activo. Asigná el rol a otra persona antes de hacer este cambio.'],
  [/^You cannot delete your own account\.?$/, () => 'No podés eliminar tu propia cuenta.'],
  [/^The country of a company with tax obligations cannot be changed\.?$/, () => 'No se puede cambiar el país de una empresa que ya tiene obligaciones fiscales.'],
  [/^The selected country does not match the company country\.?$/, () => 'El país elegido no coincide con el país de la empresa.'],
  [/^An obligation with the same company, name, type and due date already exists\.?$/, () => 'Ya existe una obligación con la misma empresa, nombre, tipo y vencimiento.'],
  [/^A company with this tax ID already exists in the selected country\.?$/, () => 'Ya existe una empresa con ese identificador fiscal en el país elegido.'],
  [/^A user with this email already exists\.?$/, () => 'Ya existe un usuario con ese email.'],
  [/^A country with this code already exists\.?$/, () => 'Ya existe un país con ese código.'],
  [/^Delete associated documents before deleting this tax obligation\.?$/, () => 'La obligación tiene documentos. Eliminalos primero desde el detalle de la obligación.'],
  [/^Tax obligation cannot be deleted while documents reference it\.?$/, () => 'La obligación tiene documentos. Eliminalos primero desde el detalle de la obligación.'],
  [/^Company cannot be deleted while obligations or documents reference it\.?$/, () => 'La empresa tiene obligaciones o documentos asociados. Eliminalos o desactivá la empresa.'],
  [/^Country cannot be deleted while companies or obligations reference it\.?$/, () => 'El país tiene empresas u obligaciones asociadas.'],
  [/^User cannot be deleted because it has associated records\.?$/, () => 'El usuario tiene registros asociados (por ejemplo, documentos cargados). Desactivalo en lugar de eliminarlo.'],
  [/^This record is referenced by other records and cannot be changed or deleted\.?$/, () => 'El registro está vinculado a otros datos y no se puede modificar ni eliminar.'],
  [/^Active responsible user not found\.?$/, () => 'El responsable elegido ya no está activo. Elegí otra persona.'],
];

function translate(message: string): string {
  for (const [pattern, render] of KNOWN_MESSAGES) {
    const match = message.match(pattern);
    if (match) return render(match);
  }
  return message;
}

export function apiErrorMessage(error: unknown, fallback = 'No se pudo completar la solicitud.'): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  const body = error.error as { message?: string | string[] } | null;
  const message = Array.isArray(body?.message) ? body.message.join('. ') : body?.message;
  if (error.status === 0) return 'No se pudo conectar con el servidor. Revisá tu conexión e intentá nuevamente.';
  if (error.status === 401) return 'Tu sesión venció. Iniciá sesión nuevamente.';
  if (error.status === 403) return 'No tenés permisos para realizar esta acción.';
  if (error.status === 404) return typeof message === 'string' && KNOWN_MESSAGES.some(([pattern]) => pattern.test(message)) ? translate(message) : 'No se encontró el registro. Puede que otra persona lo haya eliminado.';
  if (error.status === 409) return typeof message === 'string' ? translate(message) : 'Ya existe un registro con esos datos o hay información relacionada.';
  if (error.status === 413) return 'El archivo supera el tamaño máximo permitido de 10 MB.';
  if (error.status === 429) return 'Demasiados intentos. Esperá un minuto e intentá nuevamente.';
  if (error.status >= 500) return 'Ocurrió un error en el servidor. Intentá nuevamente en unos minutos.';
  if (error.status === 400) return typeof message === 'string' ? translate(message) : 'Revisá los datos ingresados.';
  return fallback;
}
