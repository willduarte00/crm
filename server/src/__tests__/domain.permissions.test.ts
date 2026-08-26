import { describe, it, expect } from 'vitest';
import {
  PERMISSIONS,
  PERMISSION_CATALOG,
  SCREEN_DEPENDENCIES,
  SCREEN_ORDER,
  SCREEN_ROUTES,
  isValidPermission,
  mergePermissions,
  findScreenDependencyViolations,
  firstAllowedScreen,
} from '../domain/permissions';

describe('Permissions Domain', () => {
  describe('Catalog consistency', () => {
    it('has exactly 44 permissions', () => {
      expect(PERMISSIONS.length).toBe(44);
    });

    it('PERMISSION_CATALOG covers all PERMISSIONS without extras', () => {
      const catalogKeys = PERMISSION_CATALOG.map((p) => p.key);
      const catalogSet = new Set(catalogKeys);
      const permSet = new Set(PERMISSIONS);

      // Check for uniqueness in catalog
      expect(catalogKeys.length).toBe(catalogSet.size);

      // Every item in catalog should be in PERMISSIONS
      for (const key of catalogSet) {
        expect(permSet.has(key)).toBe(true);
      }

      // Every item in PERMISSIONS should be in catalog
      for (const perm of permSet) {
        expect(catalogSet.has(perm)).toBe(true);
      }
    });

    it('SCREEN_DEPENDENCIES uses only valid permissions', () => {
      const permSet = new Set(PERMISSIONS);
      for (const [screen, deps] of Object.entries(SCREEN_DEPENDENCIES)) {
        expect(permSet.has(screen as any)).toBe(true);
        for (const dep of deps) {
          expect(permSet.has(dep)).toBe(true);
        }
      }
    });

    it('SCREEN_ORDER uses only valid permissions', () => {
      const permSet = new Set(PERMISSIONS);
      for (const screen of SCREEN_ORDER) {
        expect(permSet.has(screen)).toBe(true);
      }
    });

    it('SCREEN_ROUTES uses only valid permissions', () => {
      const permSet = new Set(PERMISSIONS);
      for (const screen of Object.keys(SCREEN_ROUTES)) {
        expect(permSet.has(screen as any)).toBe(true);
      }
    });

    it('requiresAnyOf in catalog matches SCREEN_DEPENDENCIES', () => {
      for (const item of PERMISSION_CATALOG) {
        if (item.category === 'Telas') {
          expect(item.requiresAnyOf).toEqual(SCREEN_DEPENDENCIES[item.key]);
        } else {
          expect(item.requiresAnyOf).toBeUndefined();
        }
      }
    });
  });

  describe('mergePermissions', () => {
    it('returns an empty set for 0 groups', () => {
      const result = mergePermissions([]);
      expect(result.size).toBe(0);
    });

    it('returns permissions for 1 group', () => {
      const result = mergePermissions([{ permissions: ['clients.view', 'clients.create'] }]);
      expect(result.size).toBe(2);
      expect(result.has('clients.view')).toBe(true);
      expect(result.has('clients.create')).toBe(true);
    });

    it('merges multiple groups and removes duplicates', () => {
      const result = mergePermissions([
        { permissions: ['clients.view', 'clients.create'] },
        { permissions: ['clients.view', 'contracts.view'] },
      ]);
      expect(result.size).toBe(3);
      expect(result.has('clients.view')).toBe(true);
      expect(result.has('clients.create')).toBe(true);
      expect(result.has('contracts.view')).toBe(true);
    });
  });

  describe('isValidPermission', () => {
    it('returns true for valid permissions', () => {
      expect(isValidPermission('clients.view')).toBe(true);
      expect(isValidPermission('screen.dashboard')).toBe(true);
    });

    it('returns false for invalid permissions', () => {
      expect(isValidPermission('invalid.permission')).toBe(false);
      expect(isValidPermission('')).toBe(false);
    });
  });

  describe('findScreenDependencyViolations', () => {
    it('returns violation when screen lacks any required dependency', () => {
      const violations = findScreenDependencyViolations(['screen.clientes']);
      expect(violations).toHaveLength(1);
      expect(violations[0].screen).toBe('screen.clientes');
      expect(violations[0].missingAnyOf).toEqual(['clients.view']);
    });

    it('returns no violations when screen has required dependency', () => {
      const violations = findScreenDependencyViolations(['screen.clientes', 'clients.view']);
      expect(violations).toHaveLength(0);
    });

    it('handles OR dependencies correctly for screen.dashboard', () => {
      // Nenhum dos dois
      expect(findScreenDependencyViolations(['screen.dashboard'])).toHaveLength(1);
      
      // Apenas um (financial)
      expect(findScreenDependencyViolations(['screen.dashboard', 'dashboard.financial.view'])).toHaveLength(0);
      
      // Apenas o outro (operational)
      expect(findScreenDependencyViolations(['screen.dashboard', 'dashboard.operational.view'])).toHaveLength(0);

      // Ambos
      expect(findScreenDependencyViolations(['screen.dashboard', 'dashboard.financial.view', 'dashboard.operational.view'])).toHaveLength(0);
    });
  });

  describe('firstAllowedScreen', () => {
    it('returns null when set is empty', () => {
      expect(firstAllowedScreen(new Set())).toBeNull();
    });

    it('returns the first allowed screen based on SCREEN_ORDER', () => {
      expect(firstAllowedScreen(new Set(['screen.pipeline', 'screen.clientes']))).toBe('screen.clientes');
      expect(firstAllowedScreen(new Set(['screen.pipeline', 'screen.financeiro']))).toBe('screen.pipeline');
    });

    it('ignores permissions that are not screens', () => {
      expect(firstAllowedScreen(new Set(['clients.view', 'contracts.view']))).toBeNull();
    });
  });
});
