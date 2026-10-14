import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireModule, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// 1. Get calling user's assigned scopes & accessible gate IDs
router.get('/my-scope', async (req: AuthRequest, res, next) => {
  try {
    const isDeveloper = req.user?.role === 'Developer';
    
    // Check actual assigned scope groups for this user
    const userScopeRecords = await prisma.scopeGroupUser.findMany({
      where: { userId: req.user!.id },
      include: {
        scopeGroup: {
          include: {
            gates: {
              select: { gateId: true }
            }
          }
        }
      }
    });

    const assignedGroups = userScopeRecords.map(r => ({
      id: r.scopeGroup.id,
      name: r.scopeGroup.name,
      color: r.scopeGroup.color,
      description: r.scopeGroup.description,
      gateCount: r.scopeGroup.gates.length
    }));

    const gateIdSet = new Set<number>();
    userScopeRecords.forEach(r => {
      r.scopeGroup.gates.forEach(g => gateIdSet.add(g.gateId));
    });

    // If user has assigned scope groups, they MUST be returned regardless of role
    if (assignedGroups.length > 0) {
      return res.json({
        isDeveloper,
        scopeGroups: assignedGroups,
        accessibleGateIds: Array.from(gateIdSet),
        allAccess: false,
        hasAssignedScopes: true
      });
    }

    // If Developer has NO specific scope groups assigned, they have full access
    if (isDeveloper) {
      const allGroups = await prisma.scopeGroup.findMany({
        select: { id: true, name: true, color: true }
      });
      return res.json({
        isDeveloper: true,
        scopeGroups: allGroups,
        allAccess: true,
        hasAssignedScopes: false
      });
    }

    // Regular user with no assigned scopes
    res.json({
      isDeveloper: false,
      scopeGroups: [],
      accessibleGateIds: [],
      allAccess: false,
      hasAssignedScopes: false
    });
  } catch (error) {
    next(error);
  }
});

// Admin / Scope Manager guard helper
const requireScopeAdmin = async (req: AuthRequest, res: any, next: any) => {
  try {
    if (req.user?.role !== 'Developer') {
      return res.status(403).json({ error: 'Forbidden: Only administrators can create, edit, or delete scope groups' });
    }
    // Check if user is restricted by being assigned to a scope group
    const assignedCount = await prisma.scopeGroupUser.count({
      where: { userId: req.user!.id }
    });
    if (assignedCount > 0) {
      return res.status(403).json({ error: 'Forbidden: Assigned scope members have read-only access and cannot create or modify scope groups' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

// 2. List Scope Groups (Admins see all; assigned users see only their assigned scope group)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const isDeveloper = req.user?.role === 'Developer';
    const assignedUserRecords = await prisma.scopeGroupUser.findMany({
      where: { userId: req.user!.id },
      select: { scopeGroupId: true }
    });
    const hasAssignedScopes = assignedUserRecords.length > 0;

    // Check access permission
    if (!isDeveloper && !hasAssignedScopes && !req.user?.allowedModules.includes('scope-groups')) {
      return res.status(403).json({ error: 'Forbidden: Access to Scope Groups required' });
    }

    const whereClause: any = {};
    if (hasAssignedScopes) {
      whereClause.id = { in: assignedUserRecords.map(r => r.scopeGroupId) };
    }

    const groups = await prisma.scopeGroup.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { gates: true, users: true }
        },
        gates: {
          include: {
            gate: {
              include: {
                masters: {
                  orderBy: { masterSequence: 'asc' },
                  include: {
                    childDevices: {
                      orderBy: { deviceSequence: 'asc' },
                      include: { evidences: true }
                    },
                    evidences: true
                  }
                }
              }
            }
          }
        },
        users: hasAssignedScopes ? false : {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                mobile: true,
                department: true,
                status: true,
                role: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    });

    res.json(groups);
  } catch (error) {
    next(error);
  }
});

// 3. Get single Scope Group by ID
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid scope group ID' });

    const isDeveloper = req.user?.role === 'Developer';
    const assignedUserRecords = await prisma.scopeGroupUser.findMany({
      where: { userId: req.user!.id },
      select: { scopeGroupId: true }
    });
    const hasAssignedScopes = assignedUserRecords.length > 0;

    if (hasAssignedScopes && !assignedUserRecords.some(r => r.scopeGroupId === id)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this scope group' });
    }

    const group = await prisma.scopeGroup.findUnique({
      where: { id },
      include: {
        gates: {
          include: {
            gate: {
              include: {
                masters: {
                  orderBy: { masterSequence: 'asc' },
                  include: {
                    childDevices: {
                      orderBy: { deviceSequence: 'asc' },
                      include: { evidences: true }
                    },
                    evidences: true
                  }
                }
              }
            }
          }
        },
        users: hasAssignedScopes ? false : {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                mobile: true,
                department: true,
                status: true,
                role: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    });

    if (!group) return res.status(404).json({ error: 'Scope Group not found' });
    res.json(group);
  } catch (error) {
    next(error);
  }
});

