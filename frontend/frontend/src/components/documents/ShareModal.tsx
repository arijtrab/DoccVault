import React, { useState } from 'react';
import { 
  X, 
  Link2, 
  Lock, 
  Key, 
  Eye, 
  Download, 
  Calendar, 
  Copy, 
  Check, 
  UserPlus, 
  Trash2, 
  ShieldCheck, 
  Clock 
} from 'lucide-react';
import { useDocuments } from '../../context/DocumentContext';
import { formatDate } from '../../utils/formatters';

export const ShareModal: React.FC = () => {
  const { shareDoc, setShareDoc, generateShareLink, revokeShareLink, addCollaborator, removeCollaborator, addToast } = useDocuments();
  const [activeTab, setActiveTab] = useState<'link' | 'users'>('link');

  // Public link form state
  const [allowDownload, setAllowDownload] = useState(shareDoc?.publicShareLink?.allowDownload ?? true);
  const [passwordProtected, setPasswordProtected] = useState(shareDoc?.publicShareLink?.passwordProtected ?? false);
  const [password, setPassword] = useState(shareDoc?.publicShareLink?.password ?? '');
  const [watermark, setWatermark] = useState(shareDoc?.publicShareLink?.watermark ?? false);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [copiedLink, setCopiedLink] = useState(false);

  // Direct user invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');

  if (!shareDoc) return null;

  const currentLink = shareDoc.publicShareLink?.url || '';

  const handleCreateOrUpdateLink = () => {
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + expiresInDays);

    generateShareLink(shareDoc.id, {
      url: currentLink,
      allowDownload,
      passwordProtected,
      password: passwordProtected ? password : undefined,
      watermark,
      expiresAt: expireDate.toISOString(),
    });
  };

  const handleCopyLink = () => {
    if (!currentLink) return;
    navigator.clipboard.writeText(currentLink);
    setCopiedLink(true);
    addToast('success', 'Link Copied', 'Encrypted access link copied to clipboard.');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    addCollaborator(shareDoc.id, {
      email: inviteEmail.trim(),
      role: inviteRole,
    });
    setInviteEmail('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
              Share Document & Permissions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-sm">
              {shareDoc.title}
            </p>
          </div>
          <button
            onClick={() => setShareDoc(null)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 pt-2">
          <button
            onClick={() => setActiveTab('link')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'link'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Public Secure Link
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Direct Collaborators</span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.2 rounded-full font-mono">
              {shareDoc.sharedWith.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Secure Link */}
        {activeTab === 'link' && (
          <div className="p-4 sm:p-6 space-y-5 text-xs">
            {/* Link Box */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Shareable Link
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-mono text-xs overflow-hidden">
                  <Link2 className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
                  <span className="truncate">{currentLink}</span>
                </div>
                <button
                  onClick={handleCopyLink}
                  disabled={!currentLink}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Security Controls */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Password Protection</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Require passphrase before decrypting payload</p>
                </div>
                <input
                  type="checkbox"
                  checked={passwordProtected}
                  onChange={(e) => setPasswordProtected(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              {passwordProtected && (
                <div className="pl-3 border-l-2 border-indigo-500 space-y-1">
                  <label className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">Access Passphrase</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter security passphrase"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Watermark Document</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Overlay recipient viewer timestamp on pages</p>
                </div>
                <input
                  type="checkbox"
                  checked={watermark}
                  onChange={(e) => setWatermark(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Allow Raw File Download</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">If disabled, viewers can only read within sandbox</p>
                </div>
                <input
                  type="checkbox"
                  checked={allowDownload}
                  onChange={(e) => setAllowDownload(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Link Expiration</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Automatic key invalidation after period</p>
                </div>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                >
                  <option value={1}>24 Hours</option>
                  <option value={7}>7 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                </select>
              </div>
            </div>

            {/* Link Footer Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {shareDoc.publicShareLink ? (
                <button
                  type="button"
                  onClick={() => revokeShareLink(shareDoc.id)}
                  className="text-rose-600 dark:text-rose-400 hover:underline font-medium text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Revoke Active Link</span>
                </button>
              ) : (
                <span className="text-slate-400 text-[11px]">No active link published yet</span>
              )}

              <button
                type="button"
                onClick={handleCreateOrUpdateLink}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
              >
                Save & Update Link
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Direct Users */}
        {activeTab === 'users' && (
          <div className="p-4 sm:p-6 space-y-4 text-xs">
            <form onSubmit={handleInviteUser} className="space-y-3">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Invite Collaborator by Email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@organization.com"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400"
                  required
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Invite</span>
                </button>
              </div>
            </form>

            {/* List of current collaborators */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Active Permissions
              </p>

              {shareDoc.sharedWith.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  <p>No collaborators currently assigned.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {shareDoc.sharedWith.map((user) => (
                    <div key={user.email} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{user.email}</p>
                        <p className="text-[10px] text-slate-400">Added {formatDate(user.addedAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="capitalize px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {user.role}
                        </span>
                        <button
                          onClick={() => removeCollaborator(shareDoc.id, user.email)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
                          title="Revoke access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShareDoc(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
