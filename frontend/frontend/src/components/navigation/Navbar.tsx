import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Search, 
  Bell, 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDocuments } from '../../context/DocumentContext';

interface NavbarProps {
  onToggleMobileSidebar: () => void;
}

interface BusinessNotification {
  id: string;
  documentId: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();
  const { searchQuery, setSearchQuery, setPreviewDoc, documents } = useDocuments();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<BusinessNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshNotifications = useCallback(async () => {
    const token = localStorage.getItem('docvault_auth_token');
    if (!token) return;
    try {
      const response = await fetch('/api/v1/admin/notifications', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch { /* Keep the last notification state during transient network errors. */ }
  }, []);

  useEffect(() => {
    void refreshNotifications();
    const interval = window.setInterval(refreshNotifications, 30000);
    window.addEventListener('focus', refreshNotifications);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refreshNotifications); };
  }, [refreshNotifications, currentUser.id]);

  const markNotificationRead = async (notificationId: string) => {
    const token = localStorage.getItem('docvault_auth_token');
    if (token) await fetch(`/api/v1/admin/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
    setNotifications((items) => items.map((item) => item.id === notificationId ? { ...item, isRead: true } : item));
    setUnreadCount((count) => Math.max(0, count - 1));
  };

  if (!currentUser) return null;

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return role === 'admin' 
          ? 'Enterprise Governance Console' 
          : role === 'manager' 
          ? 'Manager Operations & Oversight' 
          : 'Personal Vault Overview';
      case '/documents':
        return role === 'admin' 
          ? 'Global Document Repository' 
          : role === 'manager' 
          ? 'Department Vault' 
          : 'My Document Repository';
      case '/approvals':
        return 'Review & Certification Center';
      case '/upload':
        return 'Document Upload';
      case '/sharing':
        return 'Access & Sharing Management';
      case '/settings':
        return 'Security & Account Settings';
      case '/admin':
        return 'Enterprise Governance & Roster';
      default:
        return 'Workspace';
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Zone 1: Mobile toggle & Breadcrumb Title */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">DocVault</span>
          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">/</span>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Zone 2: Search Input */}
      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (location.pathname !== '/documents' && e.target.value.length > 0) {
                navigate('/documents');
              }
            }}
            placeholder="Search documents by title, hash, tag or owner..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Zone 3: Actions & Controls */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] leading-4 text-center ring-2 ring-white dark:ring-slate-900">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">Notifications</span>
                {unreadCount > 0 && <button onClick={async () => { const token = localStorage.getItem('docvault_auth_token'); if (token) await fetch('/api/v1/admin/notifications/read-all', { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }); setNotifications((items) => items.map((item) => ({ ...item, isRead: true }))); setUnreadCount(0); }} className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline">Mark all read</button>}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.length === 0 ? <p className="p-4 text-xs text-slate-500 text-center">No notifications yet.</p> : notifications.map((notif) => (
                  <button key={notif.id} onClick={async () => { if (!notif.isRead) await markNotificationRead(notif.id); const doc = notif.documentId && documents.find((item) => item.id === notif.documentId); if (doc) setPreviewDoc(doc); else if (notif.title.toLowerCase().includes('review')) navigate('/approvals'); setShowNotifications(false); }} className={`w-full text-left p-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${notif.isRead ? 'opacity-70' : 'bg-indigo-50/60 dark:bg-indigo-950/20'}`}>
                    <span className="block font-medium text-slate-800 dark:text-slate-200">{notif.title}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-1">{notif.message}</span>
                    <span className="block text-[10px] text-slate-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar linking to settings */}
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 pl-1 group"
          title="Account Settings"
        >
          <img
            src={currentUser.avatar || '/default-avatar.svg'}
            onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/default-avatar.svg'; }}
            alt={currentUser.name}
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 group-hover:ring-indigo-500 transition-all"
          />
        </button>
      </div>
    </header>
  );
};
