export type UserRole = 'ADMIN' | 'TAX_MANAGER' | 'ANALYST';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
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