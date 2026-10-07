import { AuditLog } from '../audit/audit-log.entity';
import { Company } from '../companies/company.entity';
import { Country } from '../countries/country.entity';
import { Document } from '../documents/document.entity';
import { Notification } from '../notifications/notification.entity';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { User } from '../users/user.entity';

export const entities = [AuditLog, Company, Country, Document, Notification, TaxObligation, User];