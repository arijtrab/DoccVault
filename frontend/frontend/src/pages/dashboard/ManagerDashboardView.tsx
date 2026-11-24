import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileCheck, 
  Users, 
  HardDrive, 
  ShieldCheck, 
  Eye, 
  ArrowRight, 
  AlertCircle,
  FileText,
  ChevronRight,
  TrendingUp,
  Download
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDocuments } from '../../context/DocumentContext';
import { formatBytes, formatDate, getSensitivityColor, getFileTypeBadge } from '../../utils/formatters';

export const ManagerDashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, usersList } = useAuth();
  const { 
    documents, 
    departmentDocuments, 
    pendingApprovalDocuments, 
    sealDocument, 
    rejectDocument, 
    setPreviewDoc,
    downloadDocument,
    auditLogs
  } = useDocuments();

  if (!currentUser) return null;

  // Team members in the manager's department
  const teamMembers = usersList.filter(
    (u) => u.department.toLowerCase().includes(currentUser.department.split(' ')[0].toLowerCase())
  );

  const approvedDocsCount = departmentDocuments.filter(d => d.approvalStatus === 'approved').length;
  const deptStorageBytes = departmentDocuments.reduce((acc, d) => acc + d.fileSizeBytes, 0);

  const deptAuditLogs = auditLogs.slice(0, 5);

  return (
    <div className="space-y-6">
      
      {/* Top Welcome & Department Banner */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>DEPARTMENT OPERATIONS & OVERSIGHT</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            {currentUser.name} · {currentUser.department}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {pendingApprovalDocuments.length > 0
              ? `You have ${pendingApprovalDocuments.length} document(s) awaiting reviewer checks or your final seal.`
              : 'All department document submissions are up to date and verified.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => navigate('/approvals')}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <FileCheck className="w-4 h-4" />
            <span>Open Review Queue ({pendingApprovalDocuments.length})</span>
          </button>
          <button
            onClick={() => navigate('/documents')}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <span>Department Vault</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Pending Reviews */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Review & Seal Queue</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {pendingApprovalDocuments.length}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">requires signoff</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            <span>Average turnaround: &lt; 4 hours</span>
          </div>
        </div>

        {/* Approved Documents */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Approved & Certified</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {approvedDocsCount}
            </span>
            <span className="text-xs text-slate-500">certified</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span>Approval status is up to date</span>
          </div>
        </div>

        {/* Department Storage */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Department Storage</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {formatBytes(deptStorageBytes)}
            </span>
            <span className="text-xs text-slate-500">in pool</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            <span>Across {departmentDocuments.length} departmental records</span>
          </div>
        </div>

        {/* Department Team Members */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Department Team</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {teamMembers.length || 3}
            </span>
            <span className="text-xs text-slate-500">active engineers</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            <span>All accounts hardware 2FA certified</span>
          </div>
        </div>

      </div>

      {/* Main Review Section & Department Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 spans): Urgent Approval Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Documents Awaiting Review or Final Seal
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track reviewer checks and apply the final manager seal
                </p>
              </div>
              <button
                onClick={() => navigate('/approvals')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Full Review Center</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {pendingApprovalDocuments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-slate-800 dark:text-slate-200">Review Queue Cleared</p>
                <p className="text-slate-500 mt-1">No pending team submissions requiring signoff.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingApprovalDocuments.map((doc) => {
                  const badge = getFileTypeBadge(doc.fileType);
                  const sens = getSensitivityColor(doc.sensitivity);

                  return (
                    <div
                      key={doc.id}
                      className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`px-2 py-1 text-[10px] font-mono font-semibold rounded shrink-0 mt-0.5 ${badge.color}`}>
                          {badge.label}
                        </span>
                        <div className="min-w-0">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 text-left line-clamp-1"
                          >
                            {doc.title}
                          </button>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            <span>By: {doc.ownerName}</span>
                            <span>·</span>
                            <span>{doc.category}</span>
                            <span>·</span>
                            <span className="font-mono tabular-nums">{formatBytes(doc.fileSizeBytes)}</span>
                            <span>·</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${sens.bg} ${sens.text}`}>
                              {doc.sensitivity}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Approval Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Inspect Document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {doc.approvalStatus === 'pending_review' ? <span className="text-xs text-amber-700">Waiting for reviewer</span> : <>
                          <button
                            onClick={() => {
                              const reason = prompt('Please specify rejection reason for the author:', 'Requires updated security attestation');
                              if (reason) rejectDocument(doc.id, reason);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold rounded-lg transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                          <button
                            onClick={() => void sealDocument(doc.id)}
                            className="flex items-center gap-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Seal document</span>
                          </button>
                        </>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Department Documents Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Certified Department Documents
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Approved records active in {currentUser.department}
                </p>
              </div>
              <button
                onClick={() => navigate('/documents')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Browse All &rarr;
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {departmentDocuments.filter(d => d.approvalStatus === 'approved').slice(0, 4).map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{doc.title}</p>
                    <p className="text-[11px] text-slate-400">Author: {doc.ownerName} · Certified v{doc.version}.0</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                      title="Inspect"
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
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Department Roster & Activity */}
        <div className="space-y-6">
          
          {/* Department Team Members */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Department Roster
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Team members reporting to this workspace
            </p>

            <div className="space-y-3 text-xs">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={member.avatar || '/default-avatar.svg'}
                      onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/default-avatar.svg'; }}
                      alt={member.name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-300 dark:ring-slate-700"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{member.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono capitalize">{member.role}</p>
                    </div>
                  </div>

                  <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                    {formatBytes(member.storageUsedBytes)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Department Activity Feed */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Team Activity Stream
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Recent team activity
            </p>

            <div className="space-y-4 text-xs">
              {deptAuditLogs.map((log) => (
                <div key={log.id} className="relative pl-4 border-l-2 border-emerald-500/50 space-y-0.5">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-slate-900 dark:text-slate-100">{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">By {log.actorName}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
