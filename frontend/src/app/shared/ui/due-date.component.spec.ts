import { TestBed } from '@angular/core/testing';
import { TaxObligationStatus } from '../models/tax-obligation.model';
import { addDays, calendarDate, todayKey } from '../presentation/format';
import { DueDateComponent } from './due-date.component';

function render(value: string, status: TaxObligationStatus, overdue = false): HTMLElement {
  const fixture = TestBed.createComponent(DueDateComponent);
  fixture.componentRef.setInput('value', value);
  fixture.componentRef.setInput('status', status);
  fixture.componentRef.setInput('overdue', overdue);
  fixture.detectChanges();
  return fixture.nativeElement.querySelector('.due') as HTMLElement;
}

describe('DueDateComponent', () => {
  const today = todayKey();

  it('shows the calendar date and how far away it is for open obligations', () => {
    const due = addDays(today, 20);
    const element = render(due, 'PENDING');
    expect(element.querySelector('.date')?.textContent).toBe(calendarDate(due));
    expect(element.querySelector('.hint')?.textContent).toBe('Vence en 20 días');
    expect(element.classList.contains('soon')).toBe(false);
  });

  it('highlights obligations due within a week', () => {
    const element = render(addDays(today, 3), 'IN_PROGRESS');
    expect(element.classList.contains('soon')).toBe(true);
    expect(element.querySelector('.hint')?.textContent).toBe('Vence en 3 días');
  });

  it('marks overdue obligations only when the backend says so', () => {
    const element = render(addDays(today, -2), 'OVERDUE', true);
    expect(element.classList.contains('overdue')).toBe(true);
    expect(element.querySelector('.hint')?.textContent).toBe('Vencida hace 2 días');
  });

  it('shows no hint for obligations that no longer need work', () => {
    for (const status of ['SUBMITTED', 'APPROVED', 'CANCELLED'] as const) {
      const element = render(addDays(today, -10), status);
      expect(element.querySelector('.hint')).toBeNull();
      expect(element.classList.contains('overdue')).toBe(false);
    }
  });
});
