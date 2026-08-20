export type Role = 'admin' | 'membro';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
}

export interface ApiError {
  error: string;
  mustChangePassword?: boolean;
  details?: { path: string; message: string }[];
}
