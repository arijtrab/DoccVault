import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  FileText, 
  UploadCloud, 
  Share2, 
  Settings, 
  ShieldAlert, 
  HardDrive,
  LogOut,
  FileCheck,
  Users,
  Lock,
  Clock,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDocuments } from '../../context/DocumentContext';
import { formatBytes } from '../../utils/formatters';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const { currentUser, role, logout } = useAuth();
  const { pendingApprovalDocuments, departmentDocuments, myDocuments, documents } = useDocuments();
  const location = useLocation();
  const [capacity, setCapacity] = useState({ used: 0, limit: 0 });

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const token = localStorage.getItem('docvault_auth_token');
    fetch('/api/v1/admin/stats', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Could not load storage stats.')))
      .then(stats => { if (!cancelled) setCapacity({ used: stats.totalStorageBytes, limit: stats.maxStorageBytes }); })
      .catch(() => { if (!cancelled) setCapacity({ used: currentUser.storageUsedBytes, limit: currentUser.storageLimitBytes }); });
    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.storageUsedBytes, currentUser?.storageLimitBytes, role]);

  if (!currentUser) return null;

  // Navigation items specific to each role
  const getUserNavItems = (): NavItem[] => [
    { to: '/', label: 'My Vault', icon: LayoutDashboard },
    { to: '/documents', label: 'My Documents', icon: FileText, badge: `${myDocuments.length}` },
    { to: '/approvals', label: 'Review Assignments', icon: FileCheck, badge: pendingApprovalDocuments.length > 0 ? `${pendingApprovalDocuments.length}` : undefined, badgeColor: 'bg-amber-500 text-slate-950 font-bold' },
    { to: '/upload', label: 'Vault New File', icon: UploadCloud },
    { to: '/sharing', label: 'Sharing & Access', icon: Share2 },
    { to: '/team', label: 'My Teams', icon: Users },
    { to: '/settings', label: 'Security & 2FA', icon: Settings },
  ];

  const getManagerNavItems = (): NavItem[] => [
    { to: '/', label: 'Manager Overview', icon: LayoutDashboard },
    { 
      to: '/approvals', 
      label: 'Review Queue', 
      icon: FileCheck, 
      badge: pendingApprovalDocuments.length > 0 ? `${pendingApprovalDocuments.length}` : undefined,
      badgeColor: 'bg-amber-500 text-slate-950 font-bold'
    },
    { to: '/documents', label: 'Department Vault', icon: FileText, badge: `${departmentDocuments.length}` },
    { to: '/upload', label: 'Upload Files', icon: UploadCloud },
    { to: '/sharing', label: 'Access & Sharing', icon: Share2 },
    { to: '/team', label: 'Team Workspace', icon: Users },
    { to: '/settings', label: 'Settings & Security', icon: Settings },
  ];

  const getAdminNavItems = (): NavItem[] => [
    { to: '/', label: 'Governance Console', icon: LayoutDashboard },
    { to: '/admin', label: 'Members & RBAC', icon: Users },
    { 
      to: '/approvals', 
      label: 'Approval Pipeline', 
      icon: FileCheck,
      badge: pendingApprovalDocuments.length > 0 ? `${pendingApprovalDocuments.length}` : undefined
    },
    { to: '/documents', label: 'Global Repository', icon: FileText, badge: `${documents.length}` },
    { to: '/upload', label: 'Vault Document', icon: UploadCloud },
    { to: '/sharing', label: 'Sharing Governance', icon: Share2 },
    { to: '/team', label: 'Teams', icon: Users },
    { to: '/settings', label: 'Security Settings', icon: Settings },
  ];

  const currentNavItems = role === 'admin' 
    ? getAdminNavItems() 
    : role === 'manager' 
    ? getManagerNavItems() 
    : getUserNavItems();

  const storagePercent = capacity.limit > 0 ? Math.min(100, Math.round((capacity.used / capacity.limit) * 100)) : 0;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header with Role Tag */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-md ${
              role === 'admin' 
                ? 'bg-amber-600 shadow-amber-600/30' 
                : role === 'manager'
                ? 'bg-emerald-600 shadow-emerald-600/30'
                : 'bg-indigo-600 shadow-indigo-600/30'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-white leading-tight">DocVault</span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
                {role === 'admin' ? 'TENANT ADMIN' : role === 'manager' ? 'MANAGER PORTAL' : 'USER WORKSPACE'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="p-4 pb-2">
          {role === 'manager' ? (
            <NavLink
              to="/approvals"
              onClick={() => setMobileOpen(false)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <FileCheck className="w-4 h-4" />
              <span>Review Queue ({pendingApprovalDocuments.length})</span>
            </NavLink>
          ) : role === 'admin' ? (
            <NavLink
              to="/admin"
              onClick={() => setMobileOpen(false)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-amber-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Users className="w-4 h-4" />
              <span>Manage Members & Roles</span>
            </NavLink>
          ) : (
            <NavLink
              to="/upload"
              onClick={() => setMobileOpen(false)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Vault New Document</span>
            </NavLink>
          )}
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>
              {role === 'admin' ? 'Governance Navigation' : role === 'manager' ? 'Operations & Oversight' : 'Personal Workspace'}
            </span>
            <span className="font-mono text-[9px] text-slate-400 uppercase">{role}</span>
          </div>

          {currentNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 ${
                    isActive 
                      ? role === 'admin' ? 'text-amber-400' : role === 'manager' ? 'text-emerald-400' : 'text-indigo-400'
                      : 'text-slate-400'
                  }`} />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    item.badgeColor || 'bg-slate-800 text-slate-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Storage Metric Widget */}
        <div className="p-4 mx-3 mb-2 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 text-slate-300">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium">
                {role === 'admin' ? 'Tenant Pool' : role === 'manager' ? 'Dept Capacity' : 'My Vault Storage'}
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-300 tabular-nums">
              {storagePercent}%
            </span>
          </div>

          <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                role === 'admin' 
                  ? 'bg-amber-500' 
                  : role === 'manager' 
                  ? 'bg-emerald-500' 
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${storagePercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 font-mono tabular-nums">
            <span>{formatBytes(capacity.used)}</span>
            <span>of {formatBytes(capacity.limit)}</span>
          </div>
        </div>

        {/* User Card & Sign Out */}
        <div className="p-3 border-t border-slate-800 flex items-center gap-3 bg-slate-900/90">
          <img
            src={currentUser.avatar || '/default-avatar.svg'}
            onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/default-avatar.svg'; }}
            alt={currentUser.name}
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-700 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{currentUser.name}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="capitalize font-medium text-slate-300">{currentUser.role}</span>
              <span>·</span>
              <span className="truncate">{currentUser.department.split(' ')[0]}</span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
};
