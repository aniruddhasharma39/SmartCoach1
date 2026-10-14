import React, { useState, useEffect, useMemo } from 'react';
import {
  FaLayerGroup,
  FaPlus,
  FaSearch,
  FaTrash,
  FaEdit,
  FaUsers,
  FaTimes,
  FaSyncAlt,
  FaMicrochip,
  FaTag,
  FaCheckDouble,
  FaLock,
  FaArrowLeft,
  FaChevronRight,
  FaSun,
  FaBolt,
  FaPlug,
  FaTrain,
  FaCogs,
  FaMapMarkerAlt
} from 'react-icons/fa';
import type { User, ScopeGroupItem } from '../../types';
import { API_URL } from '../../config';
import { RAILWAY_ZONES, RAILWAY_DATA } from '../Cluster/railwayData';
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
  // If user is assigned to any scope group, or is not a developer, they are restricted to read-only scope view
  const isAssigned = Boolean(user.scopeGroups && user.scopeGroups.length > 0);
  const canManage = user.role === 'Developer' && !isAssigned;

  const [scopeGroups, setScopeGroups] = useState<ScopeGroupItem[]>([]);
  const [allGates, setAllGates] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // View Navigation: 'list' | 'group_detail' | 'gate_detail'
  const [viewMode, setViewMode] = useState<'list' | 'group_detail' | 'gate_detail'>('list');
  const [activeGroup, setActiveGroup] = useState<ScopeGroupItem | null>(null);
  const [activeGate, setActiveGate] = useState<any | null>(null);
  const [activeGateSearch, setActiveGateSearch] = useState('');
  const [activeGateLoading, setActiveGateLoading] = useState(false);

  // Zone/Division reference
  const zones = RAILWAY_ZONES;
  const divisionsByZone = RAILWAY_DATA;

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'details' | 'gates' | 'users'>('details');
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState('#0B3C7A');
  const [selectedGateIds, setSelectedGateIds] = useState<Set<number>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Gate Picker Filters
  const [gateFilterZone, setGateFilterZone] = useState('');
  const [gateFilterDivision, setGateFilterDivision] = useState('');
  const [gateSearchQuery, setGateSearchQuery] = useState('');

  // User Picker Filters
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');

  // Delete Confirmation Modal
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<ScopeGroupItem | null>(null);

  // Fetch Scope Groups
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

  // Fetch all Gates (unrestricted call for Developers/Admins)
  const fetchAllGates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/lcgate`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllGates(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch gates:', err);
    }
  };

  // Fetch all Users
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
    if (canManage) {
      await Promise.all([fetchScopeGroups(), fetchAllGates(), fetchAllUsers()]);
    } else {
      await fetchScopeGroups();
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Compute Aggregate Stats
  const stats = useMemo(() => {
    const totalGroups = scopeGroups.length;
    const uniqueScopedGates = new Set<number>();
    const uniqueUsersInScopes = new Set<number>();

    scopeGroups.forEach(g => {
      g.gates?.forEach(item => uniqueScopedGates.add(item.gate.id));
      g.users?.forEach(item => uniqueUsersInScopes.add(item.user.id));
    });

    return {
      totalGroups,
      totalGates: uniqueScopedGates.size,
      totalUsers: uniqueUsersInScopes.size
    };
  }, [scopeGroups]);

  // Filtered Scope Groups for List View
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return scopeGroups;
    return scopeGroups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      (g.description && g.description.toLowerCase().includes(q))
    );
  }, [scopeGroups, searchQuery]);

  // Open Group Detail Page
  const handleCardClick = (group: ScopeGroupItem) => {
    setActiveGroup(group);
    setActiveGate(null);
    setActiveGateSearch('');
    setViewMode('group_detail');
  };

  // Open Gate Detail Page
  const handleGateClick = async (gate: any) => {
    setActiveGate(gate);
    setViewMode('gate_detail');
    setActiveGateLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/lcgate/${gate.id}`, { headers: authHeaders() });
      if (res.ok) {
        const fullGate = await res.json();
        setActiveGate(fullGate);
      }
    } catch (err) {
      console.error('Failed to fetch full gate telemetry:', err);
    } finally {
      setActiveGateLoading(false);
    }
  };

  // Back to Group Detail
  const handleBackToGroup = () => {
    setActiveGate(null);
    setViewMode('group_detail');
  };

  // Back to List
  const handleBackToList = () => {
    setActiveGroup(null);
    setActiveGate(null);
    setViewMode('list');
  };

  // Keep activeGroup synced if scopeGroups updates
  useEffect(() => {
    if (activeGroup) {
      const found = scopeGroups.find(g => g.id === activeGroup.id);
      if (found) setActiveGroup(found);
    }
  }, [scopeGroups]);

  // Filtered Gates in Active Scope Group
  const activeGroupGates = useMemo(() => {
    if (!activeGroup?.gates) return [];
    const q = activeGateSearch.toLowerCase().trim();
    if (!q) return activeGroup.gates;
    return activeGroup.gates.filter(item => {
      const g = item.gate;
      const matchName = (g.name || '').toLowerCase().includes(q);
      const matchLc = (g.lcNumber || '').toLowerCase().includes(q);
      const matchLoc = (g.locationName || '').toLowerCase().includes(q);
      const matchZone = (g.zone || '').toLowerCase().includes(q);
      const matchDiv = (g.division || '').toLowerCase().includes(q);
      return matchName || matchLc || matchLoc || matchZone || matchDiv;
    });
  }, [activeGroup, activeGateSearch]);

  // Open Create Modal
  const handleOpenCreate = () => {
    if (!canManage) return;
    setEditingGroupId(null);
    setFormName('');
    setFormDesc('');
    setFormColor('#0B3C7A');
    setSelectedGateIds(new Set());
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
    setSelectedGateIds(new Set(group.gates?.map(g => g.gate.id) || []));
    setSelectedUserIds(new Set(group.users?.map(u => u.user.id) || []));
    setFormError(null);
    setModalTab('details');
    setIsModalOpen(true);
  };

  // Filtered Gates in Picker
  const pickerFilteredGates = useMemo(() => {
    return allGates.filter(gate => {
      if (gateFilterZone && gate.zone !== gateFilterZone) return false;
      if (gateFilterDivision && gate.division !== gateFilterDivision) return false;
      if (gateSearchQuery) {
        const q = gateSearchQuery.toLowerCase();
        const matchName = (gate.name || '').toLowerCase().includes(q);
        const matchLc = (gate.lcNumber || '').toLowerCase().includes(q);
        const matchLoc = (gate.locationName || '').toLowerCase().includes(q);
        if (!matchName && !matchLc && !matchLoc) return false;
      }
      return true;
    });
  }, [allGates, gateFilterZone, gateFilterDivision, gateSearchQuery]);

  // Available Divisions for selected zone in Picker
  const availableDivisions = useMemo(() => {
    if (!gateFilterZone) return [];
    return divisionsByZone[gateFilterZone] || [];
  }, [gateFilterZone, divisionsByZone]);

  // Toggle Single Gate
  const toggleGateSelection = (gateId: number) => {
    setSelectedGateIds(prev => {
      const next = new Set(prev);
      if (next.has(gateId)) next.delete(gateId);
      else next.add(gateId);
      return next;
    });
  };

  // Select / Deselect All Filtered Gates
  const selectAllFilteredGates = () => {
    setSelectedGateIds(prev => {
      const next = new Set(prev);
      pickerFilteredGates.forEach(g => next.add(g.id));
      return next;
    });
  };

  const deselectAllFilteredGates = () => {
    setSelectedGateIds(prev => {
      const next = new Set(prev);
      pickerFilteredGates.forEach(g => next.delete(g.id));
      return next;
    });
  };

  // Filtered Users in Picker
  const pickerFilteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      if (userRoleFilter !== 'ALL' && u.role?.name !== userRoleFilter) return false;
      if (userSearchQuery) {
        const q = userSearchQuery.toLowerCase();
        const matchName = (u.fullName || '').toLowerCase().includes(q);
        const matchEmail = (u.email || '').toLowerCase().includes(q);
        const matchEmp = (u.employeeId || '').toLowerCase().includes(q);
        const matchDept = (u.department || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchEmp && !matchDept) return false;
      }
      return true;
    });
  }, [allUsers, userRoleFilter, userSearchQuery]);

  // Available Roles for Filter
  const userRolesList = useMemo(() => {
    const roles = new Set<string>();
    allUsers.forEach(u => {
      if (u.role?.name) roles.add(u.role.name);
    });
    return Array.from(roles);
  }, [allUsers]);

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
      setModalTab('details');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const payload = {
      name: formName.trim(),
      description: formDesc.trim() || null,
      color: formColor,
      gateIds: Array.from(selectedGateIds),
      userIds: Array.from(selectedUserIds)
    };

    try {
      const url = editingGroupId
        ? `${API_URL}/api/v1/scope-groups/${editingGroupId}`
        : `${API_URL}/api/v1/scope-groups`;
      const method = editingGroupId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save scope group');
      }

      setIsModalOpen(false);
      await fetchScopeGroups();
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while saving');
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
      if (res.ok) {
        setDeleteConfirmGroup(null);
        await fetchScopeGroups();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete scope group');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting scope group');
    }
  };

  return (
    <div className="sg-container">
      {/* 1. SCOPE GROUPS LIST VIEW */}
      {viewMode === 'list' && (
        <>
          {/* Header */}
          <div className="sg-header">
            <div className="sg-header-titles">
              <h2>
                <FaLayerGroup /> {canManage ? 'Scope Groups Console' : 'My Assigned Scope Groups'}
              </h2>
              <p>
                {canManage
                  ? 'Create granular access groups. Manually assign specific clusters & LC gates to designated team members.'
                  : 'View the scope groups and LC gates assigned to your account. Your operational access is restricted to these gates.'}
              </p>
            </div>
            {canManage ? (
              <button className="btn btn-primary" onClick={handleOpenCreate}>
                <FaPlus /> Create Scope Group
              </button>
            ) : (
              <div className="sg-readonly-badge">
                <FaLock style={{ color: '#0B3C7A' }} /> Assigned Member • Read-Only
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="sg-stats-grid">
            <div className="sg-stat-card">
              <div className="sg-stat-icon primary">
                <FaLayerGroup />
              </div>
              <div className="sg-stat-info">
                <h3>{stats.totalGroups}</h3>
                <span>Total Scope Groups</span>
              </div>
            </div>

            <div className="sg-stat-card">
              <div className="sg-stat-icon teal">
                <FaMicrochip />
              </div>
              <div className="sg-stat-info">
                <h3>{stats.totalGates}</h3>
                <span>Unique Scoped Gates</span>
              </div>
            </div>

            {canManage && (
              <div className="sg-stat-card">
                <div className="sg-stat-icon amber">
                  <FaUsers />
                </div>
                <div className="sg-stat-info">
                  <h3>{stats.totalUsers}</h3>
                  <span>Assigned Users</span>
                </div>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="sg-toolbar">
            <div className="sg-search-box">
              <FaSearch color="#94a3b8" />
              <input
                type="text"
                placeholder="Search scope groups by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <FaTimes />
                </button>
              )}
            </div>

            <button className="btn btn-secondary" onClick={loadInitialData} title="Refresh data">
              <FaSyncAlt /> Refresh
            </button>
          </div>

          {/* Groups Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
              <FaSyncAlt className="spin" size={32} style={{ marginBottom: 12, color: 'var(--primary)' }} />
              <div>Loading scope groups...</div>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="sg-empty-state">
              <FaLayerGroup className="sg-empty-icon" />
              <h3 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>
                {searchQuery
                  ? 'No scope groups match your search'
                  : canManage
                  ? 'No Scope Groups Created Yet'
                  : 'No Scope Groups Assigned'}
              </h3>
              <p style={{ margin: '0 0 18px 0', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
                {searchQuery
                  ? 'Try adjusting your search keywords.'
                  : canManage
                  ? 'Create your first Scope Group to manually bundle LC Gates and assign them to specific users.'
                  : 'No scope groups are currently assigned to your account. Please contact an administrator to get access.'}
              </p>
              {!searchQuery && canManage && (
                <button className="btn btn-primary" onClick={handleOpenCreate}>
                  <FaPlus /> Create Your First Scope Group
                </button>
              )}
            </div>
          ) : (
            <div className="sg-groups-grid">
              {filteredGroups.map(group => {
                const gateCount = group.gates?.length || group._count?.gates || 0;
                const userCount = group.users?.length || group._count?.users || 0;
                const previewGates = group.gates?.slice(0, 4) || [];
                const remainingGates = gateCount - previewGates.length;

                return (
                  <div
                    key={group.id}
                    className="sg-group-card sg-clickable-card"
                    onClick={() => handleCardClick(group)}
                    title="Click to view included gates and devices"
                  >
                    <div
                      className="sg-card-stripe"
                      style={{ backgroundColor: group.color || '#0B3C7A' }}
                    />

                    <div className="sg-card-top">
                      <div>
                        <h3 className="sg-card-title">{group.name}</h3>
                      </div>
                    </div>

                    <p className="sg-card-desc">
                      {group.description || 'No description provided.'}
                    </p>

                    <div className="sg-card-meta">
                      <span className="sg-pill gates">
                        <FaMicrochip /> {gateCount} {gateCount === 1 ? 'Gate' : 'Gates'}
                      </span>
                      {canManage && (
                        <span className="sg-pill users">
                          <FaUsers /> {userCount} {userCount === 1 ? 'User' : 'Users'}
                        </span>
                      )}
                    </div>

                    {/* Gate Preview */}
                    <div className="sg-gates-preview">
                      <div className="sg-preview-label">Included Gates</div>
                      {gateCount === 0 ? (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No gates assigned yet</span>
                      ) : (
                        <div className="sg-preview-chips">
                          {previewGates.map(item => (
                            <span key={item.gate.id} className="sg-gate-chip">
                              {item.gate.lcNumber}
                              {item.gate.locationName ? ` (${item.gate.locationName})` : ''}
                            </span>
                          ))}
                          {remainingGates > 0 && (
                            <span className="sg-more-chip">+{remainingGates} more</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Open Hint CTA */}
                    <div className="sg-card-footer-cta">
                      <span>View Included Gates ({gateCount})</span>
                      <FaChevronRight size={13} />
                    </div>

                    {/* Admin Actions */}
                    {canManage && (
                      <div
                        className="sg-card-actions"
                        style={{ marginTop: 12 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(group);
                          }}
                          title="Edit scope group"
                        >
                          <FaEdit /> Edit
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ color: '#ef4444', borderColor: '#fecaca', background: '#fef2f2' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmGroup(group);
                          }}
                          title="Delete scope group"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 2. DEDICATED SCOPE GROUP DETAIL PAGE */}
      {viewMode === 'group_detail' && activeGroup && (
        <div className="sg-group-detail-view fade-in">
          {/* Breadcrumb Bar */}
          <div className="sg-view-header">
            <div className="sg-breadcrumb-bar">
              <button className="btn btn-secondary btn-sm" onClick={handleBackToList}>
                <FaArrowLeft /> Back
              </button>
              <span className="sg-breadcrumb-crumb" onClick={handleBackToList}>Scope Groups</span>
              <span className="sg-breadcrumb-sep">/</span>
              <span className="sg-breadcrumb-active">{activeGroup.name}</span>
            </div>
            {canManage && (
              <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(activeGroup)}>
                <FaEdit /> Edit Scope Group
              </button>
            )}
          </div>

          {/* Group Hero Card */}
          <div className="sg-group-hero">
            <div className="sg-hero-stripe" style={{ backgroundColor: activeGroup.color || '#0B3C7A' }} />
            <div className="sg-hero-body">
              <div className="sg-hero-title-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="sg-color-dot" style={{ backgroundColor: activeGroup.color || '#0B3C7A' }} />
                  <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
                    {activeGroup.name}
                  </h2>
                </div>
                <span className="sg-pill gates">
                  <FaMicrochip /> {activeGroup.gates?.length || 0} Included {activeGroup.gates?.length === 1 ? 'Gate' : 'Gates'}
                </span>
              </div>

              <p className="sg-hero-desc">
                {activeGroup.description || 'No description provided for this scope group.'}
              </p>

              {/* Hardware Metrics Summary */}
              <div className="sg-hero-stats">
                <div className="sg-hero-stat-item">
                  <span className="sg-hero-stat-val">{activeGroup.gates?.length || 0}</span>
                  <span className="sg-hero-stat-lbl">Included LC Gates</span>
                </div>
                <div className="sg-hero-stat-item">
                  <span className="sg-hero-stat-val">
                    {activeGroup.gates?.reduce((acc, g) => acc + (g.gate.masters?.length || 0), 0) || 0}
                  </span>
                  <span className="sg-hero-stat-lbl">Connected Masters</span>
                </div>
                <div className="sg-hero-stat-item">
                  <span className="sg-hero-stat-val">
                    {activeGroup.gates?.reduce(
                      (acc, g) =>
                        acc +
                        (g.gate.masters?.reduce((mAcc, m) => mAcc + (m.childDevices?.length || 0), 0) || 0),
                      0
                    ) || 0}
                  </span>
                  <span className="sg-hero-stat-lbl">Total Slave Devices</span>
                </div>
              </div>
            </div>
          </div>

          {/* Included Gates Section */}
          <div className="sg-section-header">
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                Included LC Gates ({activeGroupGates.length})
              </h3>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
                Click on any gate card below to inspect its connected master units and slave devices.
              </p>
            </div>
            <div className="sg-search-box" style={{ maxWidth: 320 }}>
              <FaSearch color="#94a3b8" />
              <input
                type="text"
                placeholder="Filter gates in this scope..."
                value={activeGateSearch}
                onChange={(e) => setActiveGateSearch(e.target.value)}
              />
              {activeGateSearch && (
                <button
                  onClick={() => setActiveGateSearch('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <FaTimes />
                </button>
              )}
            </div>
          </div>

          {activeGroupGates.length === 0 ? (
            <div className="sg-empty-state" style={{ padding: 48 }}>
              <FaMicrochip className="sg-empty-icon" />
              <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>
                {activeGateSearch ? 'No matching gates found' : 'No Gates in this Scope Group'}
              </h4>
              <p style={{ margin: 0 }}>
                {activeGateSearch
                  ? 'Try adjusting your search query.'
                  : 'This scope group does not have any LC gates assigned yet.'}
              </p>
            </div>
          ) : (
            <div className="sg-scope-gates-grid">
              {activeGroupGates.map(item => {
                const g = item.gate;
                const mastersCount = g.masters?.length || 0;
                const slavesCount =
                  g.masters?.reduce((acc: number, m: any) => acc + (m.childDevices?.length || 0), 0) || 0;
                return (
                  <div
                    key={g.id}
                    className="sg-scope-gate-card"
                    onClick={() => handleGateClick(g)}
                  >
                    <div>
                      <div className="sg-gate-card-header">
                        <div className="sg-gate-badge">
                          <FaMicrochip /> {g.lcNumber}
                        </div>
                        <span className="sg-gate-chevron">
                          Inspect Devices <FaChevronRight size={11} />
                        </span>
                      </div>

                      <h4 className="sg-gate-location-title">
                        {g.locationName || g.name || 'LC Gate'}
                      </h4>

                      <div className="sg-gate-location-sub">
                        <FaTrain style={{ color: '#0B3C7A' }} /> {g.zone || 'Zone N/A'} • {g.division || 'Division N/A'}
                      </div>
                    </div>

                    <div className="sg-gate-hardware-pills">
                      <span className="sg-pill master-pill">
                        <FaCogs /> {mastersCount} {mastersCount === 1 ? 'Master Unit' : 'Master Units'}
                      </span>
                      <span className="sg-pill slave-pill">
                        <FaPlug /> {slavesCount} {slavesCount === 1 ? 'Slave Device' : 'Slave Devices'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. DEDICATED GATE HARDWARE & DEVICES PAGE */}
      {viewMode === 'gate_detail' && activeGate && (
        <div className="sg-gate-detail-view fade-in">
          {/* Breadcrumb Bar */}
          <div className="sg-view-header">
            <div className="sg-breadcrumb-bar">
              <button className="btn btn-secondary btn-sm" onClick={handleBackToGroup}>
                <FaArrowLeft /> Back
              </button>
              <span className="sg-breadcrumb-crumb" onClick={handleBackToList}>Scope Groups</span>
              <span className="sg-breadcrumb-sep">/</span>
              <span className="sg-breadcrumb-crumb" onClick={handleBackToGroup}>
                {activeGroup?.name || 'Scope Group'}
              </span>
              <span className="sg-breadcrumb-sep">/</span>
              <span className="sg-breadcrumb-active">{activeGate.lcNumber}</span>
            </div>
          </div>

          {/* Gate Overview Hero Card */}
          <div className="sg-gate-hero-card">
            <div className="sg-gate-hero-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="sg-gate-hero-lc">{activeGate.lcNumber}</span>
                <span className="badge badge-blue" style={{ fontSize: '0.88rem', padding: '4px 12px' }}>
                  {activeGate.zone || 'Zone N/A'} • {activeGate.division || 'Division N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <span className="sg-pill master-pill">
                  <FaCogs /> {activeGate.masters?.length || 0} Masters
                </span>
                <span className="sg-pill slave-pill">
                  <FaPlug />{' '}
                  {activeGate.masters?.reduce((acc: number, m: any) => acc + (m.childDevices?.length || 0), 0) || 0} Slaves
                </span>
              </div>
            </div>

            <h3 className="sg-gate-hero-loc">
              {activeGate.locationName || activeGate.name || 'LC Gate'}
            </h3>

            <div className="sg-gate-hero-meta">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FaTrain style={{ color: '#0B3C7A' }} /> Railway Section: {activeGate.division || 'N/A'}, {activeGate.zone || 'N/A'}
              </span>
              {activeGate.latitude && activeGate.longitude && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FaMapMarkerAlt style={{ color: '#ef4444' }} /> Coordinates: {activeGate.latitude}, {activeGate.longitude}
                </span>
              )}
            </div>
          </div>

          {/* Hardware & Devices Telemetry Section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>
                  Hardware Telemetry & Connected Devices
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
                  Live configuration of Master units and Slave sensors installed at this gate.
                </p>
              </div>
              {activeGateLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0B3C7A', fontSize: '0.85rem' }}>
                  <FaSyncAlt className="spin" /> Updating telemetry...
                </div>
              )}
            </div>

            {(!activeGate.masters || activeGate.masters.length === 0) ? (
              <div className="sg-empty-state" style={{ padding: 48 }}>
                <FaMicrochip className="sg-empty-icon" />
                <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>No Master Units Configured</h4>
                <p style={{ margin: 0 }}>
                  This LC gate currently does not have any master telemetry units installed.
                </p>
              </div>
            ) : (
              <div className="sg-masters-stack">
                {activeGate.masters.map((master: any) => (
                  <div key={master.id} className="sg-master-unit-card">
                    {/* Master Card Header */}
                    <div className="sg-master-unit-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div className="sg-master-icon-badge">
                          <FaMicrochip />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                            {master.serialNumber}
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Master Unit Sequence #{master.masterSequence || 1}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="sg-power-badge">
                          {master.powerSource === 'SOLAR' ? (
                            <><FaSun style={{ color: '#f59e0b' }} /> Solar Power</>
                          ) : (
                            <><FaBolt style={{ color: '#3b82f6' }} /> Direct Current</>
                          )}
                        </span>
                        <span className="sg-slaves-count-pill">
                          {master.childDevices?.length || 0} {master.childDevices?.length === 1 ? 'Slave Device' : 'Slave Devices'}
                        </span>
                      </div>
                    </div>

                    {/* Slave Devices Panel */}
                    <div className="sg-slave-devices-panel">
                      <div className="sg-slave-devices-title">
                        <FaPlug style={{ color: '#0284c7' }} /> Connected Slave Devices ({master.childDevices?.length || 0})
                      </div>

                      {(!master.childDevices || master.childDevices.length === 0) ? (
                        <div className="sg-slave-empty">
                          No slave devices connected to this master unit yet.
                        </div>
                      ) : (
                        <div className="sg-slave-devices-grid">
                          {master.childDevices.map((dev: any) => (
                            <div key={dev.id} className="sg-slave-item-card">
                              <div className="sg-slave-item-top">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div className="sg-slave-icon">
                                    <FaPlug />
                                  </div>
                                  <strong className="sg-slave-serial">{dev.serialNumber}</strong>
                                </div>
                                <span className="sg-slave-seq-badge">Seq #{dev.deviceSequence || 1}</span>
                              </div>

                              <div className="sg-slave-item-bot">
                                <span className="sg-slave-type-name">
                                  {dev.type === 'DEVICE_1' ? 'Hall Effect + Limit Switch' : 'Tilt Sensor'}
                                </span>
                                <span className="sg-slave-type-pill">
                                  {dev.type === 'DEVICE_1' ? 'Type A' : 'Type B'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="sg-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="sg-modal" onClick={e => e.stopPropagation()}>
            <div className="sg-modal-header">
              <h3>
                <FaLayerGroup style={{ color: formColor }} />
                {editingGroupId ? 'Edit Scope Group' : 'Create New Scope Group'}
              </h3>
              <button
                className="icon-btn"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                onClick={() => setIsModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="sg-modal-tabs">
              <button
                type="button"
                className={`sg-modal-tab-btn ${modalTab === 'details' ? 'active' : ''}`}
                onClick={() => setModalTab('details')}
              >
                <FaTag /> 1. Details
              </button>
              <button
                type="button"
                className={`sg-modal-tab-btn ${modalTab === 'gates' ? 'active' : ''}`}
                onClick={() => setModalTab('gates')}
              >
                <FaMicrochip /> 2. Gates ({selectedGateIds.size})
              </button>
              <button
                type="button"
                className={`sg-modal-tab-btn ${modalTab === 'users' ? 'active' : ''}`}
                onClick={() => setModalTab('users')}
              >
                <FaUsers /> 3. Assign Users ({selectedUserIds.size})
              </button>
            </div>

            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="sg-modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
                    {formError}
                  </div>
                )}

                {/* TAB 1: DETAILS */}
                {modalTab === 'details' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', marginBottom: 6 }}>
                        Scope Group Name <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Bhopal Division Main Line, Mumbai South Cluster..."
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', marginBottom: 6 }}>
                        Description (Optional)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Provide details about which gates or areas are covered by this scope..."
                        value={formDesc}
                        onChange={e => setFormDesc(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.92rem', resize: 'vertical' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', marginBottom: 6 }}>
                        Group Color Accent
                      </label>
                      <div className="sg-color-swatches">
                        {COLOR_PRESETS.map(hex => (
                          <div
                            key={hex}
                            className={`sg-color-circle ${formColor === hex ? 'selected' : ''}`}
                            style={{ backgroundColor: hex }}
                            onClick={() => setFormColor(hex)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: GATES PICKER */}
                {modalTab === 'gates' && (
                  <div>
                    <div className="sg-selector-toolbar">
                      <div className="sg-search-box" style={{ flex: '1 1 200px' }}>
                        <FaSearch color="#94a3b8" />
                        <input
                          type="text"
                          placeholder="Search gates by LC#, name, location..."
                          value={gateSearchQuery}
                          onChange={e => setGateSearchQuery(e.target.value)}
                        />
                      </div>

                      <select
                        value={gateFilterZone}
                        onChange={e => {
                          setGateFilterZone(e.target.value);
                          setGateFilterDivision('');
                        }}
                      >
                        <option value="">All Zones</option>
                        {zones.map(z => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>

                      <select
                        value={gateFilterDivision}
                        onChange={e => setGateFilterDivision(e.target.value)}
                        disabled={!gateFilterZone}
                      >
                        <option value="">All Divisions</option>
                        {availableDivisions.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>

                      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={selectAllFilteredGates}
                        >
                          <FaCheckDouble /> Select All Filtered ({pickerFilteredGates.length})
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={deselectAllFilteredGates}
                        >
                          Deselect Filtered
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: 10, fontSize: '0.84rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Showing {pickerFilteredGates.length} of {allGates.length} gates</span>
                      <strong>{selectedGateIds.size} gates selected</strong>
                    </div>

                    <div className="sg-items-picker-box">
                      {pickerFilteredGates.length === 0 ? (
                        <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8' }}>
                          No gates match the current filter criteria.
                        </div>
                      ) : (
                        pickerFilteredGates.map(gate => {
                          const isSelected = selectedGateIds.has(gate.id);
                          return (
                            <div
                              key={gate.id}
                              className={`sg-item-row ${isSelected ? 'selected' : ''}`}
                              onClick={() => toggleGateSelection(gate.id)}
                            >
                              <input
                                type="checkbox"
                                className="sg-item-checkbox"
                                checked={isSelected}
                                onChange={() => {}} // handled by parent onClick
                              />
                              <div className="sg-item-details">
                                <div>
                                  <div className="sg-item-name">
                                    {gate.lcNumber} {gate.name ? `— ${gate.name}` : ''}
                                  </div>
                                  <div className="sg-item-sub">
                                    📍 {gate.locationName || 'Unspecified location'}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {gate.zone && (
                                    <span className="badge" style={{ fontSize: '0.72rem', background: '#e2e8f0', color: '#334155' }}>
                                      {gate.zone}
                                    </span>
                                  )}
                                  {gate.division && (
                                    <span className="badge" style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569' }}>
                                      {gate.division}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: USERS PICKER */}
                {modalTab === 'users' && (
                  <div>
                    <div className="sg-selector-toolbar">
                      <div className="sg-search-box" style={{ flex: '1 1 220px' }}>
                        <FaSearch color="#94a3b8" />
                        <input
                          type="text"
                          placeholder="Search users by name, email, employee ID..."
                          value={userSearchQuery}
                          onChange={e => setUserSearchQuery(e.target.value)}
                        />
                      </div>

                      <select
                        value={userRoleFilter}
                        onChange={e => setUserRoleFilter(e.target.value)}
                      >
                        <option value="ALL">All Roles</option>
                        {userRolesList.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>

                      <div style={{ marginLeft: 'auto', fontSize: '0.85rem', fontWeight: 600, color: '#0B3C7A' }}>
                        {selectedUserIds.size} users selected
                      </div>
                    </div>

                    <div className="sg-items-picker-box">
                      {pickerFilteredUsers.length === 0 ? (
                        <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8' }}>
                          No users match the search.
                        </div>
                      ) : (
                        pickerFilteredUsers.map(u => {
                          const isSelected = selectedUserIds.has(u.id);
                          return (
                            <div
                              key={u.id}
                              className={`sg-item-row ${isSelected ? 'selected' : ''}`}
                              onClick={() => toggleUserSelection(u.id)}
                            >
                              <input
                                type="checkbox"
                                className="sg-item-checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                              />
                              <div className="sg-item-details">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: '50%',
                                      background: 'var(--primary)',
                                      color: 'white',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 700,
                                      fontSize: '0.8rem'
                                    }}
                                  >
                                    {u.fullName?.substring(0, 2).toUpperCase() || 'U'}
                                  </div>
                                  <div>
                                    <div className="sg-item-name">{u.fullName}</div>
                                    <div className="sg-item-sub">
                                      {u.email} • ID: {u.employeeId || 'N/A'} • {u.department || 'Dept N/A'}
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <span className="badge" style={{ backgroundColor: 'var(--secondary, #0e9aa7)', color: 'white', fontSize: '0.74rem' }}>
                                    {u.role?.name || 'User'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sg-modal-footer">
                <div>
                  {modalTab !== 'details' && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setModalTab(modalTab === 'users' ? 'gates' : 'details')}
                    >
                      Back
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>

                  {modalTab === 'details' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setModalTab('gates')}
                    >
                      Next: Select Gates ({selectedGateIds.size})
                    </button>
                  )}

                  {modalTab === 'gates' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setModalTab('users')}
                    >
                      Next: Assign Users ({selectedUserIds.size})
                    </button>
                  )}

                  {modalTab === 'users' && (
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting}
                    >
                      {submitting ? 'Saving...' : editingGroupId ? 'Save Scope Group' : 'Create Scope Group'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmGroup && (
        <div className="sg-modal-overlay" onClick={() => setDeleteConfirmGroup(null)}>
          <div className="sg-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="sg-modal-header" style={{ background: '#fef2f2' }}>
              <h3 style={{ color: '#b91c1c' }}>
                <FaTrash /> Delete Scope Group?
              </h3>
              <button
                className="icon-btn"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                onClick={() => setDeleteConfirmGroup(null)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="sg-modal-body">
              <p style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#334155' }}>
                Are you sure you want to delete the Scope Group <strong>"{deleteConfirmGroup.name}"</strong>?
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                This will unassign all {deleteConfirmGroup.gates?.length || 0} gates from this scope group. The gates and user accounts will <strong>not</strong> be deleted.
              </p>
            </div>

            <div className="sg-modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirmGroup(null)}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: 'white', border: 'none' }}
                onClick={handleDeleteGroup}
              >
                Yes, Delete Scope Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
