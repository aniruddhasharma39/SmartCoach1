import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  SMART_COACH_SERVICES,
  getServiceDefinition,
  fetchServiceDevices,
  supabase,
  getClientForService,
} from '../lib/supabaseClient';
import { getAllDescendantScopeGroupIds } from '../lib/scopeHierarchy';

const router = Router();
router.use(authenticate);

// Helper: Get user's permitted device IDs for a service (Scope Groups 2.0)
async function getUserPermittedDevices(userId: number, role: string, serviceSlug: string): Promise<string[] | null> {
  if (role === 'Developer') {
    return null; // Null means unrestricted access to all devices
  }

  const userScopeRecords = await prisma.scopeGroupUser.findMany({
    where: { userId },
    select: { scopeGroupId: true },
  });

  if (userScopeRecords.length === 0) {
    return [];
  }

  const directIds = userScopeRecords.map((r) => r.scopeGroupId);
  const allAccessibleGroupIds = await getAllDescendantScopeGroupIds(directIds);

  const deviceRecords = await prisma.scopeGroupDevice.findMany({
    where: {
      scopeGroupId: { in: allAccessibleGroupIds },
      serviceSlug,
    },
    select: { deviceId: true },
  });

  return deviceRecords.map((d) => d.deviceId);
}

// 1. List all available Smart Coach services (scoped by user's assigned Scope Groups)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    let allowedSlugs: string[] | null = null;
    if (req.user!.role !== 'Developer') {
      const userScopeRecords = await prisma.scopeGroupUser.findMany({
        where: { userId: req.user!.id },
        select: { scopeGroupId: true },
      });
      if (userScopeRecords.length > 0) {
        const directIds = userScopeRecords.map((r) => r.scopeGroupId);
        const allAccessibleGroupIds = await getAllDescendantScopeGroupIds(directIds);
        const deviceRecords = await prisma.scopeGroupDevice.findMany({
          where: { scopeGroupId: { in: allAccessibleGroupIds } },
          select: { serviceSlug: true },
        });
        allowedSlugs = Array.from(new Set(deviceRecords.map((d) => d.serviceSlug)));
      } else {
        allowedSlugs = [];
      }
    }

    const availableServices = allowedSlugs === null
      ? SMART_COACH_SERVICES
      : SMART_COACH_SERVICES.filter((s) => allowedSlugs!.includes(s.slug));

    const servicesWithCounts = await Promise.all(
      availableServices.map(async (srv) => {
        const allDevices = await fetchServiceDevices(srv.slug);
        const permittedIds = await getUserPermittedDevices(req.user!.id, req.user!.role, srv.slug);
        const deviceCount = permittedIds === null
          ? allDevices.length
          : allDevices.filter((d) => permittedIds.includes(d.deviceId)).length;

        return {
          slug: srv.slug,
          name: srv.name,
          shortCode: srv.shortCode,
          description: srv.description,
          icon: srv.icon,
          tableName: srv.tableName,
          primaryKey: srv.primaryKey,
          deviceCount,
          status: 'ACTIVE',
        };
      })
    );

    res.json({ success: true, services: servicesWithCounts });
  } catch (error: any) {
    console.error('Error listing services:', error);
    res.status(500).json({ error: error.message || 'Failed to list services' });
  }
});

