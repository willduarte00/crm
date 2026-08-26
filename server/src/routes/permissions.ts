import { Router } from 'express';
import { requirePermission } from '../middlewares/requirePermission.js';
import { PERMISSION_CATALOG, SCREEN_DEPENDENCIES } from '../domain/permissions.js';

export const permissionsRouter = Router();

permissionsRouter.get('/', requirePermission('groups.view'), (req, res) => {
  res.json({
    permissions: PERMISSION_CATALOG,
    screenDependencies: SCREEN_DEPENDENCIES
  });
});
