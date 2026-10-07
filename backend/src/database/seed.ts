import * as bcrypt from 'bcrypt';
import { AppDataSource } from './data-source';
import { assertSeedAllowed } from './seed-guard';
import { Country } from '../countries/country.entity';
import { Company } from '../companies/company.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { TaxObligationStatus } from '../tax-obligations/tax-obligation-status.enum';
import { TaxObligationType } from '../tax-obligations/tax-obligation-type.enum';
import { todayKey } from '../tax-obligations/tax-obligation-rules';

/*
 * Development seed. It only inserts records that do not exist yet: existing countries, users (passwords,
 * roles, active flags), companies and obligations (status, due dates) are never modified, so it is safe
 * to run repeatedly. It refuses to run with NODE_ENV=production.
 */

const countries = [
  { name: 'Argentina', code: 'AR' },
  { name: 'Brazil', code: 'BR' },
  { name: 'Spain', code: 'ES' },
  { name: 'United States', code: 'US' },
];

const userSeeds = [
  { firstName: 'Admin', lastName: 'TaxFlow', email: 'admin@taxflow.local', role: UserRole.ADMIN },
  { firstName: 'Taylor', lastName: 'Manager', email: 'manager@taxflow.local', role: UserRole.TAX_MANAGER },
  { firstName: 'Alex', lastName: 'Analyst', email: 'analyst@taxflow.local', role: UserRole.ANALYST },
];

const companySeeds = [
  { name: 'ACME Argentina', taxId: '30-00000001-9', countryCode: 'AR', email: 'tax@acme-ar.example', phone: '+54 11 4000 1001' },
  { name: 'Globex Brazil', taxId: '12.345.678/0001-90', countryCode: 'BR', email: 'fiscal@globex-br.example', phone: '+55 11 4000 2002' },
  { name: 'Wayne Industries Spain', taxId: 'B12345678', countryCode: 'ES', email: 'finance@wayne-es.example', phone: '+34 91 400 3003' },
  { name: 'Northstar US', taxId: 'US-TAX-0004', countryCode: 'US', email: 'tax@northstar-us.example', phone: '+1 212 555 0104' },
];

/** Due dates are calendar days in the backend process timezone, the same reference used by the overdue rule. */
function dateOffsetFromToday(offsetDays: number): string {
  const now = new Date();
  return todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays));
}

async function seedDatabase(): Promise<void> {
  const seedPassword = assertSeedAllowed(process.env);

  await AppDataSource.initialize();
  try {
    await AppDataSource.runMigrations();

    const countryRepository = AppDataSource.getRepository(Country);
    await countryRepository.createQueryBuilder().insert().into(Country).values(countries).orIgnore().execute();
    const countryByCode = new Map((await countryRepository.find()).map((country) => [country.code, country]));

    const passwordHash = await bcrypt.hash(seedPassword, 12);
    const userRepository = AppDataSource.getRepository(User);
    await userRepository.createQueryBuilder().insert().into(User)
      .values(userSeeds.map((user) => ({ ...user, passwordHash, isActive: true }))).orIgnore().execute();
    const userByEmail = new Map((await userRepository.find()).map((user) => [user.email, user]));

    const companyRepository = AppDataSource.getRepository(Company);
    const companiesToInsert = companySeeds.map((company) => {
      const country = countryByCode.get(company.countryCode);
      if (!country) throw new Error(`Seed country ${company.countryCode} was not found.`);
      return { name: company.name, taxId: company.taxId, countryId: country.id, email: company.email, phone: company.phone, isActive: true };
    });
    await companyRepository.createQueryBuilder().insert().into(Company).values(companiesToInsert).orIgnore().execute();
    const companyByKey = new Map((await companyRepository.find()).map((company) => [`${company.countryId}:${company.taxId}`, company]));

    const manager = userByEmail.get('manager@taxflow.local');
    const analyst = userByEmail.get('analyst@taxflow.local');
    if (!manager || !analyst) throw new Error('Seed responsible users were not found.');

    const obligationSeeds = [
      { taxId: '30-00000001-9', countryCode: 'AR', name: 'IVA mensual', description: 'Declaración mensual de IVA. Datos ficticios de desarrollo.', type: TaxObligationType.VAT, status: TaxObligationStatus.PENDING, dueDate: dateOffsetFromToday(3), responsibleUserId: manager.id },
      { taxId: '30-00000001-9', countryCode: 'AR', name: 'Retenciones de ganancias', description: 'Presentación mensual de retenciones.', type: TaxObligationType.WITHHOLDING, status: TaxObligationStatus.IN_PROGRESS, dueDate: dateOffsetFromToday(1), responsibleUserId: analyst.id },
      { taxId: '30-00000001-9', countryCode: 'AR', name: 'Impuesto a las ganancias', description: 'Obligación anual de ejemplo.', type: TaxObligationType.INCOME_TAX, status: TaxObligationStatus.PENDING, dueDate: dateOffsetFromToday(7), responsibleUserId: manager.id },
      { taxId: '12.345.678/0001-90', countryCode: 'BR', name: 'Tributo sobre folha', description: 'Obligación de nómina ficticia.', type: TaxObligationType.PAYROLL_TAX, status: TaxObligationStatus.OVERDUE, dueDate: dateOffsetFromToday(-3), responsibleUserId: analyst.id },
      { taxId: '12.345.678/0001-90', countryCode: 'BR', name: 'Apuração de IVA', description: 'Presentación enviada de ejemplo.', type: TaxObligationType.VAT, status: TaxObligationStatus.SUBMITTED, dueDate: dateOffsetFromToday(-12), responsibleUserId: manager.id },
      { taxId: 'B12345678', countryCode: 'ES', name: 'Impuesto sobre sociedades', description: 'Obligación aprobada de ejemplo.', type: TaxObligationType.INCOME_TAX, status: TaxObligationStatus.APPROVED, dueDate: dateOffsetFromToday(20), responsibleUserId: analyst.id },
      { taxId: 'US-TAX-0004', countryCode: 'US', name: 'Quarterly estimated tax', description: 'Obligación cancelada de ejemplo.', type: TaxObligationType.OTHER, status: TaxObligationStatus.CANCELLED, dueDate: dateOffsetFromToday(45), responsibleUserId: manager.id },
    ];
    const obligationRepository = AppDataSource.getRepository(TaxObligation);
    for (const { taxId, countryCode, ...obligation } of obligationSeeds) {
      const country = countryByCode.get(countryCode);
      const company = country && companyByKey.get(`${country.id}:${taxId}`);
      if (!country || !company) throw new Error(`Seed company for ${obligation.name} was not found.`);
      // Seed obligations are identified without the due date, which is relative to the day the seed runs.
      if (await obligationRepository.existsBy({ companyId: company.id, name: obligation.name, type: obligation.type })) continue;
      await obligationRepository.insert({ ...obligation, companyId: company.id, countryId: country.id });
    }

    const [userCount, countryCount, companyCount, obligationCount] = await Promise.all([
      userRepository.count(), countryRepository.count(), companyRepository.count(), obligationRepository.count(),
    ]);
    console.log(`Development seed complete: ${userCount} users, ${countryCount} countries, ${companyCount} companies, ${obligationCount} tax obligations.`);
  } finally {
    await AppDataSource.destroy();
  }
}

void seedDatabase().catch((error: unknown) => {
  console.error('Development seed failed.', error);
  process.exitCode = 1;
});
