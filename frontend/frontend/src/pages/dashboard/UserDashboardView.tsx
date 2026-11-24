import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  ShieldCheck, 
  HardDrive, 
  Share2, 
  UploadCloud, 
  Lock, 
  ArrowUpRight, 
  Clock, 
  Star, 
  ChevronRight,
  Eye,
  Download,
  KeyRound,
  Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDocuments } from '../../context/DocumentContext';
import { formatBytes, formatDate, getSensitivityColor, getFileTypeBadge } from '../../utils/formatters';

export const UserDashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { 
    documents, 
    myDocuments, 
    sharedWithMeDocuments, 
    sharedByMeDocuments, 
    starredDocuments,
    auditLogs, 
    setPreviewDoc, 
    setShareDoc, 
    downloadDocument, 
    toggleStar,
    setSelectedCategory
  } = useDocuments();

  if (!currentUser) return null;

  const storagePercent = Math.min(
    100,
    Math.round((currentUser.storageUsedBytes / currentUser.storageLimitBytes) * 100)
  );

  const myRecentDocs = [...myDocuments]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const myAuditLogs = auditLogs
    .filter((l) => l.actorEmail.toLowerCase() === currentUser.email.toLowerCase() || myDocuments.some(d => d.id === l.documentId))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>PERSONAL ENCRYPTED REPOSITORY</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Welcome back, {currentUser.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {myDocuments.length} files currently stored in your personal workspace.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => navigate('/upload')}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Vault New Document</span>
          </button>
          <button
            onClick={() => navigate('/documents')}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <span>My Documents</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Personal Docs */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">My Stored Files</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {myDocuments.length}
            </span>
            <span className="text-xs text-slate-500">documents</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2">
            <span>{starredDocuments.length} starred</span>
            <span>·</span>
            <span>{sharedByMeDocuments.length} shared out</span>
          </div>
        </div>

        {/* Personal Storage Quota */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Storage Utilized</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {formatBytes(currentUser.storageUsedBytes)}
            </span>
            <span className="text-xs text-slate-400">of {formatBytes(currentUser.storageLimitBytes)}</span>
          </div>
          <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                storagePercent > 80 ? 'bg-amber-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
        </div>

        {/* Files Shared with Me */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Shared with Me</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {sharedWithMeDocuments.length}
            </span>
            <span className="text-xs text-slate-500">colleague files</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            <span>Direct access granted by colleagues</span>
          </div>
        </div>

        {/* Security / 2FA status */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Security Posture</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              ACCOUNT PROTECTED
            </span>
          </div>
        </div>

      </div>

      {/* Main Grid: My Recent Files & Personal Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 spans): My Recent Documents */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  My Recent Vaulted Documents
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Files uploaded and maintained by your account
                </p>
              </div>
              <button
                onClick={() => navigate('/documents')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>View all files</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {myRecentDocs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No documents uploaded to your personal vault yet.</p>
                <button
                  onClick={() => navigate('/upload')}
                  className="mt-3 px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                >
                  Upload First File
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myRecentDocs.map((doc) => {
                  const badge = getFileTypeBadge(doc.fileType);
                  const sens = getSensitivityColor(doc.sensitivity);

                  return (
                    <div
                      key={doc.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`px-2 py-1 text-[10px] font-mono font-semibold rounded shrink-0 ${badge.color}`}>
                          {badge.label}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPreviewDoc(doc)}
                              className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 truncate hover:text-indigo-600 dark:hover:text-indigo-400 text-left"
                            >
                              {doc.title}
                            </button>
                            {doc.isStarred && (
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            <span>{doc.category}</span>
                            <span>·</span>
                            <span className="font-mono tabular-nums">{formatBytes(doc.fileSizeBytes)}</span>
                            <span>·</span>
                            <span>{formatDate(doc.updatedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`hidden sm:inline px-2 py-0.5 text-[10px] font-semibold rounded ${sens.bg} ${sens.text}`}>
                          {doc.sensitivity}
                        </span>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Preview Document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShareDoc(doc)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Share"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadDocument(doc)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Incoming Documents Shared With Me */}
          {sharedWithMeDocuments.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Shared with You
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Documents delegated to you by colleagues
                  </p>
                </div>
                <button
                  onClick={() => navigate('/sharing')}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Manage Access &rarr;
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {sharedWithMeDocuments.slice(0, 3).map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{doc.title}</p>
                      <p className="text-[11px] text-slate-400">Shared by {doc.ownerName} · {formatBytes(doc.fileSizeBytes)}</p>
                    </div>
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg shrink-0 font-medium"
                    >
                      Inspect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Personal Security & Activity */}
        <div className="space-y-6">
          
          {/* Quick Actions Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Personal Vault Actions
            </h2>
            <div className="space-y-2 text-xs">
              <button
                onClick={() => navigate('/upload')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700/80 transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <UploadCloud className="w-4 h-4 text-indigo-500" />
                  <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">
                    Upload & Envelope Encrypt
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => navigate('/sharing')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700/80 transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <Share2 className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">
                    Create Secure Share Link
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => navigate('/settings')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700/80 transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-4 h-4 text-purple-500" />
                  <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">
                    Two-Factor & Security Keys
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Personal Activity History */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              My Activity Trail
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Recent activity associated with your account
            </p>

            <div className="space-y-4 text-xs">
              {myAuditLogs.length === 0 ? (
                <p className="text-slate-400 text-center py-4">No recent activity recorded.</p>
              ) : (
                myAuditLogs.map((log) => (
                  <div key={log.id} className="relative pl-4 border-l-2 border-indigo-500/40 space-y-0.5">
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-slate-900 dark:text-slate-100">{log.action}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
