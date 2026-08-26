export type PermissionKey = string;

export interface PermissionMeta {
  key: PermissionKey;
  label: string;
  category: string;
  requiresAnyOf?: PermissionKey[];
}

export interface PermissionCatalog {
  permissions: PermissionMeta[];
  screenDependencies: Record<string, PermissionKey[]>;
}
