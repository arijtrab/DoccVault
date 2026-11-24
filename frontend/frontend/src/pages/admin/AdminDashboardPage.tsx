import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Users, 
  FileText, 
  HardDrive, 
  ShieldCheck, 
  UserPlus, 
  Search, 
  Trash2, 
  Download, 
  Check, 
  Lock, 
  Clock, 
  Filter,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDocuments } from '../../context/DocumentContext';
import { formatBytes, formatDate, formatDateTime, getSensitivityColor } from '../../utils/formatters';
import { UserRole } from '../../types';

export const AdminDashboardPage: React.FC = () => {
  const { usersList, switchUser, addUser, deleteUser, updateUserRole, currentUser, refreshUsers } = useAuth();
  const { documents, auditLogs, addToast, refreshAuditLogs } = useDocuments();

  const [activeTab, setActiveTab] = useState<'users' | 'documents' | 'audit'>('users');
  const [userSearch, setUserSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('All');
  const [auditActorFilter, setAuditActorFilter] = useState('All');

  // Invite user modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserDept, setNewUserDept] = useState('Engineering & Systems');
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');

  if (!currentUser) return null;

  const totalOrgStorage = usersList.reduce((acc, u) => acc + u.storageUsedBytes, 0);

  const filteredUsers = usersList.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.department.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredLogs = auditLogs.filter((log) => {
    if (auditActionFilter !== 'All' && log.action !== auditActionFilter) return false;
    if (auditActorFilter !== 'All' && log.actorName !== auditActorFilter) return false;
    return true;
  });

  const handleInviteUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;

    await addUser({
      name: newUserName || newUserEmail.split('@')[0],
      email: newUserEmail,
      department: newUserDept,
      role: newUserRole,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      twoFactorEnabled: false,
      storageLimitBytes: 50 * 1024 * 1024 * 1024,
      status: 'active',
    });

    addToast('success', 'User Invited', `${newUserEmail} added to tenant roster with ${newUserRole} role.`);
    setShowInviteModal(false);
    setNewUserName('');
    setNewUserEmail('');
  };

  const exportAuditLogsCSV = () => {
    const headers = ['ID', 'Timestamp', 'Action', 'Actor Name', 'Actor Email', 'IP Address'];
    const rows = filteredLogs.map((log) => [
      log.id,
      log.timestamp,
      log.action,
      `"${log.actorName}"`,
      log.actorEmail,
      log.ipAddress,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DocVault_AuditLogs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Audit Exported', 'CSV audit trail generated and downloaded.');
  };

  const exportAuditLogsJSON = () => {
    const jsonContent = JSON.stringify(filteredLogs.map(({ details: _details, ...entry }) => entry), null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DocVault_AuditLogs_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Audit Exported', 'JSON audit trail generated and downloaded.');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>ENTERPRISE GOVERNANCE & AUDIT</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Tenant Admin Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Global access controls, member roles, security compliance, and immutable activity verification.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Organization Member</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Members</span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {usersList.length}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {usersList.filter(u => u.status === 'active').length} active, 0 compromised
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Storage Pool Allocated</span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {formatBytes(totalOrgStorage)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Across {documents.length} verified documents
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Recorded Audit Events</span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {auditLogs.length}
          </div>
          <div className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
            Activity history available
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Compliance Attestation</span>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            PASSED
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            SOC 2 Type II / HIPAA / GDPR
          </div>
        </div>
      </div>

      {/* Main Admin Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members & Roles ({usersList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'documents'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Global Document Governance ({documents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>System Audit Logs ({auditLogs.length})</span>
          </button>
        </div>

        {/* Tab 1: Users & Roles */}
        {activeTab === 'users' && (
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search members..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <span className="text-[11px] text-slate-400">
                You can change roles in-line or switch active simulated user
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3 pl-4">Member</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Role (RBAC)</th>
                    <th className="p-3">2FA Status</th>
                    <th className="p-3">Storage Used</th>
                    <th className="p-3">Last Active</th>
                    <th className="p-3 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.avatar || '/default-avatar.svg'}
                            onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/default-avatar.svg'; }}
                            alt={user.name}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                          />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{user.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">
                        {user.department}
                      </td>
                      <td className="p-3">
                        <select
                          value={user.role}
                          onChange={async (e) => {
                            const nextRole = e.target.value as UserRole;
                            try {
                              await updateUserRole(user.id, nextRole);
                              addToast('success', 'Role Updated', `Changed ${user.name} role to ${nextRole}.`);
                            } catch (error) {
                              addToast('error', 'Role Update Failed', error instanceof Error ? error.message : undefined);
                            }
                          }}
                          className="px-2 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 capitalize"
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="user">User</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          Not configured
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                        {formatBytes(user.storageUsedBytes)}
                      </td>
                      <td className="p-3 text-slate-500">
                        {user.lastActive}
                      </td>
                      <td className="p-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {user.id !== currentUser.id && (
                            <button
                              onClick={() => {
                                switchUser(user.id);
                                addToast('info', 'Active User Switched', `Switched session to ${user.name} (${user.role}).`);
                              }}
                              className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded"
                            >
                              Impersonate
                            </button>
                          )}
                          {user.id !== currentUser.id && (
                            <button
                              onClick={async () => {
                                if (confirm(`Remove ${user.name} from organization?`)) {
                                  await deleteUser(user.id);
                                  addToast('warning', 'Member Removed', `${user.name} account terminated.`);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="Delete Member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Document Governance */}
        {activeTab === 'documents' && (
          <div className="pt-4 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="text-[11px] text-slate-400 block mb-1">Restricted Assets</span>
                <span className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">
                  {documents.filter(d => d.sensitivity === 'Restricted').length}
                </span>
                <span className="block text-[10px] text-slate-400 mt-1">Requires dual-key approval</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="text-[11px] text-slate-400 block mb-1">Confidential Assets</span>
                <span className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                  {documents.filter(d => d.sensitivity === 'Confidential').length}
                </span>
                <span className="block text-[10px] text-slate-400 mt-1">Encrypted tenant stores</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="text-[11px] text-slate-400 block mb-1">Internal Assets</span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">
                  {documents.filter(d => d.sensitivity === 'Internal').length}
                </span>
                <span className="block text-[10px] text-slate-400 mt-1">Organization members</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <span className="text-[11px] text-slate-400 block mb-1">Shared Outside Org</span>
                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                  {documents.filter(d => !!d.publicShareLink).length}
                </span>
                <span className="block text-[10px] text-slate-400 mt-1">Watermark enforced</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold text-[10px] uppercase">
                  <tr>
                    <th className="p-3 pl-4">Title</th>
                    <th className="p-3">Classification</th>
                    <th className="p-3">Custodian</th>
                    <th className="p-3">Last Modified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {documents.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 pl-4 font-medium text-slate-900 dark:text-slate-100">{d.title}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {d.sensitivity}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{d.ownerName}</td>
                      <td className="p-3 text-slate-400">{formatDate(d.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: System Audit Logs */}
        {activeTab === 'audit' && (
          <div className="pt-4 space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                >
                  <option value="All">All Actions</option>
                  <option value="Created">Created</option>
                  <option value="Viewed">Viewed</option>
                  <option value="Downloaded">Downloaded</option>
                  <option value="Shared">Shared</option>
                  <option value="Permission Changed">Permission Changed</option>
                  <option value="Metadata Updated">Metadata Updated</option>
                  <option value="Deleted">Deleted</option>
                </select>

                <select
                  value={auditActorFilter}
                  onChange={(e) => setAuditActorFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                >
                  <option value="All">All Actors</option>
                  {Array.from(new Set(auditLogs.map((l) => l.actorName))).map((actor) => (
                    <option key={actor} value={actor}>{actor}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportAuditLogsCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={exportAuditLogsJSON}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold text-[10px] uppercase">
                  <tr>
                    <th className="p-3 pl-4">Timestamp</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 pl-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                        {log.action}
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        <div className="font-medium">{log.actorName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{log.actorEmail}</div>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {log.ipAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                Invite New Enterprise Member
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteUserSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Jordan Hayes"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Corporate Email
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="jordan.hayes@docvault.internal"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <select
                  value={newUserDept}
                  onChange={(e) => setNewUserDept(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="Executive Operations">Executive Operations</option>
                  <option value="Engineering & Systems">Engineering & Systems</option>
                  <option value="Legal & Compliance">Legal & Compliance</option>
                  <option value="Finance & Tax">Finance & Tax</option>
                  <option value="Human Resources">Human Resources</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Initial Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="user">User (Standard Document Vault)</option>
                  <option value="manager">Manager (Department Reviewer)</option>
                  <option value="admin">Admin (Full Tenant Authority)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