const scopeGroupSchema = z.object({
  name: z.string().min(1, 'Scope Group name is required').max(100),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Invalid hex color').optional().nullable(),
  gateIds: z.array(z.number().int()).optional(),
  userIds: z.array(z.number().int()).optional(),
});

// 4. Create Scope Group
router.post('/', requireScopeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const data = scopeGroupSchema.parse(req.body);
    const existing = await prisma.scopeGroup.findUnique({ where: { name: data.name } });
    if (existing) {
      return res.status(400).json({ error: 'A Scope Group with this name already exists' });
    }

    const gateIds = Array.from(new Set(data.gateIds || []));
    const userIds = Array.from(new Set(data.userIds || []));

    const group = await prisma.scopeGroup.create({
      data: {
        name: data.name,
        description: data.description || null,
        color: data.color || '#0B3C7A',
        gates: {
          create: gateIds.map(gateId => ({ gateId }))
        },
        users: {
          create: userIds.map(userId => ({ userId }))
        }
      },
      include: {
        _count: { select: { gates: true, users: true } },
        gates: { include: { gate: true } },
        users: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                mobile: true,
                department: true,
                role: true
              }
            }
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_SCOPE_GROUP',
        details: `Created scope group "${group.name}" with ${gateIds.length} gates and ${userIds.length} users`
      }
    });

    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
});

// 5. Update Scope Group
router.put('/:id', requireScopeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid scope group ID' });

    const data = scopeGroupSchema.parse(req.body);

    const existing = await prisma.scopeGroup.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Scope Group not found' });

    // Check unique name if changing
    if (data.name !== existing.name) {
      const nameConflict = await prisma.scopeGroup.findUnique({ where: { name: data.name } });
      if (nameConflict) {
        return res.status(400).json({ error: 'Another Scope Group with this name already exists' });
      }
    }

    const gateIds = data.gateIds ? Array.from(new Set(data.gateIds)) : undefined;
    const userIds = data.userIds ? Array.from(new Set(data.userIds)) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      // Update basic fields
      await tx.scopeGroup.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description !== undefined ? data.description : existing.description,
          color: data.color !== undefined ? data.color : existing.color,
        }
      });

      // Sync gates if provided
      if (gateIds !== undefined) {
        await tx.scopeGroupGate.deleteMany({ where: { scopeGroupId: id } });
        if (gateIds.length > 0) {
          await tx.scopeGroupGate.createMany({
            data: gateIds.map(gateId => ({ scopeGroupId: id, gateId }))
          });
        }
      }

      // Sync users if provided
      if (userIds !== undefined) {
        await tx.scopeGroupUser.deleteMany({ where: { scopeGroupId: id } });
        if (userIds.length > 0) {
          await tx.scopeGroupUser.createMany({
            data: userIds.map(userId => ({ scopeGroupId: id, userId }))
          });
        }
      }

      return tx.scopeGroup.findUnique({
        where: { id },
        include: {
          _count: { select: { gates: true, users: true } },
          gates: { include: { gate: true } },
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  mobile: true,
                  department: true,
                  role: true
                }
              }
            }
          }
        }
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_SCOPE_GROUP',
        details: `Updated scope group "${data.name}" (ID: ${id})`
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// 6. Delete Scope Group
router.delete('/:id', requireScopeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid scope group ID' });

    const existing = await prisma.scopeGroup.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Scope Group not found' });

    await prisma.scopeGroup.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETE_SCOPE_GROUP',
        details: `Deleted scope group "${existing.name}" (ID: ${id})`
      }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// 7. Update scopes assigned to a specific user (Convenience endpoint for Manage Users)
router.put('/user/:userId', requireScopeAdmin, async (req: AuthRequest, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const bodySchema = z.object({
      scopeGroupIds: z.array(z.number().int())
    });
    const { scopeGroupIds } = bodySchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const cleanScopeIds = Array.from(new Set(scopeGroupIds));

    await prisma.$transaction(async (tx) => {
      await tx.scopeGroupUser.deleteMany({ where: { userId } });
      if (cleanScopeIds.length > 0) {
        await tx.scopeGroupUser.createMany({
          data: cleanScopeIds.map(scopeGroupId => ({ userId, scopeGroupId }))
        });
      }
    });

    const updatedUserScopes = await prisma.scopeGroupUser.findMany({
      where: { userId },
      include: { scopeGroup: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'ASSIGN_USER_SCOPES',
        details: `Assigned user ${user.fullName} (${userId}) to ${cleanScopeIds.length} scope groups`
      }
    });

    res.json({
      userId,
      scopeGroups: updatedUserScopes.map(s => s.scopeGroup)
    });
  } catch (error) {
    next(error);
  }
});

export default router;
