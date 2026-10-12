import { useEffect, useState } from 'react';
import { 
  FaBell, FaBars, FaTimes, FaUser, FaUserCircle, 
  FaUserPlus, FaNetworkWired, FaMicrochip, FaCheckCircle, 
  FaLock, FaSearchPlus, FaChevronDown, FaChevronUp, FaSyncAlt,
  FaSpinner, FaCheck, FaTimesCircle, FaInfoCircle 
} from 'react-icons/fa';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  const [actionLoading, setActionLoading] = useState<{ id: number; action: string } | null>(null);
  const [actionCompleted, setActionCompleted] = useState<{ id: number; action: string } | null>(null);
  const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 3200);
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

  const markAllNotificationsAsRead = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await fetch(`${API_URL}/api/v1/notifications/read-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notificationIds: notifications.map(n => n.id) })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const clearAllNotifications = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setNotifications([]);
    setUnreadCount(0);
    try {
      await fetch(`${API_URL}/api/v1/notifications/clear-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const dismissNotification = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setNotifications(prev => {
      const filtered = prev.filter(n => n.id !== id);
      setUnreadCount(filtered.filter(n => !n.isRead).length);
      return filtered;
    });
    try {
      await fetch(`${API_URL}/api/v1/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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

  const handleAction = async (id: number, action: string, body = {}, isRequest = false, userName?: string) => {
    setActionLoading({ id, action });
    try {
      const endpoint = isRequest 
        ? `${API_URL}/api/v1/users/request/${id}/${action}`
        : `${API_URL}/api/v1/users/${id}/${action}`;
      
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        setActionLoading(null);
        setActionCompleted({ id, action });
        
        const actionLabel = action === 'approve' 
          ? 'approved' 
          : action === 'reject' 
          ? 'rejected' 
          : action === 'deactivate' 
          ? 'deactivated' 
          : 'reactivated';
        
        const targetName = userName ? `"${userName}"` : 'User';
        showToast(`${targetName} has been ${actionLabel} successfully!`, action === 'reject' ? 'info' : 'success');
        
        setTimeout(() => {
          fetchUsers();
          fetchNotifications();
          setActionCompleted(null);
        }, 1200);
      } else {
        const err = await res.json().catch(() => ({}));
        setActionLoading(null);
        showToast(err.error || `Failed to ${action} user`, 'danger');
      }
    } catch (err) {
      console.error(err);
      setActionLoading(null);
      showToast(`Network error while trying to ${action} user`, 'danger');
    }
  };

  const handleRefreshUsers = async () => {
    setIsRefreshingUsers(true);
    try {
      await Promise.all([fetchUsers(), fetchNotifications()]);
      showToast('User list and pending requests refreshed', 'info');
    } finally {
      setIsRefreshingUsers(false);
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
      {toast && (
        <div className={`toast-banner ${toast.type}`}>
          {toast.type === 'success' && <FaCheckCircle size={16} />}
          {toast.type === 'danger' && <FaTimesCircle size={16} />}
          {toast.type === 'info' && <FaInfoCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            type="button" 
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              padding: '6px', 
              color: 'var(--primary)', 
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px'
            }}
          >
            {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
          <h2 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.25rem' }}>
            {branding.appName}
          </h2>
        </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {notifications.length > 0 && (
                      <>
                        <button 
                          type="button" 
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: '2px 4px' }}
                          onClick={markAllNotificationsAsRead}
                          title="Mark all as read"
                        >
                          Mark read
                        </button>
                        <button 
                          type="button" 
                          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: '2px 4px' }}
                          onClick={clearAllNotifications}
                          title="Clear all notifications"
                        >
                          Clear all
                        </button>
                      </>
                    )}
                    <button 
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.85rem', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                      onClick={() => setIsNotificationsOpen(false)}
                      title="Close"
                    >
                      <FaTimes />
                    </button>
                  </div>
                </div>

                <div style={{ overflowY: 'auto', maxHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.88rem' }}>
                      <FaCheckCircle size={32} style={{ color: '#10b981', marginBottom: 8 }} />
                      <div>No notifications right now.</div>
                    </div>
                  ) : (
                    notifications.map(item => (
                      <div 
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: item.isRead ? '#ffffff' : '#f0f9ff',
                          borderLeft: item.isRead ? '4px solid transparent' : '4px solid #0284c7',
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                          position: 'relative'
                        }}
                      >
                        <div style={{ 
                          width: 32, 
                          height: 32, 
                          borderRadius: '50%', 
                          backgroundColor: item.type === 'user_request' ? '#e0f2fe' : item.type === 'cluster_created' ? '#ecfdf5' : '#fef3c7',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 2
                        }}>
                          {item.type === 'user_request' ? (
                            <FaUserPlus style={{ color: '#0284c7', fontSize: '0.95rem' }} />
                          ) : item.type === 'cluster_created' ? (
                            <FaNetworkWired style={{ color: '#10b981', fontSize: '0.95rem' }} />
                          ) : (
                            <FaMicrochip style={{ color: '#d97706', fontSize: '0.95rem' }} />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong style={{ fontSize: '0.85rem', color: item.isRead ? '#475569' : '#0f172a', fontWeight: item.isRead ? 600 : 700 }}>
                                {item.title}
                              </strong>
                              {!item.isRead && (
                                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#0284c7', display: 'inline-block' }} />
                              )}
                            </div>
                            <small style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </small>
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: item.isRead ? '#64748b' : '#334155', lineHeight: 1.35 }}>
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
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            flexShrink: 0
                          }}
                        >
                          <FaTimes size={12} />
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
                  style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600 }}
                  onClick={() => {
                    setIsDropdownOpen(false);
                    fetchUserProfile();
                    setShowProfileModal(true);
                  }}
                >
                  <FaUser /> Profile Details
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

      {/* Mobile Drawer Backdrop */}
      <div 
        className={`sidebar-backdrop ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`} style={{ height: '100%', overflowY: 'auto' }}>
        <nav className="sidebar-nav">
          <a href="#" className={`nav-item ${currentView === 'home' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('home'); setIsMobileMenuOpen(false); }}>Home</a>
          
          {(() => {
            const isDev = user.role === 'Developer';
            const modulesToShow = (systemModules.length > 0 ? systemModules : DEFAULT_SYSTEM_MODULES)
              .filter(m => isDev || (user.allowedModules && user.allowedModules.includes(m.slug)));
            return modulesToShow.map(mod => (
              <a 
                key={mod.slug} 
                href="#" 
                className={`nav-item ${currentView === mod.slug ? 'active' : ''}`} 
                onClick={(e) => { e.preventDefault(); setCurrentView(mod.slug); setIsMobileMenuOpen(false); }}
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
              <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
                  <button 
                    className={activeTab === 'existing' ? 'primary' : 'outline'} 
                    onClick={() => setActiveTab('existing')}
                    title="View registered active and deactivated users"
                    data-tooltip="View registered users"
                  >
                    Existing Users
                  </button>
                  <button 
                    className={activeTab === 'pending' ? 'primary' : 'outline'} 
                    onClick={() => setActiveTab('pending')}
                    title="View user registrations awaiting approval"
                    data-tooltip="View pending requests"
                  >
                    Pending Approval ({pendingRequests.length})
                  </button>
                </div>
                <button 
                  className="outline flex items-center gap-2" 
                  disabled={isRefreshingUsers}
                  onClick={handleRefreshUsers}
                  title="Reload users and pending registration requests"
                  data-tooltip="Refresh users & requests"
                >
                  <FaSyncAlt size={13} className={isRefreshingUsers ? 'spin' : ''} />
                  {isRefreshingUsers ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {activeTab === 'pending' && (
                <div className="flex-col gap-4">
                  {pendingRequests.length === 0 && <p className="text-muted">No pending requests.</p>}
                  {pendingRequests.map(req => {
                    const reqData = JSON.parse(req.data || '{}');
                    const { fullName, formattedData } = getDisplayData(req, reqData);
                    
                    const textEntries: [string, any][] = [];
                    const imgEntries: [string, any][] = [];
                    for (const [k, v] of Object.entries(formattedData)) {
                      if (isImgUrl(v)) imgEntries.push([k, v]);
                      else textEntries.push([k, v]);
                    }

                    const isApproving = actionLoading?.id === req.id && actionLoading?.action === 'approve';
                    const isRejecting = actionLoading?.id === req.id && actionLoading?.action === 'reject';
                    const isApproved = actionCompleted?.id === req.id && actionCompleted?.action === 'approve';
                    const isRejected = actionCompleted?.id === req.id && actionCompleted?.action === 'reject';
                    const isRequestBusy = isApproving || isRejecting || isApproved || isRejected;

                    return (
                      <div key={req.id} className="card" style={{ padding: 18 }}>
                        <div className="flex justify-between items-start" style={{ flexWrap: 'wrap', gap: 16 }}>
                          <div style={{ flex: 1, minWidth: '240px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b' }}>{fullName}</div>
                            <div className="text-sm text-muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
                              {textEntries.map(([k, v]) => `${k}: ${v}`).join(' | ')}
                            </div>

                            {/* Cloudinary & Image Thumbnails */}
                            {imgEntries.length > 0 && (
                              <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
                                {imgEntries.map(([label, url]) => (
                                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>{label}</span>
                                    <div 
                                      style={{ 
                                        position: 'relative', width: 72, height: 72, borderRadius: 8, 
                                        overflow: 'hidden', border: '1px solid #cbd5e1', cursor: 'pointer',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                                      }}
                                      onClick={() => setImagePreviewUrl(url)}
                                      title="Click to view full image"
                                    >
                                      <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      <div style={{ 
                                        position: 'absolute', bottom: 3, right: 3, 
                                        backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4, 
                                        padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                      }}>
                                        <FaSearchPlus color="#fff" size={10} />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="text-sm text-muted mt-2">
                              Form: <strong>{req.form?.name}</strong> | Requested Role ID: <strong>{req.requestedRoleId}</strong>
                            </div>
                          </div>
                          <div className="flex-col gap-2" style={{ minWidth: '160px' }}>
                            <select 
                              id={`role-${req.id}`} 
                              defaultValue={req.requestedRoleId} 
                              style={{ marginBottom: '0.5rem' }}
                              title="Select role to assign upon approval"
                              disabled={isRequestBusy}
                            >
                              {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button 
                                className={`success flex items-center justify-center gap-2 ${isApproved ? 'btn-success-state' : ''}`} 
                                style={{ backgroundColor: 'var(--success)', color: 'white', flex: 1 }}
                                disabled={isRequestBusy}
                                title={isApproving ? `Approving registration for ${fullName}...` : `Approve registration for ${fullName} and assign role`}
                                data-tooltip={isApproving ? "Approving registration..." : "Approve and assign role"}
                                data-tooltip-pos="bottom"
                                onClick={() => {
                                  const select = document.getElementById(`role-${req.id}`) as HTMLSelectElement;
                                  handleAction(req.id, 'approve', { roleId: Number(select?.value) }, true, fullName);
                                }}
                              >
                                {isApproving ? (
                                  <>
                                    <FaSpinner className="spin" /> Approving...
                                  </>
                                ) : isApproved ? (
                                  <>
                                    <FaCheck /> Approved!
                                  </>
                                ) : (
                                  <>
                                    <FaCheckCircle /> Approve
                                  </>
                                )}
                              </button>
                              <button 
                                className={`danger flex items-center justify-center gap-2 ${isRejected ? 'btn-danger-state' : ''}`}
                                style={{ flex: 1 }}
                                disabled={isRequestBusy}
                                title={isRejecting ? `Rejecting registration for ${fullName}...` : `Reject registration request for ${fullName}`}
                                data-tooltip={isRejecting ? "Rejecting registration..." : "Reject request"}
                                data-tooltip-pos="bottom"
                                onClick={() => {
                                  const reason = prompt(`Rejection reason for ${fullName} (optional):`);
                                  if (reason !== null) {
                                    handleAction(req.id, 'reject', { reason }, true, fullName);
                                  }
                                }}
                              >
                                {isRejecting ? (
                                  <>
                                    <FaSpinner className="spin" /> Rejecting...
                                  </>
                                ) : isRejected ? (
                                  <>
                                    <FaTimes /> Rejected!
                                  </>
                                ) : (
                                  <>
                                    <FaTimesCircle /> Reject
                                  </>
                                )}
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
                    <div key={roleName} style={{ marginBottom: 12 }}>
                      <div 
                        className="accordion-header" 
                        onClick={() => setOpenSection(openSection === roleName ? null : roleName)}
                        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div className="flex gap-4 items-center">
                          <span className="badge" style={{ backgroundColor: 'var(--secondary)' }}>{(roleUsers as any[]).length}</span>
                          <span style={{ fontWeight: 600 }}>{roleName}</span>
                        </div>
                        <span style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                          {openSection === roleName ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                        </span>
                      </div>
                      
                      {openSection === roleName && (
                        <div className="accordion-content">
                          {(roleUsers as any[]).map((u: any) => (
                            <div key={u.id} className="user-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              <div className="flex justify-between items-start" style={{ flexWrap: 'wrap', gap: 8 }}>
                                <div>
                                  <div style={{ fontWeight: 'bold' }}>{u.fullName}</div>
                                  <div className="text-sm text-muted">{u.employeeId} | {u.department}</div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className={`badge ${u.status.toLowerCase()}`}>{u.status}</span>
                                  {u.status === 'DEACTIVATED' ? (
                                    <button 
                                      className="primary" 
                                      onClick={() => setConfirmModal({ id: u.id, action: 'reactivate', name: u.fullName })}
                                      title={`Reactivate account for ${u.fullName}`}
                                      data-tooltip="Reactivate account"
                                      data-tooltip-pos="left"
                                    >
                                      Reactivate
                                    </button>
                                  ) : (
                                    <button 
                                      className="danger outline" 
                                      onClick={() => setConfirmModal({ id: u.id, action: 'deactivate', name: u.fullName })}
                                      title={`Deactivate account for ${u.fullName}`}
                                      data-tooltip="Deactivate account"
                                      data-tooltip-pos="left"
                                    >
                                      Deactivate
                                    </button>
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
                                      if (k.startsWith('field_')) continue;
                                      cleanedMeta[k] = v;
                                    }

                                    if (Object.keys(cleanedMeta).length === 0) return <span className="text-muted">No additional details</span>;
                                    
                                    return (
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                                        {Object.entries(cleanedMeta).map(([k, v]) => {
                                          const isImg = isImgUrl(v);
                                          return (
                                            <div key={k} style={{ display: 'flex', flexDirection: 'column' }}>
                                              <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</span>
                                              {isImg ? (
                                                <div 
                                                  style={{ 
                                                    position: 'relative', width: 72, height: 72, borderRadius: 8, 
                                                    overflow: 'hidden', border: '1px solid var(--border)', marginTop: 4, cursor: 'pointer',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                                                  }}
                                                  onClick={() => setImagePreviewUrl(v)}
                                                  title="Click to view full image"
                                                >
                                                  <img src={v} alt={k} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                  <div style={{ 
                                                    position: 'absolute', bottom: 3, right: 3, 
                                                    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4, 
                                                    padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                                  }}>
                                                    <FaSearchPlus color="#fff" size={10} />
                                                  </div>
                                                </div>
                                              ) : (
                                                <strong style={{ color: '#333' }}>{Array.isArray(v) ? v.join(', ') : String(v)}</strong>
                                              )}
                                            </div>
                                          );
                                        })}
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
                <FaUserCircle size={22} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 800 }}>Profile Details</h3>
              </div>
              <button 
                className="icon-btn" 
                style={{ fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
                onClick={() => setShowProfileModal(false)}
              >
                <FaTimes size={15} />
              </button>
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
                                <div
                                  style={{
                                    position: 'relative', width: 90, height: 70, borderRadius: 8,
                                    overflow: 'hidden', border: '1px solid var(--border)', marginTop: 4,
                                    cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                                  }}
                                  onClick={() => setImagePreviewUrl(v)}
                                  title="Click to view full image"
                                >
                                  <img
                                    src={v}
                                    alt={label}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                  <div style={{
                                    position: 'absolute', bottom: 3, right: 3,
                                    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4,
                                    padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>
                                    <FaSearchPlus color="#fff" size={10} />
                                  </div>
                                </div>
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

              <div style={{ padding: '10px 14px', backgroundColor: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', fontSize: '0.82rem', color: '#0369a1', display: 'flex', alignItems: 'center' }}>
                <span><FaLock style={{ marginRight: 8, verticalAlign: -1 }} /> <strong>Read-Only Notice:</strong> This profile reflects your verified registration record. Contact your system administrator to request updates.</span>
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
            <button 
              style={{ 
                position: 'absolute', top: -35, right: 0, 
                background: 'none', border: 'none', color: '#fff', 
                fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' 
              }} 
              onClick={() => setImagePreviewUrl(null)}
            >
              <FaTimes size={20} />
            </button>
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
              <button 
                className="outline" 
                disabled={actionLoading?.id === confirmModal.id} 
                onClick={() => setConfirmModal(null)}
                title="Cancel and close dialog"
                data-tooltip="Cancel"
              >
                Cancel
              </button>
              <button 
                className={`flex items-center gap-2 ${confirmModal.action === 'deactivate' ? 'danger' : 'primary'}`}
                style={confirmModal.action === 'reactivate' ? { backgroundColor: 'var(--success)', color: 'white' } : {}}
                disabled={actionLoading?.id === confirmModal.id}
                title={`Confirm ${confirmModal.action} user ${confirmModal.name}`}
                data-tooltip={`Confirm ${confirmModal.action}`}
                onClick={async () => {
                  const { id, action, name } = confirmModal;
                  await handleAction(id, action, {}, false, name);
                  setConfirmModal(null);
                }}
              >
                {actionLoading?.id === confirmModal.id ? (
                  <>
                    <FaSpinner className="spin" /> {confirmModal.action === 'deactivate' ? 'Deactivating...' : 'Reactivating...'}
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
