import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticate);

const CANONICAL_ORDER = [
  'services',
  'brake-binding',
  'hot-axle',
  'bad-odour',
  'emergency-brake',
  'bpc-pressure',
  'scope-groups',
  'manage-users',
  'registration',
  'roles',
  'branding',
];

router.get('/', async (req, res, next) => {
  try {
    const modules = await prisma.module.findMany({
      where: {
        slug: { notIn: ['lc-gates', 'cluster'] }
      }
    });
    modules.sort((a, b) => {
      let idxA = CANONICAL_ORDER.indexOf(a.slug);
      let idxB = CANONICAL_ORDER.indexOf(b.slug);
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      if (idxA !== idxB) return idxA - idxB;
      return a.name.localeCompare(b.name);
    });
    res.json(modules);
  } catch (error) {
    next(error);
  }
});

export default router;
