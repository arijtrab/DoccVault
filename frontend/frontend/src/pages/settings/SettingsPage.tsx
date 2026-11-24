import React, { useState } from 'react';
import { 
  User, 
  ShieldCheck, 
  Key, 
  Smartphone, 
  Laptop, 
  CheckCircle2, 
  AlertTriangle, 
  Lock,
  Mail,
  Building,
  Save
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDocuments } from '../../context/DocumentContext';

export const SettingsPage: React.FC = () => {
  const { currentUser, updateProfile } = useAuth();
  const { addToast } = useDocuments();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('security');

  // Form states
  const [name, setName] = useState(currentUser?.name || '');
  const email = currentUser?.email || '';

  if (!currentUser) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({ name });
    addToast('success', 'Profile Updated', 'Your name has been saved. Team membership is managed by an administrator.');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          Account & Security Center
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your account, active sessions, and notification preferences.
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Account Security</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile & Department</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'preferences'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Audit Preferences</span>
          </button>
        </div>

        {/* Tab 1: Account Security */}
        {activeTab === 'security' && (
          <div className="pt-4 space-y-6 text-xs">
            
            {/* 2FA Section */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    Two-Factor Authentication (2FA)
                  </h3>
                </div>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  Multi-factor authentication is not configured yet and is intentionally unavailable in this release.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                    NOT CONFIGURED
                  </span>
                </div>
              </div>

              <span className="px-3.5 py-2 text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg">Not available in this release</span>
            </div>

            {/* Active Sessions */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                Active Client Sessions
              </h3>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Laptop className="w-4 h-4 text-emerald-500" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        Current browser session
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Session expiration is managed by the server.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-medium">This Device</span>
                </div>

                <p className="py-2.5 text-[11px] text-slate-500">Remote session inventory and individual revocation are not available yet.</p>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Profile */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="pt-4 space-y-4 text-xs">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <img
                src={currentUser.avatar || '/default-avatar.svg'}
                onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/default-avatar.svg'; }}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover ring-2 ring-indigo-500"
              />
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{currentUser.name}</p>
                <p className="text-slate-500 dark:text-slate-400">{currentUser.email}</p>
                <span className="capitalize mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                  Role: {currentUser.role}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={currentUser.department}
                  disabled
                  className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Enterprise Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 cursor-not-allowed font-mono"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-sm transition-colors text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Preferences */}
        {activeTab === 'preferences' && (
          <div className="pt-4 space-y-4 text-xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Document Access Notifications</p>
                  <p className="text-slate-500 text-[11px]">Receive a notification when someone accesses a shared document</p>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 text-indigo-600 rounded" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Storage Quota Alert</p>
                  <p className="text-slate-500 text-[11px]">Notify when storage usage exceeds 85% of allocated capacity</p>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 text-indigo-600 rounded" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Weekly Account Activity Summary</p>
                  <p className="text-slate-500 text-[11px]">Receive a weekly summary of account activity</p>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 text-indigo-600 rounded" />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
