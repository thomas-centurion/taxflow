export type UserRole = 'ADMIN' | 'TAX_MANAGER' | 'ANALYST';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  /** Read-only demo account (backend DEMO_READ_ONLY_EMAILS): every write answers 403. Only sent for the session user. */
  readOnly?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserInput {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  password?: string;
}

/** Minimal active-user entry for responsible pickers and filters (GET /users/options). */
export type UserOption = Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
