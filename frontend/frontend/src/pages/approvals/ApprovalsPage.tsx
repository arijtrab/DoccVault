import React, { useEffect, useState } from 'react';
import { 
  FileCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  Download, 
  Search, 
  Filter, 
  ShieldCheck, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDocuments } from '../../context/DocumentContext';
import { formatBytes, formatDate, getSensitivityColor, getFileTypeBadge } from '../../utils/formatters';

export const ApprovalsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { 
    documents, 
    approveDocument, 
    sealDocument,
    rejectDocument, 
    setPreviewDoc, 
    downloadDocument,
    refreshDocuments,
    addToast
  } = useDocuments();

  const [filterTab, setFilterTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [selectedDocIdForAction, setSelectedDocIdForAction] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [teamMembers, setTeamMembers] = useState<Record<string, Array<{ id: string; name: string; email: string }>>>({});
  const [reviewerSelections, setReviewerSelections] = useState<Record<string, string>>({});
  const [assigningDocId, setAssigningDocId] = useState<string | null>(null);

  useEffect(() => {
    void refreshDocuments();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshDocuments();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshDocuments]);

  useEffect(() => {
    if (!currentUser || !['admin', 'manager'].includes(currentUser.role)) return;
    const teamIds = [...new Set(documents.filter(doc => doc.approvalStatus === 'pending_review' && doc.teamId).map(doc => doc.teamId!))];
    const token = localStorage.getItem('docvault_auth_token');
    for (const teamId of teamIds) {
      if (teamMembers[teamId]) continue;
      fetch(`/api/v1/admin/teams/${encodeURIComponent(teamId)}/members`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(async response => response.ok ? response.json() : [])
        .then((members) => setTeamMembers(previous => ({ ...previous, [teamId]: members })))
        .catch(() => setTeamMembers(previous => ({ ...previous, [teamId]: [] })));
    }
  }, [documents, currentUser?.id, currentUser?.role, teamMembers]);

  const assignReviewer = async (docId: string) => {
    const email = reviewerSelections[docId];
    if (!email) return;
    setAssigningDocId(docId);
    try {
      const token = localStorage.getItem('docvault_auth_token');
      const response = await fetch(`/api/v1/documents/${encodeURIComponent(docId)}/reviewers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not assign reviewer.');
      addToast('success', 'Reviewer Assigned', `${email} can now review this document.`);
      await refreshDocuments();
    } catch (error) {
      addToast('error', 'Assignment Failed', error instanceof Error ? error.message : 'Could not assign reviewer.');
    } finally {
      setAssigningDocId(null);
    }
  };

  const visibleDocuments = documents.filter(d => {
    if (currentUser?.role === 'admin') return true;
    const reviewerAssigned = d.sharedWith.some(item => item.email.toLowerCase() === currentUser?.email.toLowerCase() && item.role === 'reviewer');
    if (currentUser?.role === 'user') return reviewerAssigned;
    return d.ownerId === currentUser?.id ||
      d.sharedWith.some(item => item.email.toLowerCase() === currentUser?.email.toLowerCase()) ||
      (currentUser?.role === 'manager' && (!!d.isTeamDocument || !!currentUser.teamIds?.includes(d.teamId || '') || !!currentUser.teamId && d.teamId === currentUser.teamId));
  });

  const filteredDocs = visibleDocuments.filter((d) => {
    if (filterTab === 'pending') {
      const managerView = currentUser?.role === 'manager' || currentUser?.role === 'admin';
      if (d.approvalStatus !== 'pending_review' && !(managerView && d.approvalStatus === 'pending_manager_seal')) return false;
    } else if (filterTab === 'approved') {
      if (d.approvalStatus !== 'approved') return false;
    } else if (filterTab === 'rejected') {
      if (d.approvalStatus !== 'rejected') return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        d.ownerName.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = visibleDocuments.filter((d) => d.approvalStatus === 'pending_review' ||
    ((currentUser?.role === 'admin' || currentUser?.role === 'manager') && d.approvalStatus === 'pending_manager_seal')).length;
  const approvedCount = visibleDocuments.filter((d) => d.approvalStatus === 'approved').length;
  const rejectedCount = visibleDocuments.filter((d) => d.approvalStatus === 'rejected').length;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>DOCUMENT CERTIFICATION PIPELINE</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Document Review & Approvals
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review submitted documents, assign reviewers, and record approval decisions.
          </p>
        </div>
      </div>

      {/* Main Filter Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterTab('pending')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                filterTab === 'pending'
                  ? 'bg-amber-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
            <span>Review / Seal Queue ({pendingCount})</span>
            </button>

            <button
              onClick={() => setFilterTab('approved')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                filterTab === 'approved'
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approved & Sealed ({approvedCount})</span>
            </button>

            <button
              onClick={() => setFilterTab('rejected')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                filterTab === 'rejected'
                  ? 'bg-rose-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Rejected ({rejectedCount})</span>
            </button>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search submissions..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Content list */}
        {filteredDocs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <FileCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-slate-800 dark:text-slate-200">No documents in this view</p>
            <p className="text-slate-500 mt-1">There are no submissions matching your current filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredDocs.map((doc) => {
              const badge = getFileTypeBadge(doc.fileType);
              const sens = getSensitivityColor(doc.sensitivity);
              const designatedReviewer = doc.sharedWith.some(item => item.email.toLowerCase() === currentUser?.email.toLowerCase() && item.role === 'reviewer');
              const canAssignReviewer = doc.approvalStatus === 'pending_review' && !!doc.teamId && (currentUser?.role === 'admin' || (currentUser?.role === 'manager' && (currentUser.teamIds?.includes(doc.teamId) || currentUser.teamId === doc.teamId)));
              const canSeal = doc.approvalStatus === 'pending_manager_seal' && !!doc.teamId && (currentUser?.role === 'admin' || (currentUser?.role === 'manager' && (currentUser.teamIds?.includes(doc.teamId) || currentUser.teamId === doc.teamId)));
              const canDownload = doc.ownerId === currentUser?.id ||
                doc.sharedWith.some(item => item.email.toLowerCase() === currentUser?.email.toLowerCase() && ['editor', 'reviewer'].includes(item.role)) ||
                ['Public', 'Internal'].includes(doc.sensitivity);

              return (
                <div key={doc.id} className="py-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>Submitter: {doc.ownerName}</span>
                          <span>·</span>
                          <span>{doc.category}</span>
                          <span>·</span>
                          <span className="font-mono tabular-nums">{formatBytes(doc.fileSizeBytes)}</span>
                          <span>·</span>
                          <span>{formatDate(doc.updatedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${sens.bg} ${sens.text}`}>
                        {doc.sensitivity}
                      </span>

                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {canDownload && <button
                        onClick={() => downloadDocument(doc)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>}

                      {filterTab === 'pending' && doc.approvalStatus === 'pending_review' && (
                        <>
                          {canAssignReviewer && <div className="flex items-center gap-1">
                            <select value={reviewerSelections[doc.id] || ''}
                              onChange={event => setReviewerSelections(previous => ({ ...previous, [doc.id]: event.target.value }))}
                              className="max-w-40 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
                              <option value="">Assign reviewer…</option>
                              {(teamMembers[doc.teamId!] || []).filter(member => member.id !== doc.ownerId).map(member => (
                                <option key={member.id} value={member.email}>{member.name}</option>
                              ))}
                            </select>
                            <button disabled={!reviewerSelections[doc.id] || assigningDocId === doc.id}
                              onClick={() => void assignReviewer(doc.id)}
                              className="rounded-lg bg-indigo-600 px-2 py-1.5 text-xs text-white disabled:opacity-50">Assign</button>
                          </div>}
                          {designatedReviewer && doc.ownerId !== currentUser?.id && <button
                            onClick={() => {
                              const reason = prompt('Specify rejection feedback for the team member:', 'Needs revised clause 4.2 compliance');
                              if (reason) rejectDocument(doc.id, reason);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold rounded-lg transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>}

                          {designatedReviewer && doc.ownerId !== currentUser?.id && <button
                            onClick={() => approveDocument(doc.id, 'Verified and approved by department manager')}
                            className="flex items-center gap-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve Review</span>
                          </button>}
                        </>
                      )}
                      {filterTab === 'pending' && canSeal && <>
                        <button
                          onClick={() => {
                            const reason = prompt('Specify why this document is not being sealed:', 'Requires changes before certification');
                            if (reason) void rejectDocument(doc.id, reason);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold rounded-lg transition-colors"
                        ><XCircle className="w-3.5 h-3.5" /><span>Reject</span></button>
                        <button onClick={() => void sealDocument(doc.id)} className="flex items-center gap-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all">
                          <CheckCircle2 className="w-3.5 h-3.5" /><span>Seal & Certify</span>
                        </button>
                      </>}
                    </div>
                  </div>

                  {doc.reviewerNotes && (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 shrink-0">Reviewer Note:</span>
                      <span className="truncate">{doc.reviewerNotes}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
