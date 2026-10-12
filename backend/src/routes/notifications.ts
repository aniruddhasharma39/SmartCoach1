import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Helper to get or create user notification state from AppSetting
async function getUserNotificationState(userId: number): Promise<{ readIds: string[]; dismissedIds: string[] }> {
  try {
    const settingKey = `user_notifs_${userId}`;
    const setting = await prisma.appSetting.findUnique({
      where: { key: settingKey }
    });
    if (!setting) {
      return { readIds: [], dismissedIds: [] };
    }
    const parsed = JSON.parse(setting.value);
    return {
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
      dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : []
    };
  } catch {
    return { readIds: [], dismissedIds: [] };
  }
}

async function saveUserNotificationState(userId: number, state: { readIds: string[]; dismissedIds: string[] }) {
  const settingKey = `user_notifs_${userId}`;
  const value = JSON.stringify(state);
  await prisma.appSetting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value },
    update: { value }
  });
}

// GET all notifications associated with the user's role
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    const isDev = user.role === 'Developer';
    const canManageUsers = isDev || user.allowedModules?.includes('manage-users');
    const canAccessClusters = isDev || user.allowedModules?.includes('cluster');

    const state = await getUserNotificationState(user.id);
    const dismissedSet = new Set(state.dismissedIds);
    const readSet = new Set(state.readIds);

    const notifications: Array<{
      id: string;
      type: 'user_request' | 'cluster_created' | 'device_registered' | 'system';
      title: string;
      message: string;
      createdAt: string;
      isRead: boolean;
      targetModule?: string;
    }> = [];

    // 1. New user request for approval
    if (canManageUsers) {
      const pendingRequests = await prisma.registrationRequest.findMany({
        where: { status: 'PENDING' },
        include: { form: true },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      for (const reqItem of pendingRequests) {
        const id = `req_${reqItem.id}`;
        if (dismissedSet.has(id)) continue;

        let applicantName = 'New Applicant';
        try {
          const reqData = JSON.parse(reqItem.data || '{}');
          if (reqData.fullName) applicantName = reqData.fullName;
        } catch {}

        notifications.push({
          id,
          type: 'user_request',
          title: 'New User Request',
          message: `${applicantName} has submitted registration for approval.`,
          createdAt: reqItem.createdAt.toISOString(),
          isRead: readSet.has(id),
          targetModule: 'manage-users'
        });
      }
    }

    // 2. New cluster creation
    if (canAccessClusters) {
      const gates = await prisma.lCGate.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15
      });

      for (const gate of gates) {
        const id = `cluster_${gate.id}`;
        if (dismissedSet.has(id)) continue;

        notifications.push({
          id,
          type: 'cluster_created',
          title: 'New Cluster Created',
          message: `Cluster LC #${gate.lcNumber} (${gate.locationName}) is live.`,
          createdAt: gate.createdAt.toISOString(),
          isRead: readSet.has(id),
          targetModule: 'cluster'
        });
      }

      // 3. New device registered (MasterUnit and ChildDevice)
      const masters = await prisma.masterUnit.findMany({
        include: { gate: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      for (const master of masters) {
        const id = `master_${master.id}`;
        if (dismissedSet.has(id)) continue;

        notifications.push({
          id,
          type: 'device_registered',
          title: 'New Device Registered',
          message: `Master Unit #${master.serialNumber} registered at Gate #${master.gate?.lcNumber || 'N/A'}.`,
          createdAt: master.createdAt.toISOString(),
          isRead: readSet.has(id),
          targetModule: 'cluster'
        });
      }

      const childDevices = await prisma.childDevice.findMany({
        include: { master: { include: { gate: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      for (const child of childDevices) {
        const id = `child_${child.id}`;
        if (dismissedSet.has(id)) continue;

        notifications.push({
          id,
          type: 'device_registered',
          title: 'New Child Device',
          message: `${child.type} #${child.serialNumber} linked to Gate #${child.master?.gate?.lcNumber || 'N/A'}.`,
          createdAt: child.createdAt.toISOString(),
          isRead: readSet.has(id),
          targetModule: 'cluster'
        });
      }
    }

    // Sort by latest createdAt descending
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
router.post('/read-all', async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    const { notificationIds } = req.body;
    const state = await getUserNotificationState(user.id);

    const newReadSet = new Set(state.readIds);
    if (Array.isArray(notificationIds)) {
      notificationIds.forEach(id => newReadSet.add(id));
    }
    state.readIds = Array.from(newReadSet);

    await saveUserNotificationState(user.id, state);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// Mark single notification as read
router.put('/:id/read', async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    const notifId = req.params.id;
    const state = await getUserNotificationState(user.id);

    if (!state.readIds.includes(notifId)) {
      state.readIds.push(notifId);
      await saveUserNotificationState(user.id, state);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Dismiss single notification
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    const notifId = req.params.id;
    const state = await getUserNotificationState(user.id);

    if (!state.dismissedIds.includes(notifId)) {
      state.dismissedIds.push(notifId);
      await saveUserNotificationState(user.id, state);
    }

    res.json({ success: true, message: 'Notification dismissed' });
  } catch (error) {
    next(error);
  }
});

export default router;
