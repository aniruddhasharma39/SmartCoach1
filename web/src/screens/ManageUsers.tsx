import { useEffect, useState, useMemo } from 'react';
import {
  FaUsers,
  FaUserCheck,
  FaUserSlash,
  FaUserClock,
  FaSearch,
  FaChevronDown,
  FaChevronUp,
  FaSyncAlt,
  FaSearchPlus,
  FaTimes,
  FaCheck,
  FaCheckCircle,
  FaTimesCircle,
  FaPhone,
  FaEnvelope,
  FaIdBadge,
  FaBuilding,
  FaVenusMars,
  FaShieldAlt,
  FaCrown,
  FaTrain,
  FaHardHat,
  FaFileImage,
  FaCopy,
  FaExclamationTriangle,
  FaSpinner,
  FaFilter,
} from 'react-icons/fa';
import type { User } from '../types';
import { API_URL } from '../config';
import './ManageUsers.css';

type Props = {
  user: User;
  onUserUpdate?: () => void;
};

interface RoleItem {
  id: number;
  name: string;
}

interface RegistrationRequestItem {
  id: number;
  formId: number;
  data: string;
  requestedRoleId?: number;
  status: string;
  createdAt?: string;
  form?: {
    id: number;
    name: string;
    schema?: string;
  };
}

