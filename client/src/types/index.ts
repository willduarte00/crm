export interface Group {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  groups: Group[];
  permissions: string[];
}

export interface AuthResponse {
  user: User;
}

export interface ApiError {
  error: string;
  mustChangePassword?: boolean;
  details?: { path: string; message: string }[];
  violations?: { screen: string; missingAnyOf: string[] }[];
}

export interface GroupDetail extends Group {
  description?: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

