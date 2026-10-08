import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Observable, of, throwError } from 'rxjs';
import { aRun, anObligation } from '../../../testing/fixtures';
import { FeedbackService } from '../../core/feedback/feedback.service';
import { AutomationRunsApiService } from '../../core/services/automation-runs-api.service';
import { AutomationRun } from '../../shared/models/automation-run.model';
import { TaxObligation } from '../../shared/models/tax-obligation.model';
import { ObligationAutomationPanelComponent } from './obligation-automation-panel.component';

function setup(options: { obligation?: TaxObligation; canManage?: boolean; history?: Observable<AutomationRun[]>; run?: Observable<AutomationRun> } = {}) {
  const api = {
    listForObligation: vi.fn(() => options.history ?? of([aRun({ id: 'old-run', trigger: 'SCHEDULED', requestedBy: null })])),
    run: vi.fn(() => options.run ?? of(aRun())),
  };
  const feedback = { success: vi.fn(), error: vi.fn(), apiError: vi.fn() };
  TestBed.configureTestingModule({
    imports: [ObligationAutomationPanelComponent],
    providers: [provideNoopAnimations(), { provide: AutomationRunsApiService, useValue: api }, { provide: FeedbackService, useValue: feedback }],
  });
  const fixture = TestBed.createComponent(ObligationAutomationPanelComponent);
  fixture.componentRef.setInput('obligation', options.obligation ?? anObligation());
  fixture.componentRef.setInput('canManage', options.canManage ?? true);
  const changed: AutomationRun[] = [];
  fixture.componentInstance.changed.subscribe((run) => changed.push(run));
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = () => element.querySelector<HTMLButtonElement>('.tf-panel-header-actions button');
  return { fixture, component: fixture.componentInstance, api, feedback, changed, element, button };
}

describe('ObligationAutomationPanelComponent', () => {
  it('loads the run history of the obligation', () => {
    const { api, element } = setup();
    expect(api.listForObligation).toHaveBeenCalledWith('obligation-1');
    expect(element.querySelectorAll('table tbody tr').length).toBe(1);
    expect(element.textContent).toContain('Programada');
  });

  it('runs the processing, shows the result first and refreshes the page when the status changed', () => {
    const marked = aRun({ id: 'new-run', result: { previousStatus: 'PENDING', status: 'OVERDUE', overdueMarked: true, notificationsCreated: 1, withoutResponsible: false, durationMs: 15 } });
    const { component, fixture, feedback, changed, element, button } = setup({ run: of(marked) });
    button()!.click();
    fixture.detectChanges();
    expect(component.runs().map((run) => run.id)).toEqual(['new-run', 'old-run']);
    expect(feedback.success).toHaveBeenCalledWith('Procesamiento completado: marcada como vencida · 1 alerta enviada');
    expect(changed).toEqual([marked]);
    expect(element.querySelector('.current')?.getAttribute('data-status')).toBe('SUCCEEDED');
  });

  it('does not refresh the page when nothing changed', () => {
    const { button, changed, feedback } = setup();
    button()!.click();
    expect(feedback.success).toHaveBeenCalledWith('Procesamiento completado: sin cambios');
    expect(changed).toEqual([]);
  });

  it('reports a failed run with its explanation', () => {
    const failed = aRun({ status: 'FAILED', errorCode: 'NOT_PROCESSABLE', result: { durationMs: 3 } });
    const { button, feedback } = setup({ run: of(failed) });
    button()!.click();
    expect(feedback.error).toHaveBeenCalledWith('El procesamiento falló: La obligación ya no está pendiente, en curso ni vencida.');
  });

  it('shows the API error when the run cannot start (e.g. already running)', () => {
    const conflict = new HttpErrorResponse({ status: 409, error: { message: 'This obligation is already being processed.' } });
    const { button, feedback, component } = setup({ run: throwError(() => conflict) });
    button()!.click();
    expect(feedback.apiError).toHaveBeenCalledWith(conflict, 'No se pudo procesar la obligación.');
    expect(component.processing()).toBe(false);
  });

  it('disables the action for obligations that no longer need processing and explains why', () => {
    const { button, component } = setup({ obligation: anObligation({ status: 'SUBMITTED' }) });
    expect(button()!.disabled).toBe(true);
    expect(component.blockReason()).toContain('Presentada');
  });

  it('hides the action from roles that cannot manage obligations', () => {
    const { button } = setup({ canManage: false });
    expect(button()).toBeNull();
  });

  it('shows a load error instead of the history', () => {
    const { element } = setup({ history: throwError(() => new HttpErrorResponse({ status: 500 })) });
    expect(element.querySelector('[role="alert"]')?.textContent).toMatch(/error en el servidor/);
    expect(element.querySelector('table')).toBeNull();
  });
});
