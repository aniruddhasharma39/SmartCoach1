import React, { useState, useEffect, useMemo } from 'react';
import {
  FaLayerGroup,
  FaPlus,
  FaSearch,
  FaTrash,
  FaEdit,
  FaUsers,
  FaTimes,
  FaArrowLeft,
  FaFolder,
  FaFolderOpen,
  FaFolderPlus,
  FaTachometerAlt,
  FaThermometerHalf,
  FaWind,
  FaExclamationTriangle,
  FaMicrochip,
  FaInfoCircle
} from 'react-icons/fa';
import type { User, ScopeGroupItem, SmartCoachService, ServiceDevice } from '../../types';
import { API_URL } from '../../config';
import { RAILWAY_ZONES } from '../Cluster/railwayData';
import { useToast } from '../../context/ToastContext';
import './ScopeGroupManagement.css';

type Props = {
  user: User;
};

const COLOR_PRESETS = [
  '#0B3C7A', // Navy
  '#0e9aa7', // Teal
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#0284c7', // Sky Blue
];

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

export default function ScopeGroupManagement({ user }: Props) {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  
  // Developer role can manage; assigned operators have read-only scope visibility
  const isAssigned = Boolean(user.scopeGroups && user.scopeGroups.length > 0);
  const canManage = user.role === 'Developer' && !isAssigned;

  const [scopeGroups, setScopeGroups] = useState<ScopeGroupItem[]>([]);
  const [allServices, setAllServices] = useState<SmartCoachService[]>([]);
  const [serviceDevicesMap, setServiceDevicesMap] = useState<Record<string, ServiceDevice[]>>({});
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // View Navigation: 'list' | 'group_detail'
  const [viewMode, setViewMode] = useState<'list' | 'group_detail'>('list');
  const [activeGroup, setActiveGroup] = useState<ScopeGroupItem | null>(null);
  const [detailFilterService, setDetailFilterService] = useState<string>('ALL');
  const [detailSearchQuery, setDetailSearchQuery] = useState('');

  // Railway Hierarchy references
  const zones = RAILWAY_ZONES;

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'details' | 'services' | 'users'>('details');
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState('#0B3C7A');
  const [formParentId, setFormParentId] = useState<number | null>(null);
  
  // Smart Coach: Map of serviceSlug -> Set of deviceIds
  const [selectedServiceDevices, setSelectedServiceDevices] = useState<Map<string, Set<string>>>(new Map());
  const [activeServiceInPicker, setActiveServiceInPicker] = useState<string>('brake-binding');
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // User Picker Filters
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Delete Confirmation Modal
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<ScopeGroupItem | null>(null);

  // 1. Fetch Scope Groups
  const fetchScopeGroups = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/scope-groups`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setScopeGroups(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch scope groups:', err);
    }
  };

  // 2. Fetch all Smart Coach Services & their deployed devices
  const fetchServicesAndDevices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/services`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const servicesList: SmartCoachService[] = data.services || [];
        setAllServices(servicesList);

        // Fetch devices for each service
        const devicesMap: Record<string, ServiceDevice[]> = {};
        await Promise.all(
          servicesList.map(async (srv) => {
            try {
              const devRes = await fetch(`${API_URL}/api/v1/services/${srv.slug}/devices`, { headers: authHeaders() });
              if (devRes.ok) {
                const devData = await devRes.json();
                devicesMap[srv.slug] = devData.accessibleDevices || [];
              }
            } catch (err) {
              console.error(`Failed to fetch devices for ${srv.slug}:`, err);
            }
          })
        );
        setServiceDevicesMap(devicesMap);
      }
    } catch (err) {
      console.error('Failed to fetch services:', err);
    }
  };

  // 3. Fetch all Users
  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/users`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const usersList = data?.users || (Array.isArray(data) ? data : []);
        setAllUsers(usersList);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchScopeGroups(), fetchServicesAndDevices(), fetchAllUsers()]);
    setLoading(false);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Icon Helper for Services
  const getServiceIcon = (slug: string) => {
    switch (slug) {
      case 'brake-binding':
        return <FaTachometerAlt style={{ color: '#ef4444' }} />;
      case 'hot-axle':
        return <FaThermometerHalf style={{ color: '#f59e0b' }} />;
      case 'bad-odour':
        return <FaWind style={{ color: '#10b981' }} />;
      case 'emergency-brake':
        return <FaExclamationTriangle style={{ color: '#dc2626' }} />;
      case 'bpc-pressure':
        return <FaMicrochip style={{ color: '#0284c7' }} />;
      default:
        return <FaMicrochip />;
    }
  };

  // Helper to resolve parent group
  const resolveParent = (group: ScopeGroupItem): ScopeGroupItem | null => {
    if (!group.parentId) return null;
    return scopeGroups.find(g => g.id === group.parentId) || null;
  };

  // Check if a group represents a Railway Zone
  const isRailwayZone = (name: string) => {
    const lower = name.toLowerCase();
    return lower.includes('railway') || zones.some(z => lower.includes(z.toLowerCase().replace(/s$/, '')));
  };

  // Filter root groups
  const rootGroups = useMemo(() => {
    return scopeGroups.filter(g => !g.parentId);
  }, [scopeGroups]);

  // Compute stats
  const stats = useMemo(() => {
    const totalGroups = scopeGroups.length;
    let totalDevices = 0;
    const uniqueUsers = new Set<number>();
    const activeServiceSlugs = new Set<string>();

    scopeGroups.forEach(g => {
      totalDevices += (g.devices?.length || 0);
      g.devices?.forEach(d => activeServiceSlugs.add(d.serviceSlug));
      g.users?.forEach(u => uniqueUsers.add(u.user.id));
    });

    return {
      totalGroups,
      rootCount: rootGroups.length,
      subGroupCount: Math.max(0, totalGroups - rootGroups.length),
      activeServicesCount: activeServiceSlugs.size,
      totalDevices,
      totalUsers: uniqueUsers.size
    };
  }, [scopeGroups, rootGroups]);

  // Open Scope Group Details View
  const handleCardClick = (group: ScopeGroupItem) => {
    setActiveGroup(group);
    setDetailFilterService('ALL');
    setDetailSearchQuery('');
    setViewMode('group_detail');
  };

  // Open Create Modal
  const handleOpenCreate = (preselectedParentId?: number | null | React.MouseEvent) => {
    if (!canManage) return;
    setEditingGroupId(null);
    setFormName('');
    setFormDesc('');
    setFormColor('#0B3C7A');
    const pId = typeof preselectedParentId === 'number' ? preselectedParentId : null;
    setFormParentId(pId);
    setSelectedServiceDevices(new Map());
    setSelectedUserIds(new Set());
    setFormError(null);
    setModalTab('details');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (group: ScopeGroupItem) => {
    if (!canManage) return;
    setEditingGroupId(group.id);
    setFormName(group.name);
    setFormDesc(group.description || '');
    setFormColor(group.color || '#0B3C7A');
    setFormParentId(group.parentId ?? null);

    // Map existing devices: serviceSlug -> Set of deviceIds
    const devMap = new Map<string, Set<string>>();
    (group.devices || []).forEach(d => {
      if (!devMap.has(d.serviceSlug)) {
        devMap.set(d.serviceSlug, new Set());
      }
      devMap.get(d.serviceSlug)!.add(d.deviceId);
    });

    setSelectedServiceDevices(devMap);
    setSelectedUserIds(new Set(group.users?.map(u => u.user.id) || []));
    setFormError(null);
    setModalTab('details');
    setIsModalOpen(true);
  };

  // Toggle Service Subscription in Picker
  const toggleServiceSubscription = (slug: string) => {
    setSelectedServiceDevices(prev => {
      const next = new Map(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        // Select all devices of this service by default
        const allDevs = serviceDevicesMap[slug] || [];
        next.set(slug, new Set(allDevs.map(d => d.deviceId)));
      }
      return next;
    });
  };

  // Toggle single device within a service
  const toggleDeviceSelection = (serviceSlug: string, deviceId: string) => {
    setSelectedServiceDevices(prev => {
      const next = new Map(prev);
      if (!next.has(serviceSlug)) {
        next.set(serviceSlug, new Set([deviceId]));
      } else {
        const deviceSet = new Set(next.get(serviceSlug)!);
        if (deviceSet.has(deviceId)) {
          deviceSet.delete(deviceId);
        } else {
          deviceSet.add(deviceId);
        }
        if (deviceSet.size === 0) {
          next.delete(serviceSlug);
        } else {
          next.set(serviceSlug, deviceSet);
        }
      }
      return next;
    });
  };

  // Select all devices for a service
  const selectAllDevicesForService = (slug: string) => {
    const devs = serviceDevicesMap[slug] || [];
    setSelectedServiceDevices(prev => {
      const next = new Map(prev);
      next.set(slug, new Set(devs.map(d => d.deviceId)));
      return next;
    });
  };

  // Deselect all devices for a service
  const deselectAllDevicesForService = (slug: string) => {
    setSelectedServiceDevices(prev => {
      const next = new Map(prev);
      next.delete(slug);
      return next;
    });
  };

  // Toggle Single User
  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // Submit Create or Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    if (!formName.trim()) {
      setFormError('Please enter a Scope Group name');
      toastWarning('Please enter a Scope Group name.', 'Validation');
      setModalTab('details');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const isEditing = Boolean(editingGroupId);
    const trimmedName = formName.trim();

    // Flatten selected devices payload: [{ serviceSlug, deviceId }]
    const flatServiceDevices: { serviceSlug: string; deviceId: string }[] = [];
    selectedServiceDevices.forEach((deviceSet, slug) => {
      deviceSet.forEach(devId => {
        flatServiceDevices.push({ serviceSlug: slug, deviceId: devId });
      });
    });

    const payload = {
      name: trimmedName,
      description: formDesc.trim() || null,
      color: formColor,
      parentId: formParentId,
      serviceDevices: flatServiceDevices,
      userIds: Array.from(selectedUserIds)
    };

    try {
      const url = isEditing
        ? `${API_URL}/api/v1/scope-groups/${editingGroupId}`
        : `${API_URL}/api/v1/scope-groups`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save Scope Group');
      }

      toastSuccess(
        isEditing
          ? `Scope Group "${trimmedName}" updated with ${flatServiceDevices.length} devices across ${selectedServiceDevices.size} services.`
          : `Created Scope Group "${trimmedName}" with ${flatServiceDevices.length} devices allocated.`,
        isEditing ? 'Scope Group Updated' : 'Scope Group Created'
      );

      setIsModalOpen(false);
      await fetchScopeGroups();
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while saving');
      toastError(err.message || 'Error saving Scope Group', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Scope Group
  const handleDeleteGroup = async () => {
    if (!deleteConfirmGroup) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/scope-groups/${deleteConfirmGroup.id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete Scope Group');
      }
      toastSuccess(`Scope Group "${deleteConfirmGroup.name}" deleted.`, 'Deleted');
      setDeleteConfirmGroup(null);
      if (activeGroup?.id === deleteConfirmGroup.id) {
        setViewMode('list');
        setActiveGroup(null);
      }
      await fetchScopeGroups();
    } catch (err: any) {
      toastError(err.message || 'Error deleting group', 'Error');
    }
  };

  return (
    <div className="sg-container">
      {/* Header */}
      <div className="sg-header">
        <div className="sg-header-titles">
          <h2>
            <FaLayerGroup /> Scope Group Management
          </h2>
          <p>
            Define railway zonal and divisional scopes, allocate Smart Coach services and devices, and govern operator access.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {!canManage && (
            <div className="sg-readonly-badge">
              <FaInfoCircle color="var(--primary)" />
              <span>Assigned Scope View (Restricted by Role)</span>
            </div>
          )}

          {canManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenCreate()}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <FaPlus /> Create Scope Group
            </button>
          )}
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="sg-stats-grid">
        <div className="sg-stat-card">
          <div className="sg-stat-label">TOTAL SCOPE GROUPS</div>
          <div className="sg-stat-value">{stats.totalGroups}</div>
          <div className="sg-stat-sub">{stats.rootCount} Zones / Roots &bull; {stats.subGroupCount} Divisions</div>
        </div>

        <div className="sg-stat-card">
          <div className="sg-stat-label">ACTIVE SERVICES ALLOCATED</div>
          <div className="sg-stat-value" style={{ color: '#0284c7' }}>
            {stats.activeServicesCount} / {allServices.length}
          </div>
          <div className="sg-stat-sub">Brake Binding, Bad Odour, Hot Axle, etc.</div>
        </div>

        <div className="sg-stat-card">
          <div className="sg-stat-label">TOTAL ROLLING STOCK DEVICES</div>
          <div className="sg-stat-value" style={{ color: '#10b981' }}>
            {stats.totalDevices}
          </div>
          <div className="sg-stat-sub">Hardware units mapped to scopes</div>
        </div>

        <div className="sg-stat-card">
          <div className="sg-stat-label">ASSIGNED TEAM MEMBERS</div>
          <div className="sg-stat-value" style={{ color: '#8b5cf6' }}>
            {stats.totalUsers}
          </div>
          <div className="sg-stat-sub">Operators & Officers in scopes</div>
        </div>
      </div>

      {/* MAIN VIEW: LIST OF SCOPE GROUPS */}
      {viewMode === 'list' && (
        <div className="card" style={{ padding: 24, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0, color: '#1e293b', fontWeight: 800 }}>Railway Scope Hierarchy</h3>
            <div style={{ position: 'relative', width: 280 }}>
              <FaSearch style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search Scope Groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
              <p>Loading Scope Groups...</p>
            </div>
          ) : scopeGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
              <FaFolderOpen size={48} style={{ color: '#cbd5e1', marginBottom: 12 }} />
              <h4>No Scope Groups Defined</h4>
              <p>Create zonal and divisional scope groups to allocate rolling-stock monitoring services and devices.</p>
              {canManage && (
                <button type="button" className="btn btn-primary" onClick={() => handleOpenCreate()}>
                  <FaPlus style={{ marginRight: 6 }} /> Create First Scope Group
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {scopeGroups
                .filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()) || (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase())))
                .map((group) => {
                  const parentGroup = resolveParent(group);
                  const isZone = isRailwayZone(group.name);

                  // Extract services assigned to this group
                  const serviceCounts: Record<string, number> = {};
                  (group.devices || []).forEach(d => {
                    serviceCounts[d.serviceSlug] = (serviceCounts[d.serviceSlug] || 0) + 1;
                  });

                  return (
                    <div
                      key={group.id}
                      className="card"
                      style={{
                        padding: 20,
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        borderLeft: `5px solid ${group.color || '#0B3C7A'}`
                      }}
                      onClick={() => handleCardClick(group)}
                    >
                      <div>
                        {parentGroup && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FaFolder size={11} /> {parentGroup.name} &rsaquo;
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem', fontWeight: 800 }}>
                            {group.name}
                          </h4>
                          {isZone && (
                            <span className="badge" style={{ backgroundColor: 'rgba(11, 60, 122, 0.08)', color: 'var(--primary)', fontSize: '0.72rem' }}>
                              Railway Zone
                            </span>
                          )}
                        </div>

                        {group.description && (
                          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.4 }}>
                            {group.description}
                          </p>
                        )}

                        {/* Allocated Services Badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                          {Object.keys(serviceCounts).length === 0 ? (
                            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#94a3b8', fontSize: '0.72rem' }}>
                              No Services Allocated
                            </span>
                          ) : (
                            Object.entries(serviceCounts).map(([slug, count]) => {
                              const srv = allServices.find(s => s.slug === slug);
                              return (
                                <span
                                  key={slug}
                                  className="badge"
                                  style={{
                                    backgroundColor: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    color: '#1e293b',
                                    fontSize: '0.74rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5
                                  }}
                                >
                                  {getServiceIcon(slug)}
                                  <strong>{srv?.shortCode || slug}</strong>: {count} devs
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
                          <FaUsers style={{ marginRight: 6, color: '#8b5cf6' }} />
                          {group.users?.length || 0} Members
                        </span>

                        {canManage && (
                          <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => handleOpenCreate(group.id)}
                              title="Add sub-division under this group"
                            >
                              <FaFolderPlus />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => handleOpenEdit(group)}
                              title="Edit group"
                            >
                              <FaEdit />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => setDeleteConfirmGroup(group)}
                              style={{ color: '#ef4444' }}
                              title="Delete group"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* DETAIL VIEW FOR A SPECIFIC SCOPE GROUP */}
      {viewMode === 'group_detail' && activeGroup && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Card with Breadcrumb Navigation */}
          <div className="card" style={{ padding: '20px 24px', borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setViewMode('list')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <FaArrowLeft /> Back to Scope Groups
              </button>

              {canManage && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => handleOpenEdit(activeGroup)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <FaEdit /> Edit Scope Allocation
                  </button>
                </div>
              )}
            </div>

            <div style={{ borderLeft: `6px solid ${activeGroup.color || '#0B3C7A'}`, paddingLeft: 16 }}>
              <h2 style={{ margin: '0 0 6px 0', color: '#1e293b', fontWeight: 800 }}>
                {activeGroup.name}
              </h2>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.92rem' }}>
                {activeGroup.description || 'Dedicated rolling stock service scope group.'}
              </p>
            </div>
          </div>

          {/* Allocated Smart Coach Services & Devices */}
          <div className="card" style={{ padding: 24, borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b', fontWeight: 800 }}>
                  Allocated Smart Coach Services & Devices ({activeGroup.devices?.length || 0})
                </h3>
                <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                  Hardware units visible to users assigned to this scope.
                </p>
              </div>

              {/* Search & Service Filter Tabs */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 220 }}>
                  <FaSearch style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search devices..."
                    value={detailSearchQuery}
                    onChange={(e) => setDetailSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${detailFilterService === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setDetailFilterService('ALL')}
                  >
                    All Services
                  </button>
                  {allServices.map(srv => {
                    const count = (activeGroup.devices || []).filter(d => d.serviceSlug === srv.slug).length;
                    if (count === 0) return null;
                    return (
                      <button
                        key={srv.slug}
                        type="button"
                        className={`btn btn-sm ${detailFilterService === srv.slug ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setDetailFilterService(srv.slug)}
                      >
                        {srv.shortCode} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {(!activeGroup.devices || activeGroup.devices.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                <FaMicrochip size={36} style={{ marginBottom: 8, color: '#cbd5e1' }} />
                <p>No services or devices have been allocated to this Scope Group yet.</p>
                {canManage && (
                  <button type="button" className="btn btn-outline" onClick={() => handleOpenEdit(activeGroup)}>
                    Configure Services & Devices
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '12px 14px' }}>Service</th>
                      <th style={{ padding: '12px 14px' }}>Device ID</th>
                      <th style={{ padding: '12px 14px' }}>Coach Number</th>
                      <th style={{ padding: '12px 14px' }}>Train Number</th>
                      <th style={{ padding: '12px 14px' }}>Location / Zone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeGroup.devices
                      .filter(d => {
                        const matchService = detailFilterService === 'ALL' || d.serviceSlug === detailFilterService;
                        if (!matchService) return false;
                        if (!detailSearchQuery) return true;
                        const q = detailSearchQuery.toLowerCase();
                        return (
                          d.deviceId.toLowerCase().includes(q) ||
                          (d.serviceSlug && d.serviceSlug.toLowerCase().includes(q))
                        );
                      })
                      .map((d) => {
                        const srv = allServices.find(s => s.slug === d.serviceSlug);
                        const devInfo = (serviceDevicesMap[d.serviceSlug] || []).find(dev => dev.deviceId === d.deviceId);

                        return (
                          <tr key={`${d.serviceSlug}-${d.deviceId}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 14px' }}>
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: '#f1f5f9',
                                  color: '#1e293b',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                {getServiceIcon(d.serviceSlug)}
                                {srv?.name || d.serviceSlug}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--primary)' }}>
                              {d.deviceId}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                                {devInfo?.coachNumber || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px' }}>{devInfo?.trainNumber || '—'}</td>
                            <td style={{ padding: '12px 14px' }}>{devInfo?.location || 'Indian Railways'}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assigned Team Members Table */}
          <div className="card" style={{ padding: 24, borderRadius: 16 }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontWeight: 800 }}>
              Assigned Team Members ({activeGroup.users?.length || 0})
            </h3>
            {(!activeGroup.users || activeGroup.users.length === 0) ? (
              <p className="text-muted" style={{ margin: 0 }}>No team members assigned to this scope group.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px' }}>Full Name</th>
                      <th style={{ padding: '10px 14px' }}>Email</th>
                      <th style={{ padding: '10px 14px' }}>Role</th>
                      <th style={{ padding: '10px 14px' }}>Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeGroup.users.map((item) => (
                      <tr key={item.user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{item.user.fullName}</td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>{item.user.email}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span className="badge" style={{ backgroundColor: 'rgba(11, 60, 122, 0.08)', color: 'var(--primary)' }}>
                            {item.user.role?.name || 'User'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>{item.user.department || 'Operations'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT SCOPE GROUP MODAL */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal"
            style={{ width: 840, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', borderRadius: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800 }}>
                {editingGroupId ? 'Edit Scope Group Allocation' : 'Create Scope Group'}
              </h3>
              <button type="button" className="icon-btn" onClick={() => setIsModalOpen(false)}>
                <FaTimes />
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#f8fafc', padding: '0 16px' }}>
              <button
                type="button"
                className={`tab-btn ${modalTab === 'details' ? 'active' : ''}`}
                onClick={() => setModalTab('details')}
                style={{ padding: '12px 18px', border: 'none', background: 'none', fontWeight: 700, cursor: 'pointer', borderBottom: modalTab === 'details' ? '3px solid var(--primary)' : '3px solid transparent' }}
              >
                1. Details & Structure
              </button>

              <button
                type="button"
                className={`tab-btn ${modalTab === 'services' ? 'active' : ''}`}
                onClick={() => setModalTab('services')}
                style={{ padding: '12px 18px', border: 'none', background: 'none', fontWeight: 700, cursor: 'pointer', borderBottom: modalTab === 'services' ? '3px solid var(--primary)' : '3px solid transparent' }}
              >
                2. Services & Devices ({selectedServiceDevices.size} Active)
              </button>

              <button
                type="button"
                className={`tab-btn ${modalTab === 'users' ? 'active' : ''}`}
                onClick={() => setModalTab('users')}
                style={{ padding: '12px 18px', border: 'none', background: 'none', fontWeight: 700, cursor: 'pointer', borderBottom: modalTab === 'users' ? '3px solid var(--primary)' : '3px solid transparent' }}
              >
                3. Team Members ({selectedUserIds.size})
              </button>
            </div>

            <form onSubmit={handleSubmitForm} style={{ padding: 24 }}>
              {formError && (
                <div style={{ padding: 12, backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: 8, marginBottom: 16 }}>
                  {formError}
                </div>
              )}

              {/* TAB 1: DETAILS & STRUCTURE */}
              {modalTab === 'details' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', marginBottom: 6 }}>
                      Scope Group Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Nagpur Division, Central Railway, Howrah Zone"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', marginBottom: 6 }}>
                      Description
                    </label>
                    <textarea
                      placeholder="Scope boundary description..."
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', marginBottom: 6 }}>
                        Parent Scope Group (Zonal Hierarchy)
                      </label>
                      <select
                        value={formParentId === null ? '' : formParentId}
                        onChange={(e) => setFormParentId(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}
                      >
                        <option value="">None (Top-Level Railway Zone / Root Group)</option>
                        {scopeGroups
                          .filter(g => editingGroupId ? g.id !== editingGroupId : true)
                          .map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', marginBottom: 6 }}>
                        Color Tag
                      </label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {COLOR_PRESETS.map(c => (
                          <div
                            key={c}
                            onClick={() => setFormColor(c)}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              backgroundColor: c,
                              cursor: 'pointer',
                              border: formColor === c ? '3px solid #000' : '2px solid transparent'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SERVICES & DEPLOYED DEVICES SELECTION */}
              {modalTab === 'services' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                    Select which Smart Coach rolling-stock services and specific hardware devices will be accessible to this scope.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, minHeight: 380 }}>
                    {/* Left: Services Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderRight: '1px solid var(--border)', paddingRight: 16 }}>
                      {allServices.map((srv) => {
                        const isSubscribed = selectedServiceDevices.has(srv.slug);
                        const selectedCount = selectedServiceDevices.get(srv.slug)?.size || 0;
                        const totalCount = (serviceDevicesMap[srv.slug] || []).length;

                        return (
                          <div
                            key={srv.slug}
                            onClick={() => setActiveServiceInPicker(srv.slug)}
                            style={{
                              padding: '12px 14px',
                              borderRadius: 10,
                              cursor: 'pointer',
                              backgroundColor: activeServiceInPicker === srv.slug ? 'rgba(11, 60, 122, 0.08)' : '#ffffff',
                              border: activeServiceInPicker === srv.slug ? '1.5px solid var(--primary)' : '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input
                                type="checkbox"
                                checked={isSubscribed}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleServiceSubscription(srv.slug);
                                }}
                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {getServiceIcon(srv.slug)}
                                <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>{srv.shortCode}</strong>
                              </div>
                            </div>

                            <span className="badge" style={{ fontSize: '0.72rem', backgroundColor: isSubscribed ? '#e0f2fe' : '#f1f5f9', color: isSubscribed ? '#0369a1' : '#94a3b8' }}>
                              {selectedCount}/{totalCount}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right: Device Picker for active service */}
                    {activeServiceInPicker && (() => {
                      const srv = allServices.find(s => s.slug === activeServiceInPicker);
                      const allDevs = serviceDevicesMap[activeServiceInPicker] || [];
                      const selectedSet = selectedServiceDevices.get(activeServiceInPicker) || new Set();

                      const filteredDevs = allDevs.filter(d => {
                        const q = deviceSearchQuery.toLowerCase();
                        return (
                          d.deviceId.toLowerCase().includes(q) ||
                          (d.coachNumber && d.coachNumber.toLowerCase().includes(q)) ||
                          (d.location && d.location.toLowerCase().includes(q)) ||
                          (d.trainNumber && d.trainNumber.toLowerCase().includes(q))
                        );
                      });

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{srv?.name}</strong>
                              <span className="badge" style={{ backgroundColor: '#f1f5f9' }}>
                                {selectedSet.size} of {allDevs.length} Selected
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => selectAllDevicesForService(activeServiceInPicker)}
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => deselectAllDevicesForService(activeServiceInPicker)}
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          <div style={{ position: 'relative' }}>
                            <FaSearch style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                            <input
                              type="text"
                              placeholder="Search devices by coach, train, or division..."
                              value={deviceSearchQuery}
                              onChange={(e) => setDeviceSearchQuery(e.target.value)}
                              style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}
                            />
                          </div>

                          <div style={{ overflowY: 'auto', maxHeight: 300, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                            {filteredDevs.length === 0 ? (
                              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                No devices found for {srv?.name}.
                              </div>
                            ) : (
                              filteredDevs.map(dev => {
                                const isChecked = selectedSet.has(dev.deviceId);
                                return (
                                  <div
                                    key={dev.deviceId}
                                    onClick={() => toggleDeviceSelection(activeServiceInPicker, dev.deviceId)}
                                    style={{
                                      padding: '8px 12px',
                                      borderBottom: '1px solid #f1f5f9',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      cursor: 'pointer',
                                      backgroundColor: isChecked ? 'rgba(11, 60, 122, 0.04)' : undefined
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                                      />
                                      <div>
                                        <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>{dev.deviceId}</strong>
                                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                          Coach: <strong>{dev.coachNumber || '—'}</strong> &bull; Train: {dev.trainNumber || '—'}
                                        </div>
                                      </div>
                                    </div>

                                    <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.75rem' }}>
                                      {dev.location || 'Indian Railways'}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* TAB 3: ASSIGNED TEAM MEMBERS */}
              {modalTab === 'users' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p className="text-muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                      Select users (e.g. Division Officers, Zonal Officers) who will receive access to this Scope Group.
                    </p>
                    <span className="badge" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
                      {selectedUserIds.size} Users Selected
                    </span>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <FaSearch style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search users by name, email, department..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid var(--border)' }}
                    />
                  </div>

                  <div style={{ overflowY: 'auto', maxHeight: 320, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    {allUsers
                      .filter(u => {
                        const q = userSearchQuery.toLowerCase();
                        return (
                          (u.fullName && u.fullName.toLowerCase().includes(q)) ||
                          (u.email && u.email.toLowerCase().includes(q)) ||
                          (u.department && u.department.toLowerCase().includes(q)) ||
                          (u.role?.name && u.role.name.toLowerCase().includes(q))
                        );
                      })
                      .map(u => {
                        const isChecked = selectedUserIds.has(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => toggleUserSelection(u.id)}
                            style={{
                              padding: '10px 14px',
                              borderBottom: '1px solid #f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              backgroundColor: isChecked ? 'rgba(11, 60, 122, 0.04)' : undefined
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                              />
                              <div>
                                <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{u.fullName}</strong>
                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                  {u.email} &bull; {u.department || 'Operations'}
                                </div>
                              </div>
                            </div>

                            <span className="badge" style={{ backgroundColor: 'rgba(11, 60, 122, 0.08)', color: 'var(--primary)' }}>
                              {u.role?.name || 'User'}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingGroupId ? 'Save Scope Allocation' : 'Create Scope Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmGroup && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirmGroup(null)}>
          <div className="modal" style={{ width: 440, padding: 24, borderRadius: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px 0', color: '#b91c1c' }}>Delete Scope Group</h3>
            <p style={{ fontSize: '0.92rem', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{deleteConfirmGroup.name}</strong>? Users assigned to this scope will lose access to its allocated devices.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <button type="button" className="btn btn-outline" onClick={() => setDeleteConfirmGroup(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteGroup}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
