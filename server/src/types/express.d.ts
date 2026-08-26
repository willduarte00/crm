export interface AuthUser {
  id: string;
  email: string;
  name: string;
  groups: { id: string; name: string; permissions: string[] }[];
  permissions: Set<string>;
  mustChangePassword: boolean;
  active: boolean;
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
