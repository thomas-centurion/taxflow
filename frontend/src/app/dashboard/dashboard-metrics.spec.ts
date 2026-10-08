import { aCompany, anObligation } from '../../testing/fixtures';
import { buildDashboardMetrics } from './dashboard-metrics';

describe('buildDashboardMetrics', () => {
  const today = '2026-10-08';
  const acme = aCompany({ id: 'acme', name: 'ACME' });
  const globex = aCompany({ id: 'globex', name: 'Globex' });
  const idle = aCompany({ id: 'idle', name: 'Idle' });

  const obligations = [
    // Overdue comes from the backend flag, whatever the status says.
    anObligation({ id: 'late-pending', company: acme, status: 'PENDING', isOverdue: true, dueDate: '2026-10-01' }),
    anObligation({ id: 'late-marked', company: globex, status: 'OVERDUE', isOverdue: true, dueDate: '2026-09-20' }),
    anObligation({ id: 'today', company: acme, status: 'IN_PROGRESS', dueDate: '2026-10-08' }),
    anObligation({ id: 'in-a-week', company: acme, status: 'PENDING', dueDate: '2026-10-15' }),
    anObligation({ id: 'in-three-weeks', company: globex, status: 'PENDING', dueDate: '2026-10-29' }),
    anObligation({ id: 'far', company: globex, status: 'PENDING', dueDate: '2026-12-31' }),
    anObligation({ id: 'submitted', company: acme, status: 'SUBMITTED', dueDate: '2026-10-10' }),
    anObligation({ id: 'approved', company: acme, status: 'APPROVED', dueDate: '2026-09-01' }),
  ];

  const metrics = buildDashboardMetrics([acme, globex, idle], obligations, today);

  it('counts totals, work to file and obligations due this week', () => {
    expect(metrics.total).toBe(8);
    expect(metrics.totalCompanies).toBe(3);
    expect(metrics.toFile).toBe(4);
    expect(metrics.dueThisWeek).toBe(2);
    expect(metrics.submitted).toBe(1);
  });

  it('lists overdue obligations by due date using only the backend flag', () => {
    expect(metrics.overdue.map((item) => item.id)).toEqual(['late-marked', 'late-pending']);
  });

  it('lists the next 30 days of open obligations, soonest first', () => {
    expect(metrics.upcoming.map((item) => item.id)).toEqual(['today', 'in-a-week', 'in-three-weeks']);
  });

  it('distributes obligations by status with percentages', () => {
    const pending = metrics.statusRows.find((row) => row.status === 'PENDING');
    expect(pending).toMatchObject({ count: 4, percent: 50, label: 'Pendiente' });
    expect(metrics.statusRows.reduce((sum, row) => sum + row.count, 0)).toBe(8);
  });

  it('ranks companies by overdue then open work and hides companies without pending work', () => {
    expect(metrics.companyRows).toEqual([
      { id: 'acme', name: 'ACME', open: 2, overdue: 1 },
      { id: 'globex', name: 'Globex', open: 2, overdue: 1 },
    ]);
  });

  it('handles an empty portfolio', () => {
    const empty = buildDashboardMetrics([], [], today);
    expect(empty.total).toBe(0);
    expect(empty.statusRows.every((row) => row.percent === 0)).toBe(true);
    expect(empty.companyRows).toEqual([]);
  });
});
