import { Company } from '../shared/models/company.model';
import { TaxObligation, TaxObligationStatus } from '../shared/models/tax-obligation.model';
import { addDays, todayKey } from '../shared/presentation/format';
import { BadgeTone, OBLIGATION_STATUS } from '../shared/presentation/labels';

export interface StatusRow { status: TaxObligationStatus; label: string; tone: BadgeTone; count: number; percent: number }
export interface CompanyRow { id: string; name: string; open: number; overdue: number }

export interface DashboardMetrics {
  total: number;
  totalCompanies: number;
  overdue: TaxObligation[];
  dueThisWeek: number;
  toFile: number;
  submitted: number;
  upcoming: TaxObligation[];
  statusRows: StatusRow[];
  companyRows: CompanyRow[];
}

const OPEN_STATUSES: TaxObligationStatus[] = ['PENDING', 'IN_PROGRESS'];
const byDueDate = (a: TaxObligation, b: TaxObligation) => a.dueDate.localeCompare(b.dueDate);

/**
 * Derives the dashboard figures from the obligations returned by the API.
 * "Overdue" is the backend's `isOverdue` flag; the frontend never redefines that rule.
 */
export function buildDashboardMetrics(companies: Company[], obligations: TaxObligation[], today = todayKey()): DashboardMetrics {
  const inSevenDays = addDays(today, 7);
  const inThirtyDays = addDays(today, 30);
  const open = obligations.filter((item) => OPEN_STATUSES.includes(item.status) && !item.isOverdue);

  const counts = new Map<TaxObligationStatus, number>();
  for (const item of obligations) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  const statusRows = (Object.keys(OBLIGATION_STATUS) as TaxObligationStatus[]).map((status) => {
    const count = counts.get(status) ?? 0;
    return { status, label: OBLIGATION_STATUS[status].label, tone: OBLIGATION_STATUS[status].tone, count, percent: obligations.length ? (count / obligations.length) * 100 : 0 };
  });

  const companyMetrics = new Map<string, CompanyRow>(companies.map((company) => [company.id, { id: company.id, name: company.name, open: 0, overdue: 0 }]));
  for (const item of obligations) {
    const row = companyMetrics.get(item.companyId);
    if (!row) continue;
    if (item.isOverdue) row.overdue += 1;
    else if (OPEN_STATUSES.includes(item.status)) row.open += 1;
  }

  return {
    total: obligations.length,
    totalCompanies: companies.length,
    overdue: obligations.filter((item) => item.isOverdue).sort(byDueDate),
    dueThisWeek: open.filter((item) => item.dueDate >= today && item.dueDate <= inSevenDays).length,
    toFile: open.length,
    submitted: counts.get('SUBMITTED') ?? 0,
    upcoming: open.filter((item) => item.dueDate >= today && item.dueDate <= inThirtyDays).sort(byDueDate).slice(0, 6),
    statusRows,
    companyRows: [...companyMetrics.values()]
      .filter((row) => row.open || row.overdue)
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name))
      .slice(0, 6),
  };
}