// 2. Get specific service metadata
router.get('/:slug', async (req: AuthRequest, res: Response) => {
  try {
    const srv = getServiceDefinition(req.params.slug);
    if (!srv) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const devices = await fetchServiceDevices(srv.slug);
    res.json({
      success: true,
      service: {
        ...srv,
        deviceCount: devices.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get Devices for a service (Services -> Devices)
router.get('/:slug/devices', async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const srv = getServiceDefinition(slug);
    if (!srv) return res.status(404).json({ error: 'Service not found' });

    const allDevices = await fetchServiceDevices(slug);
    const permittedIds = await getUserPermittedDevices(req.user!.id, req.user!.role, slug);

    const filteredDevices = permittedIds === null
      ? allDevices
      : allDevices.filter((d) => permittedIds.includes(d.deviceId));

    const latestMap = await getLatestTelemetryMap(slug);
    const enrichedDevices = filteredDevices.map((d) => {
      const latest = latestMap.get(d.deviceId) || latestMap.get(d.coachNumber) || null;
      return {
        ...d,
        latestData: latest,
      };
    });

    res.json({
      success: true,
      serviceSlug: slug,
      totalDevices: allDevices.length,
      accessibleDevices: enrichedDevices,
    });
  } catch (error: any) {
    console.error(`Error fetching devices for ${req.params.slug}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Get Attributes & Columns for a service (Devices -> Attributes)
router.get('/:slug/attributes', async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const srv = getServiceDefinition(slug);
    if (!srv) return res.status(404).json({ error: 'Service not found' });

    // Fetch existing custom configs from RDS
    const savedConfigs = await prisma.serviceColumnConfig.findMany({
      where: { serviceSlug: slug },
      orderBy: { sortOrder: 'asc' },
    });

    const savedMap = new Map(savedConfigs.map((c) => [c.columnKey, c]));

    // Merge default configs with saved RDS configs
    const attributes = srv.defaultConfigs.map((def) => {
      const saved = savedMap.get(def.columnKey);
      if (saved) {
        return {
          columnKey: saved.columnKey,
          displayName: saved.displayName,
          dataType: saved.dataType,
          displayStyle: saved.displayStyle,
          isVisible: saved.isVisible,
          isPrimaryKey: saved.isPrimaryKey,
          sortOrder: saved.sortOrder,
          gradientEnabled: saved.gradientEnabled,
          minGoodValue: saved.minGoodValue,
          maxGoodValue: saved.maxGoodValue,
          warningValue: saved.warningValue,
          criticalValue: saved.criticalValue,
          alertTriggerType: saved.alertTriggerType,
          alertThreshold: saved.alertThreshold,
          alertMessage: saved.alertMessage,
          sendSms: saved.sendSms,
          isCustomized: true,
        };
      }
      return {
        ...def,
        sendSms: false,
        isCustomized: false,
      };
    });

    res.json({
      success: true,
      serviceSlug: slug,
      tableName: srv.tableName,
      attributes,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Get Presentation Config (Attributes -> UI -> Presentation)
router.get('/:slug/config', async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const srv = getServiceDefinition(slug);
    if (!srv) return res.status(404).json({ error: 'Service not found' });

    const savedConfigs = await prisma.serviceColumnConfig.findMany({
      where: { serviceSlug: slug },
      orderBy: { sortOrder: 'asc' },
    });

    if (savedConfigs.length > 0) {
      return res.json({ success: true, serviceSlug: slug, configs: savedConfigs });
    }

    // Fallback to default presentation configs
    res.json({
      success: true,
      serviceSlug: slug,
      configs: srv.defaultConfigs,
      isDefault: true,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Save / Update Presentation Config in RDS
router.post('/:slug/config', async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const srv = getServiceDefinition(slug);
    if (!srv) return res.status(404).json({ error: 'Service not found' });

    const { configs } = req.body;
    if (!Array.isArray(configs)) {
      return res.status(400).json({ error: 'configs must be an array' });
    }

    const upsertResults = await Promise.all(
      configs.map((c: any, index: number) => {
        return prisma.serviceColumnConfig.upsert({
          where: {
            serviceSlug_tableName_columnKey: {
              serviceSlug: slug,
              tableName: srv.tableName,
              columnKey: c.columnKey,
            },
          },
          update: {
            displayName: c.displayName,
            dataType: c.dataType || 'string',
            displayStyle: c.displayStyle || 'card',
            isVisible: c.isVisible !== undefined ? c.isVisible : true,
            isPrimaryKey: !!c.isPrimaryKey,
            sortOrder: c.sortOrder !== undefined ? c.sortOrder : index,
            gradientEnabled: !!c.gradientEnabled,
            minGoodValue: c.minGoodValue !== undefined && c.minGoodValue !== '' ? parseFloat(c.minGoodValue) : null,
            maxGoodValue: c.maxGoodValue !== undefined && c.maxGoodValue !== '' ? parseFloat(c.maxGoodValue) : null,
            warningValue: c.warningValue !== undefined && c.warningValue !== '' ? parseFloat(c.warningValue) : null,
            criticalValue: c.criticalValue !== undefined && c.criticalValue !== '' ? parseFloat(c.criticalValue) : null,
            alertTriggerType: c.alertTriggerType || 'NONE',
            alertThreshold: c.alertThreshold ? String(c.alertThreshold) : null,
            alertMessage: c.alertMessage || null,
            sendSms: !!c.sendSms,
          },
          create: {
            serviceSlug: slug,
            tableName: srv.tableName,
            columnKey: c.columnKey,
            displayName: c.displayName,
            dataType: c.dataType || 'string',
            displayStyle: c.displayStyle || 'card',
            isVisible: c.isVisible !== undefined ? c.isVisible : true,
            isPrimaryKey: !!c.isPrimaryKey,
            sortOrder: c.sortOrder !== undefined ? c.sortOrder : index,
            gradientEnabled: !!c.gradientEnabled,
            minGoodValue: c.minGoodValue !== undefined && c.minGoodValue !== '' ? parseFloat(c.minGoodValue) : null,
            maxGoodValue: c.maxGoodValue !== undefined && c.maxGoodValue !== '' ? parseFloat(c.maxGoodValue) : null,
            warningValue: c.warningValue !== undefined && c.warningValue !== '' ? parseFloat(c.warningValue) : null,
            criticalValue: c.criticalValue !== undefined && c.criticalValue !== '' ? parseFloat(c.criticalValue) : null,
            alertTriggerType: c.alertTriggerType || 'NONE',
            alertThreshold: c.alertThreshold ? String(c.alertThreshold) : null,
            alertMessage: c.alertMessage || null,
            sendSms: !!c.sendSms,
          },
        });
      })
    );

    res.json({ success: true, message: 'Presentation configuration updated successfully', count: upsertResults.length });
  } catch (error: any) {
    console.error('Error saving presentation config:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Live Telemetry Data (Strictly Read-Only GET from Supabase)
router.get('/:slug/telemetry', async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const srv = getServiceDefinition(slug);
    if (!srv) return res.status(404).json({ error: 'Service not found' });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const deviceFilter = req.query.deviceId as string | undefined;

    const permittedDevices = await getUserPermittedDevices(req.user!.id, req.user!.role, slug);
    const client = getClientForService(slug);

    let query = client.from(srv.tableName).select('*', { count: 'estimated' });

    // Filter by allowed devices if scoped
    if (permittedDevices !== null && permittedDevices.length > 0) {
      if (srv.tableName === 'hams_data') {
        query = query.in('device_id', permittedDevices);
      } else if (srv.tableName === 'bad_odour_data') {
        query = query.in('device_ID', permittedDevices);
      } else if (srv.tableName === 'bpc_pressure' || srv.tableName === 'brake_fault_event') {
        query = query.in('device_id', permittedDevices);
      } else if (srv.tableName === 'pressure_logs') {
        query = query.in('device_id', permittedDevices);
      }
    } else if (permittedDevices !== null && permittedDevices.length === 0) {
      // User is scoped to 0 devices
      return res.json({ success: true, data: [], total: 0 });
    }

    if (deviceFilter) {
      if (srv.tableName === 'bad_odour_data') {
        query = query.eq('device_ID', deviceFilter);
      } else {
        query = query.eq('device_id', deviceFilter);
      }
    }

    // Order descending by timestamp or primary key id
    if (srv.tableName === 'bpc_pressure' || srv.tableName === 'hams_data' || srv.tableName === 'brake_fault_event' || srv.tableName === 'pressure_logs' || srv.tableName === 'bad_odour_data') {
      query = query.order('id', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error(`Supabase read error on ${srv.tableName}:`, error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      serviceSlug: slug,
      tableName: srv.tableName,
      data: data || [],
      count: count || (data ? data.length : 0),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Fetch latest telemetry snapshot mapped by device_id and coach number
async function getLatestTelemetryMap(slug: string): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  try {
    if (slug === 'bad-odour') {
      const client = getClientForService(slug);
      const { data, error } = await client
        .from('bad_odour_data')
        .select('*')
        .order('id', { ascending: false })
        .limit(50);
      if (!error && data) {
        data.forEach((row) => {
          if (row.device_ID && !map.has(row.device_ID)) map.set(row.device_ID, row);
          if (row.Coach_no && !map.has(row.Coach_no)) map.set(row.Coach_no, row);
        });
      }
    } else if (slug === 'brake-binding') {
      const { data, error } = await supabase
        .from('bpc_pressure')
        .select('*')
        .order('id', { ascending: false })
        .limit(50);
      if (!error && data) {
        data.forEach((row) => {
          if (row.device_id && !map.has(row.device_id)) map.set(row.device_id, row);
          if (row.coach_no && !map.has(row.coach_no)) map.set(row.coach_no, row);
        });
      }
    } else if (slug === 'hot-axle') {
      const { data, error } = await supabase
        .from('hams_data')
        .select('*')
        .order('id', { ascending: false })
        .limit(50);
      if (!error && data) {
        data.forEach((row) => {
          if (row.device_id && !map.has(row.device_id)) map.set(row.device_id, row);
        });
      }
    } else if (slug === 'emergency-brake') {
      const { data, error } = await supabase
        .from('brake_fault_event')
        .select('*')
        .order('id', { ascending: false })
        .limit(40);
      if (!error && data) {
        data.forEach((row) => {
          if (row.device_id && !map.has(row.device_id)) map.set(row.device_id, row);
          if (row.coach_no && !map.has(row.coach_no)) map.set(row.coach_no, row);
        });
      }
    } else if (slug === 'bpc-pressure') {
      const { data, error } = await supabase
        .from('pressure_logs')
        .select('*')
        .order('id', { ascending: false })
        .limit(60);
      if (!error && data) {
        data.forEach((row) => {
          if (row.device_id && !map.has(row.device_id)) map.set(row.device_id, row);
          if (row.coach_number && !map.has(row.coach_number)) map.set(row.coach_number, row);
        });
      }
    }
  } catch (err) {
    console.error(`Error in getLatestTelemetryMap for ${slug}:`, err);
  }
  return map;
}

// 8. Latest KPI Telemetry Snapshot per Device (For Live UI Cards & Badges)
router.get('/:slug/latest', async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const srv = getServiceDefinition(slug);
    if (!srv) return res.status(404).json({ error: 'Service not found' });

    const latestMap = await getLatestTelemetryMap(slug);
    res.json({ success: true, latest: Array.from(latestMap.values()) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
