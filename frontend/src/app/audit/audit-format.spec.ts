import { AuditLog } from '../shared/models/audit-log.model';
import { auditActor, auditChanges, auditDetails, auditSummary, auditValue } from './audit-format';

const log = (overrides: Partial<AuditLog> = {}): AuditLog => ({
  id: 'log-1', actorType: 'USER', actorEmail: 'manager@taxflow.local', actor: { id: 'u1', firstName: 'Taylor', lastName: 'Manager', email: 'manager@taxflow.local' },
  action: 'UPDATE', entity: 'TaxObligation', entityId: 'o1', metadata: null, createdAt: '2026-10-08T12:00:00.000Z', ...overrides,
});

describe('audit presentation', () => {
  it('renders field values with business labels', () => {
    expect(auditValue('status', 'OVERDUE')).toBe('Vencida');
    expect(auditValue('type', 'VAT')).toBe('IVA');
    expect(auditValue('role', 'ADMIN')).toBe('Administrador');
    expect(auditValue('dueDate', '2026-10-20')).toBe('20/10/2026');
    expect(auditValue('size', 2048)).toBe('2 KB');
    expect(auditValue('isActive', false)).toBe('No');
    expect(auditValue('responsibleUserId', '8de3a564-f432-4b48-a98a-8b2e4ef85493')).toBe('ID …f85493');
    expect(auditValue('description', null)).toBe('—');
  });

  it('names the actor, including system events and deleted users', () => {
    expect(auditActor(log())).toBe('Taylor Manager');
    expect(auditActor(log({ actorType: 'SYSTEM', actor: null, actorEmail: null }))).toBe('Sistema (automatización)');
    expect(auditActor(log({ actor: null }))).toBe('manager@taxflow.local');
    expect(auditActor(log({ actor: null, actorEmail: null, action: 'LOGIN_FAILED' }))).toBe('Sin sesión');
    expect(auditActor(log({ actor: null, actorEmail: null }))).toBe('Usuario eliminado');
  });

  it('describes changes as before → after with readable labels', () => {
    const update = log({ metadata: { automationRunId: 'run-1', changes: { status: { before: 'PENDING', after: 'OVERDUE' } } } });
    expect(auditChanges(update)).toEqual([{ field: 'status', label: 'Estado', before: 'Pendiente', after: 'Vencida' }]);
    expect(auditSummary(update)).toBe('Estado: Pendiente → Vencida');
    expect(auditDetails(update)).toEqual([{ label: 'Ejecución', value: 'run-1' }]);
  });

  it('summarizes long change lists and events without changes', () => {
    const many = log({ metadata: { changes: { name: { before: 'A', after: 'B' }, status: { before: 'PENDING', after: 'IN_PROGRESS' }, dueDate: { before: '2026-10-01', after: '2026-10-02' } } } });
    expect(auditSummary(many)).toBe('Nombre: A → B · Estado: Pendiente → En curso · y 1 más');
    expect(auditSummary(log({ action: 'UPLOAD', metadata: { originalFilename: 'iva.pdf' } }))).toBe('iva.pdf');
    expect(auditSummary(log({ action: 'CREATE', metadata: { values: { firstName: 'Ana', lastName: 'Gómez' } } }))).toBe('Ana Gómez');
  });
});
