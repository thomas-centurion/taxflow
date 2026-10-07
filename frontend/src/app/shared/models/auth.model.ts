import { User } from './user.model';

export interface AuthResponse { accessToken: string; tokenType: 'Bearer'; user: User }
export interface LoginCredentials { email: string; password: string }