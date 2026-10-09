import { UserRole } from '../users/user-role.enum';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  /** Read-only demo account (DEMO_READ_ONLY_EMAILS): every write is rejected. */
  readOnly?: boolean;
}
