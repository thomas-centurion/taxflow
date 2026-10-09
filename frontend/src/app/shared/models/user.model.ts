export type UserRole = 'ADMIN' | 'TAX_MANAGER' | 'ANALYST';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
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

export type UserOption = Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
