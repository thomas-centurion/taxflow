import * as bcrypt from 'bcrypt';
import { AppDataSource } from './data-source';
import { Country } from '../countries/country.entity';
import { Company } from '../companies/company.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { TaxObligationStatus } from '../tax-obligations/tax-obligation-status.enum';
import { TaxObligationType } from '../tax-obligations/tax-obligation-type.enum';

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

function dateOffsetFromToday(offsetDays: number): string {
  const dueDate = new Date();
  dueDate.setUTCHours(0, 0, 0, 0);
  dueDate.setUTCDate(dueDate.getUTCDate() + offsetDays);
  return dueDate.toISOString().slice(0, 10);
}

async function seedDatabase(): Promise<void> {
  const seedPassword = process.env.SEED_USER_PASSWORD;
  if (!seedPassword) throw new Error('SEED_USER_PASSWORD must be set before running the development seed.');

  await AppDataSource.initialize();
  try {
    await AppDataSource.runMigrations();

    const countryRepository = AppDataSource.getRepository(Country);
    await countryRepository.upsert(countries, ['code']);
    const countryByCode = new Map((await countryRepository.find()).map((country) => [country.code, country]));

    const passwordHash = await bcrypt.hash(seedPassword, 12);
    const userRepository = AppDataSource.getRepository(User);
    await userRepository.upsert(userSeeds.map((user) => ({ ...user, passwordHash, isActive: true })), ['email']);
    const userByEmail = new Map((await userRepository.find()).map((user) => [user.email, user]));

    const companySeeds = [
      { name: 'ACME Argentina', taxId: '30-00000001-9', countryCode: 'AR', email: 'tax@acme-ar.example', phone: '+54 11 4000 1001' },
      { name: 'Globex Brazil', taxId: '12.345.678/0001-90', countryCode: 'BR', email: 'fiscal@globex-br.example', phone: '+55 11 4000 2002' },
      { name: 'Wayne Industries Spain', taxId: 'B12345678', countryCode: 'ES', email: 'finance@wayne-es.example', phone: '+34 91 400 3003' },
      { name: 'Northstar US', taxId: 'US-TAX-0004', countryCode: 'US', email: 'tax@northstar-us.example', phone: '+1 212 555 0104' },
    ];
    const companiesToSave = companySeeds.map((company) => {
      const country = countryByCode.get(company.countryCode);
      if (!country) throw new Error(`Seed country ${company.countryCode} was not found.`);
      return { name: company.name, taxId: company.taxId, countryId: country.id, email: company.email, phone: company.phone, isActive: true };
    });
    const companyRepository = AppDataSource.getRepository(Company);
    await companyRepository.upsert(companiesToSave, ['countryId', 'taxId']);
    const savedCompanies = await companyRepository.find();
    const companyByTaxId = new Map(savedCompanies.map((company) => [`${company.countryId}:${company.taxId}`, company]));

    const acme = companiesToSave.find((company) => company.taxId === '30-00000001-9')!;
    const globex = companiesToSave.find((company) => company.taxId === '12.345.678/0001-90')!;
    const wayne = companiesToSave.find((company) => company.taxId === 'B12345678')!;
    const northstar = companiesToSave.find((company) => company.taxId === 'US-TAX-0004')!;
    const manager = userByEmail.get('manager@taxflow.local');
    const analyst = userByEmail.get('analyst@taxflow.local');
    if (!manager || !analyst) throw new Error('Seed responsible users were not found.');

    const obligationSeeds = [
      { company: acme, countryCode: 'AR', name: 'IVA mensual', description: 'Declaración mensual de IVA. Datos ficticios de desarrollo.', type: TaxObligationType.VAT, status: TaxObligationStatus.PENDING, dueDate: dateOffsetFromToday(3), responsibleUserId: manager.id },
      { company: acme, countryCode: 'AR', name: 'Retenciones de ganancias', description: 'Presentación mensual de retenciones.', type: TaxObligationType.WITHHOLDING, status: TaxObligationStatus.IN_PROGRESS, dueDate: dateOffsetFromToday(1), responsibleUserId: analyst.id },
      { company: acme, countryCode: 'AR', name: 'Impuesto a las ganancias', description: 'Obligación anual de ejemplo.', type: TaxObligationType.INCOME_TAX, status: TaxObligationStatus.PENDING, dueDate: dateOffsetFromToday(7), responsibleUserId: manager.id },
      { company: globex, countryCode: 'BR', name: 'Tributo sobre folha', description: 'Obligación de nómina ficticia.', type: TaxObligationType.PAYROLL_TAX, status: TaxObligationStatus.OVERDUE, dueDate: dateOffsetFromToday(-3), responsibleUserId: analyst.id },
      { company: globex, countryCode: 'BR', name: 'Apuração de IVA', description: 'Presentación enviada de ejemplo.', type: TaxObligationType.VAT, status: TaxObligationStatus.SUBMITTED, dueDate: dateOffsetFromToday(-12), responsibleUserId: manager.id },
      { company: wayne, countryCode: 'ES', name: 'Impuesto sobre sociedades', description: 'Obligación aprobada de ejemplo.', type: TaxObligationType.INCOME_TAX, status: TaxObligationStatus.APPROVED, dueDate: dateOffsetFromToday(20), responsibleUserId: analyst.id },
      { company: northstar, countryCode: 'US', name: 'Quarterly estimated tax', description: 'Obligación cancelada de ejemplo.', type: TaxObligationType.OTHER, status: TaxObligationStatus.CANCELLED, dueDate: dateOffsetFromToday(45), responsibleUserId: manager.id },
    ].map((obligation) => {
      const country = countryByCode.get(obligation.countryCode);
      const company = country && companyByTaxId.get(`${country.id}:${obligation.company.taxId}`);
      if (!country || !company) throw new Error(`Seed company for ${obligation.name} was not found.`);
      return {
        companyId: company.id,
        countryId: country.id,
        name: obligation.name,
        description: obligation.description,
        type: obligation.type,
        status: obligation.status,
        dueDate: obligation.dueDate,
        responsibleUserId: obligation.responsibleUserId,
      };
    });
    const obligationRepository = AppDataSource.getRepository(TaxObligation);
    for (const obligation of obligationSeeds) {
      const existing = await obligationRepository.findOneBy({
        companyId: obligation.companyId,
        name: obligation.name,
        type: obligation.type,
      });
      await obligationRepository.save(existing ? { ...existing, ...obligation } : obligation);
    }

    const [userCount, countryCount, companyCount, obligationCount] = await Promise.all([
      userRepository.count(), countryRepository.count(), companyRepository.count(), AppDataSource.getRepository(TaxObligation).count(),
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