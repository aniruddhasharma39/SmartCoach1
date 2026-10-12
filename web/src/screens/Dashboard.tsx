import { useEffect, useState } from 'react';
import { FaBell } from 'react-icons/fa';
import type { User, NotificationItem } from '../types';
import Roles from './Roles';
import RegistrationBuilder from './RegistrationBuilder';
import Branding from './Branding';
import ClusterDashboard from './Cluster/ClusterDashboard';
import { API_URL } from '../config';

type Props = {
  user: User;
  onLogout: () => void;
};

const DEFAULT_SYSTEM_MODULES = [
  { name: 'Manage Users', slug: 'manage-users' },
  { name: 'Roles', slug: 'roles' },
  { name: 'Registration Builder', slug: 'registration' },
  { name: 'Branding', slug: 'branding' },
  { name: 'Cluster', slug: 'cluster' },
];

export default function Dashboard({ user, onLogout }: Props) {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<string>('home');
  const [systemModules, setSystemModules] = useState<any[]>(DEFAULT_SYSTEM_MODULES);
  const [branding, setBranding] = useState({ appName: 'LC Platform' });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const canManageUsers = user.role === 'Developer' || user.allowedModules?.includes('manage-users');

  const fetchUsers = async () => {
    if (!canManageUsers) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/users`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setUsers(data.users || []);
      setPendingRequests(data.pendingRequests || []);
    } catch (err) {
      console.error(err);
    }
  };

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ id: number, action: string, name: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/roles`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setRoles(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSystemModules = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/modules`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setSystemModules(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBranding = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/settings/branding`);
      const data = await res.json();
      if(data && data.appName) setBranding(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/notifications`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await fetch(`${API_URL}/api/v1/notifications/read-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notificationIds: notifications.map(n => n.id) })
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const dismissNotification = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await fetch(`${API_URL}/api/v1/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setNotifications(prev => {
        const filtered = prev.filter(n => n.id !== id);
        setUnreadCount(filtered.filter(n => !n.isRead).length);
        return filtered;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      fetch(`${API_URL}/api/v1/notifications/${item.id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      }).catch(console.error);
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    if (item.targetModule) {
      setCurrentView(item.targetModule);
    }
    setIsNotificationsOpen(false);
  };

  const fetchUserProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
      } else {
        setProfileData(user);
      }
    } catch (err) {
      setProfileData(user);
    }
  };

  const humanizeKey = (key: string) => {
    if (key === 'fullName') return 'Full Name';
    if (key === 'mobile') return 'Mobile Number';
    if (key === 'email') return 'Email Address';
    if (key === 'employeeId') return 'Employee ID';
    if (key === 'department') return 'Department';
    if (key === 'role') return 'Role';
    if (key.startsWith('field_')) {
      const sub = key.substring(6);
      return sub.length > 6 ? `Custom Field (${sub.substring(sub.length - 4)})` : `Custom Field (${sub})`;
    }
    return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
  };

  const isImgUrl = (val: any) => {
    if (typeof val !== 'string') return false;
    const lower = val.toLowerCase().trim();
    return lower.startsWith('http') && (lower.includes('/image/upload/') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.gif'));
  };

  useEffect(() => {
    // Fetch in parallel in background without blocking immediate UI rendering
    fetchRoles();
    fetchUsers();
    fetchSystemModules();
    fetchBranding();
    fetchNotifications();
    fetchUserProfile();

    // Poll notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentView === 'manage-users' && canManageUsers) {
      fetchUsers();
      fetchNotifications();
    }
  }, [currentView]);

  const getDisplayData = (req: any, reqData: any) => {
    let schema: any = null;
    try {
      if (req.form?.schema) schema = JSON.parse(req.form.schema);
    } catch {}

    const allFields: any[] = [];
    const walk = (fields: any[]) => {
      if(!fields) return;
      for (const f of fields) {
        if (f.type === 'section' && f.children) walk(f.children);
        else allFields.push(f);
      }
    };
    if (schema?.fields) walk(schema.fields);

    let fullName = reqData.fullName;
    const formattedData: Record<string, any> = {};

    for (const [k, v] of Object.entries(reqData)) {
      if (k === 'password') continue;
      const field = allFields.find(f => f.name === k);
      const label = field ? field.label : k;
      formattedData[label] = v;

      if (!fullName && field && (field.label.toLowerCase().includes('name'))) {
        fullName = v;
      }
    }

    return { fullName: fullName || 'Unknown User', formattedData };
  };

  const handleAction = async (id: number, action: string, body = {}, isRequest = false) => {
    try {
      const endpoint = isRequest 
        ? `${API_URL}/api/v1/users/request/${id}/${action}`
        : `${API_URL}/api/v1/users/${id}/${action}`;
      
      await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
      });
      fetchUsers();
      showToast('Action completed successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  const usersByRole = users.reduce((acc, curr) => {
    if (curr.status === 'PENDING') return acc; // Just in case, shouldn't happen now
    const roleName = curr.role?.name || 'Unknown';
    if (!acc[roleName]) acc[roleName] = [];
    acc[roleName].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  const [activeTab, setActiveTab] = useState<'existing' | 'pending'>('existing');

  return (
    <div className="app-container">
      {toastMessage && (
        <div style={{ 
          position: 'fixed', top: 20, right: 20, 
          backgroundColor: 'var(--success)', color: 'white', 
          padding: '12px 24px', borderRadius: 8, 
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
          zIndex: 9999, fontWeight: 'bold',
          transition: 'all 0.3s ease-in-out'
        }}>
          {toastMessage}
        </div>
      )}
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem' }}>
        <h2 style={{ margin: 0, color: 'var(--primary)' }}>
          {branding.appName}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button 
              type="button" 
              style={{ 
                position: 'relative', 
                background: isNotificationsOpen ? '#e0f2fe' : '#f8fafc',
                border: isNotificationsOpen ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                minWidth: '42px',
                minHeight: '42px',
                padding: 0,
                margin: 0,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isNotificationsOpen ? '0 0 0 3px rgba(2, 132, 199, 0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
              }}
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              title="Notifications"
            >
              <FaBell size={19} style={{ color: isNotificationsOpen ? '#0284c7' : '#475569', display: 'block' }} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '9999px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 4px',
                  fontSize: '0.68rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  lineHeight: 1,
                  pointerEvents: 'none',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Popover */}
            {isNotificationsOpen && (
              <div 
                className="card"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 380,
                  maxWidth: '92vw',
                  maxHeight: '480px',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 0,
                  zIndex: 1001,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  backgroundColor: '#fff',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--surface)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--primary)' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="badge" style={{ backgroundColor: 'var(--primary)', color: 'white', fontSize: '0.72rem' }}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {notifications.length > 0 && (
                      <button 
                        type="button" 
                        style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: '2px 4px' }}
                        onClick={markAllNotificationsAsRead}
                      >
                        Mark all as read
                      </button>
                    )}
                    <button 
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.9rem', cursor: 'pointer', padding: 0 }}
                      onClick={() => setIsNotificationsOpen(false)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div style={{ overflowY: 'auto', maxHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.88rem' }}>
                      <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>🎉</div>
                      No notifications right now.
                    </div>
                  ) : (
                    notifications.map(item => (
                      <div 
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid rgba(0,0,0,0.05)',
                          backgroundColor: item.isRead ? '#fff' : 'rgba(11,60,122,0.03)',
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                          position: 'relative'
                        }}
                      >
                        <span style={{ fontSize: '1.2rem', marginTop: 1 }}>
                          {item.type === 'user_request' ? '👤' : item.type === 'cluster_created' ? '🌐' : '📟'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                            <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>{item.title}</strong>
                            <small style={{ fontSize: '0.72rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                              {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </small>
                          </div>
                          <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#475569', lineHeight: 1.35 }}>
                            {item.message}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => dismissNotification(item.id, e)}
                          title="Dismiss"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '2px',
                            fontSize: '0.85rem',
                            lineHeight: 1
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Avatar with Hover Dropdown */}
          <div 
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            onMouseEnter={() => setIsDropdownOpen(true)}
            onMouseLeave={() => setIsDropdownOpen(false)}
          >
            <div className="avatar" style={{ margin: 0 }}>
              {user.fullName.substring(0, 2).toUpperCase()}
            </div>
            
            {isDropdownOpen && (
              <div className="card" style={{ 
                position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
                minWidth: 230, padding: 14, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 10,
                boxShadow: '0 10px 25px rgba(0,0,0,0.12)', borderRadius: 10,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.05rem', lineHeight: 1.2 }}>{user.fullName}</div>
                  <div className="text-sm text-muted" style={{ lineHeight: 1.2, marginTop: 4 }}>{user.role}</div>
                  {user.email && <div className="text-xs text-muted" style={{ marginTop: 2 }}>{user.email}</div>}
                </div>
                <hr style={{ margin: '4px 0', borderColor: 'var(--border)', borderStyle: 'solid' }} />
                <button
                  type="button"
                  className="outline w-full"
                  style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600 }}
                  onClick={() => {
                    setIsDropdownOpen(false);
                    fetchUserProfile();
                    setShowProfileModal(true);
                  }}
                >
                  <span>👤</span> Profile Details
                </button>
                <button 
                  className="danger w-full" 
                  style={{ padding: '8px 16px', fontWeight: 'bold', fontSize: '0.85rem' }}
                  onClick={(e) => { e.stopPropagation(); if(window.confirm('Are you sure you want to logout?')) onLogout(); }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className="sidebar" style={{ height: '100%', overflowY: 'auto' }}>
        <nav className="sidebar-nav">
          <a href="#" className={`nav-item ${currentView === 'home' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('home'); }}>Home</a>
          
          {(() => {
            const isDev = user.role === 'Developer';
            const modulesToShow = (systemModules.length > 0 ? systemModules : DEFAULT_SYSTEM_MODULES)
              .filter(m => isDev || (user.allowedModules && user.allowedModules.includes(m.slug)));
            return modulesToShow.map(mod => (
              <a 
                key={mod.slug} 
                href="#" 
                className={`nav-item ${currentView === mod.slug ? 'active' : ''}`} 
                onClick={(e) => { e.preventDefault(); setCurrentView(mod.slug); }}
              >
                {mod.name}
              </a>
            ));
          })()}
        </nav>
      </div>

      <div className="main-content" style={{ height: '100%', overflowY: 'auto', flex: 1 }}>
        <header className="header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.5rem', backgroundColor: 'transparent' }}>
          <h3 style={{ margin: 0 }}>
            {currentView === 'home' ? 'Home' : systemModules.find(m => m.slug === currentView)?.name || 'Dashboard'}
          </h3>
        </header>

        <main className="content-area">
          {currentView === 'roles' && <Roles user={user} />}
          {currentView === 'registration' && <RegistrationBuilder />}
          {currentView === 'branding' && <Branding user={user} />}
          {currentView === 'cluster' && <ClusterDashboard user={user} />}
          
          {currentView === 'manage-users' && (
            <>
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-4">
                  <button 
                    className={activeTab === 'existing' ? 'primary' : 'outline'} 
                    onClick={() => setActiveTab('existing')}
                  >
                    Existing Users
                  </button>
                  <button 
                    className={activeTab === 'pending' ? 'primary' : 'outline'} 
                    onClick={() => setActiveTab('pending')}
                  >
                    Pending Approval ({pendingRequests.length})
                  </button>
                </div>
                <button 
                  className="outline" 
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={fetchUsers}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                  Refresh
                </button>
              </div>

              {activeTab === 'pending' && (
                <div className="flex-col gap-4">
                  {pendingRequests.length === 0 && <p className="text-muted">No pending requests.</p>}
                  {pendingRequests.map(req => {
                    const reqData = JSON.parse(req.data || '{}');
                    const { fullName, formattedData } = getDisplayData(req, reqData);
                    return (
                      <div key={req.id} className="card">
                        <div className="flex justify-between items-center">
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{fullName}</div>
                            <div className="text-sm text-muted">
                              {Object.entries(formattedData).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                            </div>
                            <div className="text-sm text-muted mt-2">
                              Form: <strong>{req.form?.name}</strong> | Requested Role ID: <strong>{req.requestedRoleId}</strong>
                            </div>
                          </div>
                          <div className="flex-col gap-2">
                            <select 
                              id={`role-${req.id}`} 
                              defaultValue={req.requestedRoleId} 
                              style={{ marginBottom: '0.5rem' }}
                            >
                              {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button 
                                className="success" 
                                style={{ backgroundColor: 'var(--success)', color: 'white' }}
                                onClick={() => {
                                  const select = document.getElementById(`role-${req.id}`) as HTMLSelectElement;
                                  handleAction(req.id, 'approve', { roleId: Number(select.value) }, true);
                                }}
                              >
                                Approve
                              </button>
                              <button 
                                className="danger"
                                onClick={() => {
                                  const reason = prompt('Rejection reason (optional):');
                                  handleAction(req.id, 'reject', { reason }, true);
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'existing' && (
                <div className="flex-col">
                  {Object.keys(usersByRole).length === 0 && (
                    <div className="card text-center text-muted" style={{ padding: '2rem' }}>
                      No existing users found.
                    </div>
                  )}
                  {Object.entries(usersByRole).map(([roleName, roleUsers]) => (
                    <div key={roleName}>
                      <div 
                        className="accordion-header" 
                        onClick={() => setOpenSection(openSection === roleName ? null : roleName)}
                      >
                        <div className="flex gap-4 items-center">
                          <span className="badge" style={{ backgroundColor: 'var(--secondary)' }}>{(roleUsers as any[]).length}</span>
                          <span>{roleName}</span>
                        </div>
                        <span>{openSection === roleName ? '▲' : '▼'}</span>
                      </div>
                      
                      {openSection === roleName && (
                        <div className="accordion-content">
                          {(roleUsers as any[]).map((u: any) => (
                            <div key={u.id} className="user-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <div style={{ fontWeight: 'bold' }}>{u.fullName}</div>
                                  <div className="text-sm text-muted">{u.employeeId} | {u.department}</div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className={`badge ${u.status.toLowerCase()}`}>{u.status}</span>
                                  {u.status === 'DEACTIVATED' ? (
                                    <button className="primary" onClick={() => setConfirmModal({ id: u.id, action: 'reactivate', name: u.fullName })}>Reactivate</button>
                                  ) : (
                                    <button className="danger outline" onClick={() => setConfirmModal({ id: u.id, action: 'deactivate', name: u.fullName })}>Deactivate</button>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm bg-gray-50" style={{ padding: 16, borderRadius: 8, backgroundColor: '#fdfdfd', border: '1px solid #e0e0e0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                                {(() => {
                                  try {
                                    const meta = JSON.parse(u.metadata || '{}');
                                    const cleanedMeta: Record<string, any> = {};
                                    for (const [k, v] of Object.entries(meta)) {
                                      if (k.toLowerCase().includes('password')) continue;
                                      if (k.startsWith('field_')) continue; // Should not exist, but just in case skip them
                                      cleanedMeta[k] = v;
                                    }

                                    if (Object.keys(cleanedMeta).length === 0) return <span className="text-muted">No additional details</span>;
                                    
                                    return (
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        {Object.entries(cleanedMeta).map(([k, v]) => (
                                          <div key={k} style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</span>
                                            <strong style={{ color: '#333' }}>{Array.isArray(v) ? v.join(', ') : String(v)}</strong>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  } catch (e) {
                                    return null;
                                  }
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {currentView === 'home' && (
            <div className="card text-center" style={{ padding: 64, marginTop: 32 }}>
              <h2 style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: 16 }}>Welcome to LC Platform</h2>
              <p className="text-muted" style={{ fontSize: '1.2rem' }}>You are logged in as <strong>{user.role}</strong>.</p>
            </div>
          )}
        </main>
      </div>
      {/* Profile Details Modal */}
      {showProfileModal && (
        <div 
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            zIndex: 2000, padding: 16 
          }}
          onClick={() => setShowProfileModal(false)}
        >
          <div 
            className="card slide-up" 
            style={{ 
              width: '100%', maxWidth: 650, maxHeight: '90vh', overflowY: 'auto', 
              padding: 0, borderRadius: 16, boxShadow: '0 20px 45px rgba(0,0,0,0.2)',
              backgroundColor: '#fff'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              padding: '18px 24px', borderBottom: '1px solid var(--border)', 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              backgroundColor: 'var(--surface)' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.3rem' }}>👤</span>
                <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800 }}>Profile Details</h3>
              </div>
              <button className="icon-btn" style={{ fontSize: '1.1rem', cursor: 'pointer' }} onClick={() => setShowProfileModal(false)}>✕</button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* User Hero Banner */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: 16, borderRadius: 12, backgroundColor: 'rgba(11,60,122,0.05)', border: '1px solid rgba(11,60,122,0.1)' }}>
                <div className="avatar" style={{ width: 56, height: 56, fontSize: '1.4rem', backgroundColor: 'var(--primary)', color: 'white' }}>
                  {(profileData?.fullName || user.fullName).substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '1.25rem', color: '#1e293b' }}>{profileData?.fullName || user.fullName}</h4>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="badge" style={{ backgroundColor: 'var(--secondary)', color: 'white', fontSize: '0.8rem' }}>
                      {profileData?.role || user.role}
                    </span>
                    <span className="badge success" style={{ fontSize: '0.8rem' }}>
                      {profileData?.status || 'APPROVED'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Details Card */}
              <div>
                <h4 style={{ margin: '0 0 12px', color: 'var(--primary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Account Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>FULL NAME</span>
                    <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{profileData?.fullName || user.fullName}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>EMPLOYEE ID</span>
                    <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{profileData?.employeeId || 'N/A'}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>DEPARTMENT</span>
                    <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{profileData?.department || 'N/A'}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>MOBILE NUMBER</span>
                    <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{profileData?.mobile || 'N/A'}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>EMAIL ADDRESS</span>
                    <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{profileData?.email || user.email}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>MEMBER SINCE</span>
                    <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                      {profileData?.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : 'N/A'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Dynamic Registration Fields */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Registration Form Submissions
                </h4>
                {(() => {
                  try {
                    const rawMeta = profileData?.metadata || user.metadata || '{}';
                    const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
                    const entries = Object.entries(meta).filter(([k]) => !k.toLowerCase().includes('password'));
                    if (entries.length === 0) {
                      return <p className="text-muted text-sm">No additional custom registration fields registered.</p>;
                    }
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                        {entries.map(([k, v]: [string, any]) => {
                          const label = humanizeKey(k);
                          const isImg = isImgUrl(v);
                          return (
                            <div key={k} style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="text-muted" style={{ fontSize: '0.78rem', fontWeight: 600 }}>{label.toUpperCase()}</span>
                              {isImg ? (
                                <img
                                  src={v}
                                  alt={label}
                                  style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', marginTop: 4, cursor: 'pointer' }}
                                  onClick={() => setImagePreviewUrl(v)}
                                  title="Click to view full image"
                                />
                              ) : (
                                <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{Array.isArray(v) ? v.join(', ') : String(v)}</strong>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  } catch {
                    return <p className="text-muted text-sm">No additional dynamic fields registered.</p>;
                  }
                })()}
              </div>

              <div style={{ padding: '10px 14px', backgroundColor: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', fontSize: '0.82rem', color: '#0369a1' }}>
                🔒 <strong>Read-Only Notice:</strong> This profile reflects your verified registration record. Contact your system administrator to request updates.
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--surface)' }}>
              <button className="primary" onClick={() => setShowProfileModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Dialog */}
      {imagePreviewUrl && (
        <div 
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 
          }} 
          onClick={() => setImagePreviewUrl(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={imagePreviewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
            <button style={{ position: 'absolute', top: -35, right: 0, background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }} onClick={() => setImagePreviewUrl(null)}>✕</button>
          </div>
        </div>
      )}

      {confirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px' }}>
            <h3 style={{ marginTop: 0 }}>Confirm Action</h3>
            <p>
              Are you sure you want to <strong>{confirmModal.action}</strong> user <strong>{confirmModal.name}</strong>?
              {confirmModal.action === 'deactivate' && ' They will no longer be able to log in.'}
            </p>
            <div className="flex gap-4" style={{ marginTop: '2rem', justifyContent: 'flex-end' }}>
              <button className="outline" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button 
                className={confirmModal.action === 'deactivate' ? 'danger' : 'primary'}
                style={confirmModal.action === 'reactivate' ? { backgroundColor: 'var(--success)', color: 'white' } : {}}
                onClick={() => {
                  handleAction(confirmModal.id, confirmModal.action);
                  setConfirmModal(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
