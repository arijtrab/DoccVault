import React, { useState } from 'react';
import { 
  Share2, 
  Users, 
  Link2, 
  Eye, 
  Download, 
  Trash2, 
  Lock, 
  Clock, 
  ExternalLink,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDocuments } from '../../context/DocumentContext';
import { formatDate, formatBytes, getFileTypeBadge } from '../../utils/formatters';

export const SharingPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { 
    documents, 
    sharedWithMeDocuments, 
    sharedByMeDocuments, 
    setPreviewDoc, 
    setShareDoc, 
    downloadDocument, 
    revokeShareLink,
    removeCollaborator 
  } = useDocuments();

  const [activeTab, setActiveTab] = useState<'with-me' | 'by-me' | 'links'>('with-me');

  const publicLinkDocs = documents.filter((d) => !!d.publicShareLink);

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Access & Sharing Governance
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Audit external links, collaborator access rights, and incoming enterprise files.
          </p>
        </div>

        <button
          onClick={() => {
            if (documents.length > 0) setShareDoc(documents[0]);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Share Permission</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('with-me')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'with-me'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Shared with Me ({sharedWithMeDocuments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('by-me')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'by-me'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Shared by Me ({sharedByMeDocuments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('links')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'links'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Active Public Links ({publicLinkDocs.length})</span>
          </button>
        </div>

        {/* Tab 1: Shared with Me */}
        {activeTab === 'with-me' && (
          <div className="pt-4">
            {sharedWithMeDocuments.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No documents have been shared directly with your account yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3 pl-4">Document Title</th>
                      <th className="p-3">Shared By</th>
                      <th className="p-3">Your Role</th>
                      <th className="p-3">Date Shared</th>
                      <th className="p-3">File Size</th>
                      <th className="p-3 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sharedWithMeDocuments.map((doc) => {
                      const userPerm = doc.sharedWith.find(
                        (s) => s.email.toLowerCase() === currentUser.email.toLowerCase()
                      );
                      const teamPerm = doc.teamShares?.find((share) => share.teamId === currentUser.teamId || currentUser.teamIds?.includes(share.teamId));
                      const badge = getFileTypeBadge(doc.fileType);

                      return (
                        <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 pl-4">
                            <div className="flex items-center gap-2.5">
                              <span className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded shrink-0 ${badge.color}`}>
                                {badge.label}
                              </span>
                              <button
                                onClick={() => setPreviewDoc(doc)}
                                className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 truncate text-left"
                              >
                                {doc.title}
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">
                            {doc.ownerName}
                          </td>
                          <td className="p-3">
                            <span className="capitalize px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                              {userPerm?.role || teamPerm?.role || 'viewer'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">
                            {userPerm ? formatDate(userPerm.addedAt) : 'Recent'}
                          </td>
                          <td className="p-3 font-mono text-slate-500 tabular-nums">
                            {formatBytes(doc.fileSizeBytes)}
                          </td>
                          <td className="p-3 text-right pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setPreviewDoc(doc)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                                title="Preview"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => downloadDocument(doc)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                                title="Download"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Shared by Me */}
        {activeTab === 'by-me' && (
          <div className="pt-4">
            {sharedByMeDocuments.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Share2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs">You have not shared any files with external users yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3 pl-4">Document Title</th>
                      <th className="p-3">Collaborators</th>
                      <th className="p-3">Public Link Status</th>
                      <th className="p-3">Last Modified</th>
                      <th className="p-3 text-right pr-4">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sharedByMeDocuments.map((doc) => {
                      const badge = getFileTypeBadge(doc.fileType);

                      return (
                        <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 pl-4">
                            <div className="flex items-center gap-2.5">
                              <span className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded shrink-0 ${badge.color}`}>
                                {badge.label}
                              </span>
                              <button
                                onClick={() => setPreviewDoc(doc)}
                                className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 truncate text-left"
                              >
                                {doc.title}
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">
                            {doc.sharedWith.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{doc.sharedWith.length} invited person(s)</span>
                                <span className="text-[11px] text-slate-400 truncate max-w-xs">
                                  {doc.sharedWith.map(s => s.email).join(', ')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">None directly</span>
                            )}
                          </td>
                          <td className="p-3">
                            {doc.publicShareLink ? (
                              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Active (Password: {doc.publicShareLink.passwordProtected ? 'Yes' : 'No'})</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">Disabled</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-500">
                            {formatDate(doc.updatedAt)}
                          </td>
                          <td className="p-3 text-right pr-4">
                            <button
                              onClick={() => setShareDoc(doc)}
                              className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg transition-colors text-xs"
                            >
                              Edit Access
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Active Public Links */}
        {activeTab === 'links' && (
          <div className="pt-4">
            {publicLinkDocs.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Link2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No active public share links found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {publicLinkDocs.map((doc) => {
                  const link = doc.publicShareLink!;
                  return (
                    <div
                      key={doc.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {doc.title}
                          </h3>
                          <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                            {link.url}
                          </p>
                        </div>
                        <button
                          onClick={() => revokeShareLink(doc.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                          title="Revoke link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="block text-slate-400 text-[10px]">Protection</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {link.passwordProtected ? 'Passphrase' : 'Open Link'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-400 text-[10px]">Expires</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {formatDate(link.expiresAt)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-slate-400 text-[10px]">Access Count</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {link.accessCount} views
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          onClick={() => setShareDoc(doc)}
                          className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium rounded-lg text-xs"
                        >
                          Configure Link
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