export default function ManageUsers({ user, onUserUpdate }: Props) {
  const [users, setUsers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RegistrationRequestItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<'existing' | 'pending'>('existing');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Accordion open state for roles (set of expanded role names)
  const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({});

  // Modals & Action States
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ id: number; action: 'deactivate' | 'reactivate'; name: string } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: number; name: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<{ id: number; action: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Selected roles for pending approvals map [requestId -> roleId]
  const [pendingRoleSelection, setPendingRoleSelection] = useState<Record<number, number>>({});

  const showToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3500);
  };

  const fetchAllData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, rolesRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/users`, { headers }),
        fetch(`${API_URL}/api/v1/roles`, { headers }),
      ]);

      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData.users || []);
        setPendingRequests(uData.pendingRequests || []);

        // Pre-fill pending role selections
        const initialRolesMap: Record<number, number> = {};
        (uData.pendingRequests || []).forEach((req: RegistrationRequestItem) => {
          if (req.requestedRoleId) {
            initialRolesMap[req.id] = req.requestedRoleId;
          }
        });
        setPendingRoleSelection(initialRolesMap);
      }

      if (rolesRes.ok) {
        const rData = await rolesRes.json();
        if (Array.isArray(rData)) setRoles(rData);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      showToast('Failed to load user directory', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const minDelay = new Promise(resolve => setTimeout(resolve, 500));
    try {
      await Promise.all([fetchAllData(), minDelay]);
      if (onUserUpdate) onUserUpdate();
      showToast('User directory refreshed successfully!', 'info');
    } catch {
      showToast('Failed to refresh user directory', 'danger');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Humanize dictionary keys for display
  const humanizeKey = (key: string) => {
    const cleanKey = key.trim();
    if (cleanKey === 'fullName') return 'Full Name';
    if (cleanKey === 'mobile' || cleanKey === 'phone') return 'Mobile Number';
    if (cleanKey === 'email') return 'Email Address';
    if (cleanKey === 'employeeId') return 'Employee ID';
    if (cleanKey === 'department') return 'Department';
    if (cleanKey === 'gender') return 'Gender';
    if (cleanKey.startsWith('field_')) {
      const sub = cleanKey.substring(6);
      return sub.length > 6 ? `Custom Field (${sub.substring(sub.length - 4)})` : `Custom Field (${sub})`;
    }
    return cleanKey.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
  };

  const isImgUrl = (val: any) => {
    if (typeof val !== 'string') return false;
    const lower = val.toLowerCase().trim();
    return (
      (lower.startsWith('http://') || lower.startsWith('https://')) &&
      (
        lower.includes('/image/upload/') ||
        lower.includes('cloudinary') ||
        lower.includes('res.cloudinary') ||
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.webp') ||
        lower.endsWith('.gif') ||
        lower.endsWith('.svg')
      )
    );
  };

  const getRoleIcon = (roleName: string) => {
    const lower = (roleName || '').toLowerCase();
    if (lower.includes('developer') || lower.includes('admin')) return FaCrown;
    if (lower.includes('station') || lower.includes('section') || lower.includes('train')) return FaTrain;
    if (lower.includes('gate')) return FaHardHat;
    if (lower.includes('officer') || lower.includes('zone') || lower.includes('division')) return FaShieldAlt;
    return FaUsers;
  };

  const copyToClipboard = (text: string, identifier: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(identifier);
    setTimeout(() => {
      setCopiedKey(prev => (prev === identifier ? null : prev));
    }, 2000);
  };

  // Actions: Deactivate / Reactivate / Approve / Reject
  const handleUserStatusChange = async (id: number, action: 'deactivate' | 'reactivate', userName: string) => {
    setActionLoading({ id, action });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/users/${id}/${action}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        showToast(`User "${userName}" has been ${action === 'deactivate' ? 'deactivated' : 'reactivated'} successfully!`, 'success');
        setConfirmModal(null);
        await fetchAllData();
        if (onUserUpdate) onUserUpdate();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Failed to ${action} user`, 'danger');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || `Network error during ${action}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveRequest = async (reqId: number, applicantName: string) => {
    const roleId = pendingRoleSelection[reqId] || roles[0]?.id;
    if (!roleId) {
      showToast('Please select a role to assign before approving', 'danger');
      return;
    }

    setActionLoading({ id: reqId, action: 'approve' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/users/request/${reqId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roleId: Number(roleId) }),
      });

      if (res.ok) {
        showToast(`Registration approved for "${applicantName}"!`, 'success');
        await fetchAllData();
        if (onUserUpdate) onUserUpdate();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to approve request', 'danger');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error occurred while approving request', 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async () => {
    if (!rejectModal) return;
    const { id, name } = rejectModal;

    setActionLoading({ id, action: 'reject' });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/users/request/${id}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });

      if (res.ok) {
        showToast(`Registration request for "${name}" rejected`, 'info');
        setRejectModal(null);
        setRejectionReason('');
        await fetchAllData();
        if (onUserUpdate) onUserUpdate();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to reject request', 'danger');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error occurred while rejecting request', 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  // Helper to unpack pending request registration form data
  const parseRequestData = (req: RegistrationRequestItem) => {
    let reqData: Record<string, any> = {};
    try {
      reqData = JSON.parse(req.data || '{}');
    } catch {
      reqData = {};
    }

    let schema: any = null;
    try {
      if (req.form?.schema) schema = JSON.parse(req.form.schema);
    } catch {}

    const allFields: any[] = [];
    const walk = (fields: any[]) => {
      if (!fields) return;
      for (const f of fields) {
        if (f.type === 'section' && f.children) walk(f.children);
        else allFields.push(f);
      }
    };
    if (schema?.fields) walk(schema.fields);

    let fullName = reqData.fullName || reqData.name || '';
    const textDetails: [string, any][] = [];
    const imageDetails: [string, any][] = [];

    for (const [k, v] of Object.entries(reqData)) {
      if (k === 'password') continue;
      const field = allFields.find(f => f.name === k);
      const label = field ? field.label : humanizeKey(k);

      if (!fullName && field && field.label.toLowerCase().includes('name')) {
        fullName = v;
      }

      if (isImgUrl(v)) {
        imageDetails.push([label, v]);
      } else {
        textDetails.push([label, v]);
      }
    }

    return {
      fullName: fullName || 'Applicant',
      textDetails,
      imageDetails,
    };
  };

  // Filter existing users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Role filter
      if (selectedRoleFilter !== 'ALL') {
        const rName = u.role?.name || 'Unassigned';
        if (rName !== selectedRoleFilter) return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'ALL') {
        if (u.status !== selectedStatusFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (u.fullName || '').toLowerCase().includes(q);
        const emailMatch = (u.email || '').toLowerCase().includes(q);
        const mobileMatch = (u.mobile || '').toLowerCase().includes(q);
        const empMatch = (u.employeeId || '').toLowerCase().includes(q);
        const deptMatch = (u.department || '').toLowerCase().includes(q);
        const roleMatch = (u.role?.name || '').toLowerCase().includes(q);
        const metaMatch = (u.metadata || '').toLowerCase().includes(q);

        return nameMatch || emailMatch || mobileMatch || empMatch || deptMatch || roleMatch || metaMatch;
      }

      return true;
    });
  }, [users, selectedRoleFilter, selectedStatusFilter, searchQuery]);

  // Group filtered users by Role
  const usersByRole = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredUsers.forEach(u => {
      if (u.status === 'PENDING') return;
      const roleName = u.role?.name || 'Unassigned';
      if (!map[roleName]) map[roleName] = [];
      map[roleName].push(u);
    });
    return map;
  }, [filteredUsers]);

  // Role group accordion logic: All role groups are COLLAPSED by default
  // Only expand when user explicitly clicks on a role header or clicks "Expand All"
  const roleNames = useMemo(() => Object.keys(usersByRole), [usersByRole]);
  const allRolesExpanded = useMemo(() => {
    return roleNames.length > 0 && roleNames.every(rn => Boolean(expandedRoles[rn]));
  }, [roleNames, expandedRoles]);

  const toggleRoleExpanded = (roleName: string) => {
    setExpandedRoles(prev => ({
      ...prev,
      [roleName]: !prev[roleName],
    }));
  };

  const handleToggleAllAccordions = () => {
    const shouldExpandAll = !allRolesExpanded;
    const newState: Record<string, boolean> = {};
    roleNames.forEach(rn => {
      newState[rn] = shouldExpandAll;
    });
    setExpandedRoles(newState);
  };

  // Metrics
  const totalUsersCount = users.length;
  const approvedUsersCount = users.filter(u => u.status === 'APPROVED').length;
  const deactivatedUsersCount = users.filter(u => u.status === 'DEACTIVATED').length;
  const pendingCount = pendingRequests.length;

  return (
    <div className="manage-users-container">
      {/* Toast Alert Banner */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: toast.type === 'danger' ? '#ef4444' : toast.type === 'info' ? '#0284c7' : '#10b981',
            color: '#ffffff',
            padding: '0.85rem 1.4rem',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            animation: 'modal-pop 0.2s ease',
          }}
        >
          {toast.type === 'danger' ? <FaTimesCircle size={18} /> : <FaCheckCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="manage-users-header">
        <div className="manage-users-title-group">
          <div className="manage-users-title-icon-badge">
            <FaUsers />
          </div>
          <div className="manage-users-title-text">
            <h2>User Management & Directory</h2>
            <p>Administer verified personnel, approve access requests, and manage system roles.</p>
          </div>
        </div>

        <div className="manage-users-top-actions">
          <button
            type="button"
            className="btn-refresh-users"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh user records from database"
          >
            <FaSyncAlt className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Metric Stats Cards */}
      <div className="users-stats-grid">
        <div className="user-stat-card">
          <div className="stat-icon-wrapper blue">
            <FaUsers />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Users</span>
            <span className="stat-value">{totalUsersCount}</span>
          </div>
        </div>

        <div className="user-stat-card">
          <div className="stat-icon-wrapper green">
            <FaUserCheck />
          </div>
          <div className="stat-info">
            <span className="stat-label">Active / Approved</span>
            <span className="stat-value">{approvedUsersCount}</span>
          </div>
        </div>

        <div className="user-stat-card">
          <div className="stat-icon-wrapper red">
            <FaUserSlash />
          </div>
          <div className="stat-info">
            <span className="stat-label">Deactivated</span>
            <span className="stat-value">{deactivatedUsersCount}</span>
          </div>
        </div>

        <div className="user-stat-card">
          <div className="stat-icon-wrapper amber">
            <FaUserClock />
          </div>
          <div className="stat-info">
            <span className="stat-label">Pending Approval</span>
            <span className="stat-value">{pendingCount}</span>
          </div>
        </div>
      </div>

      {/* Navigation Toolbar & Filters */}
      <div className="users-toolbar">
        {/* Row 1: Primary Navigation Tabs & Search */}
        <div className="toolbar-top-row">
          {/* Segmented Tab Switcher */}
          <div className="users-tab-group">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'existing' ? 'active' : ''}`}
              onClick={() => setActiveTab('existing')}
            >
              <FaUsers />
              <span>Existing Users</span>
              <span className="tab-badge">{users.length}</span>
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              <FaUserClock />
              <span>Pending Requests</span>
              <span className={`tab-badge ${pendingCount > 0 ? 'pending-alert' : ''}`}>
                {pendingCount}
              </span>
            </button>
          </div>

          {/* Search & Action Controls for Existing Users */}
          {activeTab === 'existing' && (
            <div className="toolbar-top-controls-right">
              {/* Search Bar */}
              <div className="search-box-wrapper">
                <FaSearch className="search-box-icon" />
                <input
                  type="text"
                  className="search-box-input"
                  placeholder="Search by name, ID, mobile, dept..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-box-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search query"
                    aria-label="Clear search"
                  >
                    <FaTimes />
                  </button>
                )}
              </div>

              {/* Filters Toggle Button */}
              {(() => {
                const activeCount = (selectedRoleFilter !== 'ALL' ? 1 : 0) + (selectedStatusFilter !== 'ALL' ? 1 : 0);
                const hasFilters = activeCount > 0;
                return (
                  <button
                    type="button"
                    className={`btn-toggle-filters-user ${showFilters ? 'active' : ''} ${hasFilters ? 'has-active' : ''}`}
                    onClick={() => setShowFilters(prev => !prev)}
                    title={showFilters ? 'Hide filters panel' : 'Open filter options'}
                  >
                    <FaFilter className="filter-btn-icon" />
                    <span>Filters</span>
                    {activeCount > 0 && <span className="active-filter-badge">{activeCount}</span>}
                    {showFilters ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                  </button>
                );
              })()}

              {/* Expand / Collapse All Roles Button */}
              {roleNames.length > 0 && (
                <button
                  type="button"
                  className="btn-toggle-all-accordions"
                  onClick={handleToggleAllAccordions}
                  title={allRolesExpanded ? 'Collapse all role groups' : 'Expand all role groups'}
                >
                  {allRolesExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                  <span>{allRolesExpanded ? 'Collapse All' : 'Expand All'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Active Filters Summary Chips (When filter strip is closed but filters are active) */}
        {activeTab === 'existing' && !showFilters && (selectedRoleFilter !== 'ALL' || selectedStatusFilter !== 'ALL') && (
          <div className="active-filters-chips-strip fade-in">
            <span className="active-chips-label">Filters Applied:</span>
            {selectedRoleFilter !== 'ALL' && (
              <span className="filter-chip">
                Role: {selectedRoleFilter}
                <button type="button" onClick={() => setSelectedRoleFilter('ALL')}>✕</button>
              </span>
            )}
            {selectedStatusFilter !== 'ALL' && (
              <span className="filter-chip">
                Status: {selectedStatusFilter}
                <button type="button" onClick={() => setSelectedStatusFilter('ALL')}>✕</button>
              </span>
            )}
            <button
              type="button"
              className="btn-clear-all-chips"
              onClick={() => {
                setSelectedRoleFilter('ALL');
                setSelectedStatusFilter('ALL');
              }}
            >
              Clear All
            </button>
          </div>
        )}

        {/* Row 2: Secondary Filter Strip: ONLY shown when user clicks Filters toggle */}
        {activeTab === 'existing' && showFilters && (
          <div className="toolbar-filter-strip fade-in">
            <div className="filter-controls-left">
              <div className="filter-label-group">
                <FaFilter className="filter-icon" />
                <span className="filter-label-text">Filter:</span>
              </div>

              {/* Role Dropdown */}
              <div className="filter-select-wrapper">
                <select
                  className="filter-select"
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value)}
                  title="Filter users by role"
                >
                  <option value="ALL">All Roles ({roles.length})</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Dropdown */}
              <div className="filter-select-wrapper">
                <select
                  className="filter-select"
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  title="Filter users by account status"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="APPROVED">Approved Only</option>
                  <option value="DEACTIVATED">Deactivated Only</option>
                </select>
              </div>

              {/* Reset Filters Button */}
              {(selectedRoleFilter !== 'ALL' || selectedStatusFilter !== 'ALL') && (
                <button
                  type="button"
                  className="btn-clear-inline-filters"
                  onClick={() => {
                    setSelectedRoleFilter('ALL');
                    setSelectedStatusFilter('ALL');
                  }}
                  title="Reset all active filters"
                >
                  <FaTimes size={11} />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            <div className="filter-controls-right">
              <button
                type="button"
                className="btn-small btn-apply-filter"
                onClick={() => setShowFilters(false)}
                style={{ padding: '0.45rem 1rem', borderRadius: '8px', cursor: 'pointer', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.825rem' }}
              >
                Close Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          TAB 1: EXISTING USERS (GROUPED BY ROLE)
          ==================================================================== */}
      {activeTab === 'existing' && (
        <div>
          {loading ? (
            <div className="users-empty-state">
              <FaSpinner className="spin empty-state-icon" style={{ color: 'var(--primary)' }} />
              <p className="empty-state-title">Loading user directory...</p>
            </div>
          ) : Object.keys(usersByRole).length === 0 ? (
            <div className="users-empty-state">
              <FaUsers className="empty-state-icon" />
              <p className="empty-state-title">No Users Found</p>
              <p className="empty-state-desc">
                {searchQuery || selectedRoleFilter !== 'ALL' || selectedStatusFilter !== 'ALL'
                  ? 'No users match your active search or filter criteria. Try resetting filters.'
                  : 'No verified users are currently active in the platform.'}
              </p>
              {(searchQuery || selectedRoleFilter !== 'ALL' || selectedStatusFilter !== 'ALL') && (
                <button
                  type="button"
                  className="btn-modal-cancel"
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedRoleFilter('ALL');
                    setSelectedStatusFilter('ALL');
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            Object.entries(usersByRole).map(([roleName, roleUsers]) => {
              const RoleIcon = getRoleIcon(roleName);
              // Collapsed by default; only expanded when explicitly toggled to true
              const isExpanded = Boolean(expandedRoles[roleName]);

              return (
                <div key={roleName} className="role-group-section">
                  {/* Role Group Accordion Header */}
                  <div
                    className="role-group-header"
                    onClick={() => toggleRoleExpanded(roleName)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleRoleExpanded(roleName);
                      }
                    }}
                  >
                    <div className="role-group-title-left">
                      <div className="role-group-icon">
                        <RoleIcon />
                      </div>
                      <div className="role-group-title-info">
                        <span className="role-group-name">{roleName}</span>
                        <span className="role-user-count-chip">
                          {roleUsers.length} {roleUsers.length === 1 ? 'Member' : 'Members'}
                        </span>
                      </div>
                    </div>

                    <div className="role-accordion-right">
                      <span className="role-accordion-hint">
                        {isExpanded ? 'Click to collapse' : 'Click to expand'}
                      </span>
                      <div className={`role-accordion-arrow-btn ${isExpanded ? 'expanded' : ''}`}>
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Role Users Cards */}
                  {isExpanded && (
                    <div className="role-group-content">
                      {roleUsers.map(u => {
                        const isSelf = u.id === user.id;
                        const isApproved = u.status === 'APPROVED';

                        // Parse metadata
                        let metadataObj: Record<string, any> = {};
                        try {
                          metadataObj = JSON.parse(u.metadata || '{}');
                        } catch {
                          metadataObj = {};
                        }

                        // Separate clean text details from image previews
                        const textDetails: [string, any][] = [];
                        const imageDocs: [string, string][] = [];

                        // Add primary attributes if not already in metadata
                        if (u.mobile) textDetails.push(['Mobile Number', u.mobile]);
                        if (u.email) textDetails.push(['Email Address', u.email]);
                        if (u.employeeId) textDetails.push(['Employee ID', u.employeeId]);
                        if (u.department) textDetails.push(['Department', u.department]);

                        for (const [k, v] of Object.entries(metadataObj)) {
                          const kLower = k.toLowerCase();
                          // Filter out internal/duplicate fields
                          if (kLower.includes('password')) continue;
                          if (kLower.startsWith('field_')) continue;
                          if (kLower === 'roleid' || kLower === 'role_id') continue;
                          if (kLower === 'role') continue;
                          if (['fullname', 'mobile', 'email', 'employeeid', 'department'].includes(kLower)) continue;

                          const label = humanizeKey(k);
                          if (isImgUrl(v)) {
                            imageDocs.push([label, String(v)]);
                          } else if (v !== null && v !== undefined && v !== '') {
                            textDetails.push([label, v]);
                          }
                        }

                        // Generate user initials
                        const initials = (u.fullName || 'User')
                          .split(' ')
                          .filter(Boolean)
                          .map((p: string) => p[0])
                          .slice(0, 2)
                          .join('');

                        return (
                          <div key={u.id} className="user-profile-card">
                            {/* Card Top Bar */}
                            <div className="user-card-top-bar">
                              <div className="user-identity-wrap">
                                <div className="user-avatar-circle">
                                  {initials || <FaUsers />}
                                </div>
                                <div className="user-identity-names">
                                  <div className="user-full-name-row">
                                    <span className="user-full-name">{u.fullName || 'Unnamed User'}</span>
                                    <span className={`status-pill ${u.status.toLowerCase()}`}>
                                      <span className="status-dot" />
                                      {u.status}
                                    </span>
                                    {isSelf && (
                                      <span className="user-meta-chip" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                                        You
                                      </span>
                                    )}
                                  </div>

                                  <div className="user-sub-tags">
                                    {u.employeeId && (
                                      <span className="user-meta-chip">
                                        <FaIdBadge /> {u.employeeId}
                                      </span>
                                    )}
                                    {u.department && (
                                      <span className="user-meta-chip">
                                        <FaBuilding /> {u.department}
                                      </span>
                                    )}
                                    {roleName && (
                                      <span className="user-meta-chip">
                                        <RoleIcon style={{ fontSize: '0.7rem' }} /> {roleName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              {!isSelf && (
                                <div className="user-card-actions">
                                  {isApproved ? (
                                    <button
                                      type="button"
                                      className="btn-user-action deactivate"
                                      onClick={() => setConfirmModal({ id: u.id, action: 'deactivate', name: u.fullName })}
                                      title={`Deactivate account for ${u.fullName}`}
                                      disabled={actionLoading?.id === u.id}
                                    >
                                      <FaUserSlash />
                                      <span>Deactivate</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn-user-action reactivate"
                                      onClick={() => setConfirmModal({ id: u.id, action: 'reactivate', name: u.fullName })}
                                      title={`Reactivate account for ${u.fullName}`}
                                      disabled={actionLoading?.id === u.id}
                                    >
                                      <FaUserCheck />
                                      <span>Reactivate</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Multi-Column Details Grid */}
                            {textDetails.length > 0 && (
                              <div className="user-details-grid">
                                {textDetails.map(([label, val]) => {
                                  const displayStr = Array.isArray(val) ? val.join(', ') : String(val);
                                  const isMobileOrEmail = label.toLowerCase().includes('mobile') || label.toLowerCase().includes('email');
                                  const itemKey = `${u.id}-${label}`;

                                  return (
                                    <div key={label} className="detail-item">
                                      <div className="detail-label-row">
                                        {label.toLowerCase().includes('mobile') && <FaPhone style={{ fontSize: '0.65rem' }} />}
                                        {label.toLowerCase().includes('email') && <FaEnvelope style={{ fontSize: '0.65rem' }} />}
                                        {label.toLowerCase().includes('gender') && <FaVenusMars style={{ fontSize: '0.65rem' }} />}
                                        <span>{label}</span>
                                      </div>
                                      <div className="detail-value">
                                        <span>{displayStr}</span>
                                        {isMobileOrEmail && (
                                          <button
                                            type="button"
                                            className="btn-copy-chip"
                                            onClick={() => copyToClipboard(displayStr, itemKey)}
                                            title="Copy to clipboard"
                                          >
                                            {copiedKey === itemKey ? <FaCheck style={{ color: 'var(--success)' }} /> : <FaCopy />}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Verification Documents & Image Attachments Gallery */}
                            {imageDocs.length > 0 && (
                              <div className="user-documents-section">
                                <div className="user-documents-title">
                                  <FaFileImage />
                                  <span>Verification Documents & Attachments ({imageDocs.length})</span>
                                </div>
                                <div className="user-documents-gallery">
                                  {imageDocs.map(([label, imgUrl]) => (
                                    <div
                                      key={label}
                                      className="document-preview-card"
                                      onClick={() => setImagePreviewUrl(imgUrl)}
                                      title={`Click to preview full ${label}`}
                                    >
                                      <div className="document-thumb-wrap">
                                        <img src={imgUrl} alt={label} className="document-thumb-img" />
                                        <div className="document-zoom-badge">
                                          <FaSearchPlus />
                                        </div>
                                      </div>
                                      <div className="document-info-wrap">
                                        <span className="document-label">{label}</span>
                                        <span className="document-hint">Click to enlarge</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 2: PENDING APPROVAL REQUESTS
          ==================================================================== */}
      {activeTab === 'pending' && (
        <div className="pending-requests-list">
          {pendingRequests.length === 0 ? (
            <div className="users-empty-state">
              <FaUserCheck className="empty-state-icon" style={{ color: 'var(--success)' }} />
              <p className="empty-state-title">No Pending Requests</p>
              <p className="empty-state-desc">
                All registration requests have been processed. New registrations will automatically appear here for verification.
              </p>
            </div>
          ) : (
            pendingRequests.map(req => {
              const { fullName, textDetails, imageDetails } = parseRequestData(req);
              const isApproving = actionLoading?.id === req.id && actionLoading?.action === 'approve';
              const isRejecting = actionLoading?.id === req.id && actionLoading?.action === 'reject';
              const isBusy = isApproving || isRejecting;
              const selectedRoleId = pendingRoleSelection[req.id] || req.requestedRoleId || roles[0]?.id;

              return (
                <div key={req.id} className="pending-request-card">
                  {/* Request Header */}
                  <div className="request-card-header">
                    <div className="user-identity-wrap">
                      <div className="user-avatar-circle" style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' }}>
                        {fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="user-identity-names">
                        <div className="user-full-name-row">
                          <span className="user-full-name">{fullName}</span>
                          <span className="status-pill pending">
                            <span className="status-dot" />
                            Pending Review
                          </span>
                        </div>
                        <div className="user-sub-tags">
                          {req.form?.name && (
                            <span className="request-meta-badge">
                              Form: {req.form.name}
                            </span>
                          )}
                          {req.createdAt && (
                            <span className="request-meta-badge">
                              Submitted: {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Role Selection & Approval Actions */}
                    <div className="request-decision-panel">
                      <select
                        className="role-assign-select"
                        value={selectedRoleId}
                        onChange={(e) =>
                          setPendingRoleSelection(prev => ({
                            ...prev,
                            [req.id]: Number(e.target.value),
                          }))
                        }
                        disabled={isBusy}
                        title="Choose role to assign upon approval"
                      >
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>
                            Role: {r.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="btn-approve-request"
                        onClick={() => handleApproveRequest(req.id, fullName)}
                        disabled={isBusy}
                        title={`Approve registration for ${fullName}`}
                      >
                        {isApproving ? <FaSpinner className="spin" /> : <FaCheck />}
                        <span>{isApproving ? 'Approving...' : 'Approve'}</span>
                      </button>

                      <button
                        type="button"
                        className="btn-reject-request"
                        onClick={() => {
                          setRejectModal({ id: req.id, name: fullName });
                          setRejectionReason('');
                        }}
                        disabled={isBusy}
                        title={`Reject request from ${fullName}`}
                      >
                        {isRejecting ? <FaSpinner className="spin" /> : <FaTimes />}
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>

                  {/* Applicant Submitted Data Grid */}
                  {textDetails.length > 0 && (
                    <div className="user-details-grid">
                      {textDetails.map(([label, val]) => (
                        <div key={label} className="detail-item">
                          <div className="detail-label-row">
                            <span>{label}</span>
                          </div>
                          <div className="detail-value">
                            <span>{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Document & Proof Verification Section */}
                  {imageDetails.length > 0 && (
                    <div className="user-documents-section">
                      <div className="user-documents-title">
                        <FaFileImage />
                        <span>Submitted Verification Documents ({imageDetails.length})</span>
                      </div>
                      <div className="user-documents-gallery">
                        {imageDetails.map(([label, imgUrl]) => (
                          <div
                            key={label}
                            className="document-preview-card"
                            onClick={() => setImagePreviewUrl(imgUrl)}
                            title={`Click to preview full ${label}`}
                          >
                            <div className="document-thumb-wrap">
                              <img src={imgUrl} alt={label} className="document-thumb-img" />
                              <div className="document-zoom-badge">
                                <FaSearchPlus />
                              </div>
                            </div>
                            <div className="document-info-wrap">
                              <span className="document-label">{label}</span>
                              <span className="document-hint">Click to inspect</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ====================================================================
          MODAL: DEACTIVATE / REACTIVATE CONFIRMATION
          ==================================================================== */}
      {confirmModal && (
        <div className="users-modal-backdrop" onClick={() => setConfirmModal(null)}>
          <div className="users-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="users-modal-header">
              <div className={`users-modal-icon-badge ${confirmModal.action === 'deactivate' ? 'danger' : 'success'}`}>
                {confirmModal.action === 'deactivate' ? <FaExclamationTriangle /> : <FaUserCheck />}
              </div>
              <h3>Confirm Account {confirmModal.action === 'deactivate' ? 'Deactivation' : 'Reactivation'}</h3>
            </div>
            <div className="users-modal-body">
              <p>
                Are you sure you want to <strong>{confirmModal.action}</strong> the account for{' '}
                <strong>"{confirmModal.name}"</strong>?
              </p>
              {confirmModal.action === 'deactivate' && (
                <p style={{ fontSize: '0.85rem', color: '#b91c1c' }}>
                  Deactivated users are immediately prevented from logging into the portal and mobile application.
                </p>
              )}
            </div>
            <div className="users-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setConfirmModal(null)}
                disabled={actionLoading?.id === confirmModal.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn-user-action ${confirmModal.action}`}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.875rem' }}
                onClick={() => handleUserStatusChange(confirmModal.id, confirmModal.action, confirmModal.name)}
                disabled={actionLoading?.id === confirmModal.id}
              >
                {actionLoading?.id === confirmModal.id ? (
                  <>
                    <FaSpinner className="spin" /> Processing...
                  </>
                ) : (
                  <>
                    {confirmModal.action === 'deactivate' ? <FaUserSlash /> : <FaUserCheck />}
                    <span>Confirm {confirmModal.action === 'deactivate' ? 'Deactivation' : 'Reactivation'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: REJECT REGISTRATION REASON
          ==================================================================== */}
      {rejectModal && (
        <div className="users-modal-backdrop" onClick={() => setRejectModal(null)}>
          <div className="users-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="users-modal-header">
              <div className="users-modal-icon-badge danger">
                <FaTimes />
              </div>
              <h3>Reject Registration Request</h3>
            </div>
            <div className="users-modal-body">
              <p>
                Specify the reason for rejecting registration request from <strong>"{rejectModal.name}"</strong>:
              </p>
              <textarea
                className="modal-textarea"
                placeholder="e.g. Incomplete ID card documentation, Invalid employee credentials..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="users-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setRejectModal(null)}
                disabled={actionLoading?.id === rejectModal.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-reject-request"
                onClick={handleRejectRequest}
                disabled={actionLoading?.id === rejectModal.id}
              >
                {actionLoading?.id === rejectModal.id ? <FaSpinner className="spin" /> : <FaTimes />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: FULLSCREEN LIGHTBOX FOR ATTACHMENTS
          ==================================================================== */}
      {imagePreviewUrl && (
        <div className="image-lightbox-backdrop" onClick={() => setImagePreviewUrl(null)}>
          <div className="image-lightbox-wrapper" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="btn-close-lightbox"
              onClick={() => setImagePreviewUrl(null)}
              aria-label="Close image preview"
            >
              <FaTimes />
            </button>
            <img src={imagePreviewUrl} alt="Document Preview" className="image-lightbox-img" />
          </div>
        </div>
      )}
    </div>
  );
}
