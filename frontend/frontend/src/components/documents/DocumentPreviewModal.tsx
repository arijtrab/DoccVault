import React, { useEffect, useState } from 'react';
import { 
  X, 
  Download, 
  Share2, 
  Shield, 
  Lock, 
  FileText, 
  Clock, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Printer, 
  Info, 
  UserCheck
} from 'lucide-react';
import { useDocuments } from '../../context/DocumentContext';
import { useAuth } from '../../context/AuthContext';
import { formatBytes, formatDate, formatDateTime, getSensitivityColor, getFileTypeBadge } from '../../utils/formatters';

export const DocumentPreviewModal: React.FC = () => {
  const { previewDoc, setPreviewDoc, setShareDoc, downloadDocument, addToast } = useDocuments();
  const { currentUser } = useAuth();
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showMetaSidebar, setShowMetaSidebar] = useState(true);
  const [comments, setComments] = useState<Array<{ id: string; authorName: string; body: string; createdAt: string }>>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentError, setCommentError] = useState('');
  const [filePreview, setFilePreview] = useState<{ loading: boolean; url?: string; text?: string; error?: string }>({ loading: false });

  useEffect(() => {
    if (!previewDoc) return;
    if (previewDoc.canReadContent === false) {
      setFilePreview({ loading: false, error: 'You do not have permission to view this file.' });
      return;
    }
    if (previewDoc.hasFileContent === false) {
      setFilePreview({ loading: false, error: 'The original file is not stored for this document.' });
      return;
    }
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setFilePreview({ loading: true });
    const token = localStorage.getItem('docvault_auth_token');
    fetch(`/api/v1/documents/${encodeURIComponent(previewDoc.id)}/preview`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Could not load the original file.');
      }
      const blob = await response.blob();
      if (previewDoc.fileType === 'txt') setFilePreview({ loading: false, text: await blob.text() });
      else {
        objectUrl = URL.createObjectURL(blob);
        setFilePreview({ loading: false, url: objectUrl });
      }
    }).catch(error => {
      if (!controller.signal.aborted) setFilePreview({ loading: false, error: error instanceof Error ? error.message : 'Could not load the original file.' });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewDoc?.id]);

  useEffect(() => {
    if (!previewDoc || !currentUser) return;
    setComments([]);
    const permission = previewDoc.sharedWith.find(item => item.email.toLowerCase() === currentUser.email.toLowerCase());
    const teamPermission = previewDoc.teamShares?.find(item => currentUser.teamIds?.includes(item.teamId) || item.teamId === currentUser.teamId);
    const canRead = previewDoc.canReadContent ?? (previewDoc.ownerId === currentUser.id || !!permission || !!teamPermission ||
      (currentUser.role === 'manager' && !!currentUser.teamId && previewDoc.teamId === currentUser.teamId));
    if (!canRead) { setComments([]); return; }
    const token = localStorage.getItem('docvault_auth_token');
    fetch(`/api/v1/documents/${encodeURIComponent(previewDoc.id)}/comments`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(async response => {
      if (!response.ok) throw new Error('Could not load comments.');
      setComments(await response.json());
    }).catch(() => setComments([]));
  }, [previewDoc?.id, currentUser?.id, currentUser?.email, currentUser?.role, currentUser?.teamId]);

  if (!previewDoc) return null;

  const currentPermission = previewDoc.sharedWith.find(item => item.email.toLowerCase() === currentUser?.email.toLowerCase());
  const teamPermission = previewDoc.teamShares?.find(item => !!currentUser?.teamIds?.includes(item.teamId) || item.teamId === currentUser?.teamId);
  const canReadContent = previewDoc.canReadContent ?? (previewDoc.ownerId === currentUser?.id || !!currentPermission || !!teamPermission ||
    (currentUser?.role === 'manager' && !!currentUser.teamId && previewDoc.teamId === currentUser.teamId));
  const canDownload = previewDoc.canDownload ?? (canReadContent && (previewDoc.ownerId === currentUser?.id ||
    ['editor', 'reviewer'].includes(currentPermission?.role || teamPermission?.role || '') || ['Public', 'Internal'].includes(previewDoc.sensitivity)));

  const sensitivityStyle = getSensitivityColor(previewDoc.sensitivity);
  const fileBadge = getFileTypeBadge(previewDoc.fileType);

  const handlePrint = () => {
    window.print();
  };

  const handleAddComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!previewDoc || !commentDraft.trim()) return;
    const token = localStorage.getItem('docvault_auth_token');
    try {
      const response = await fetch(`/api/v1/documents/${encodeURIComponent(previewDoc.id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ body: commentDraft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not add comment.');
      setComments(previous => [...previous, result]);
      setCommentDraft('');
      setCommentError('');
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : 'Could not add comment.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* Top Control Bar */}
        <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded ${fileBadge.color}`}>
              {fileBadge.label}
            </span>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {previewDoc.title}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>{previewDoc.originalFileName}</span>
                <span>·</span>
                <span className="font-mono tabular-nums">{formatBytes(previewDoc.fileSizeBytes)}</span>
              </div>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden sm:flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setZoomLevel((prev) => Math.max(75, prev - 25))}
                className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1.5 text-slate-600 dark:text-slate-300 tabular-nums">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel((prev) => Math.min(200, prev + 25))}
                className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {previewDoc.ownerId === currentUser?.id && <button
              onClick={() => setShareDoc(previewDoc)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>}

            {canDownload && previewDoc.hasFileContent !== false && <button
              onClick={() => downloadDocument(previewDoc)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>}

            <button
              onClick={() => setShowMetaSidebar(!showMetaSidebar)}
              className={`p-2 rounded-lg border transition-colors ${
                showMetaSidebar 
                  ? 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100' 
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
              title="Toggle Security Metadata"
            >
              <Info className="w-4 h-4" />
            </button>

            <button
              onClick={() => setPreviewDoc(null)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors ml-1"
              aria-label="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal body: document preview and access information */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Main Document Viewer Canvas */}
          <div className="flex-1 bg-slate-100/80 dark:bg-slate-950 p-4 sm:p-8 overflow-auto flex justify-center items-start">
            <div
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 transition-transform duration-150 relative min-h-[580px]"
            >
              {/* Optional Confidential Watermark */}
              {previewDoc.sensitivity === 'Restricted' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-5">
                  <span className="text-8xl font-black uppercase tracking-widest text-slate-900 rotate-[-35deg] select-none">
                    RESTRICTED
                  </span>
                </div>
              )}

              {/* Document Header */}
              <div className="border-b border-slate-200 dark:border-slate-800 pb-6 mb-6">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-400">
                      DocVault Encrypted Record
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded border ${sensitivityStyle.bg} ${sensitivityStyle.text} ${sensitivityStyle.border}`}>
                    {previewDoc.sensitivity}
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {previewDoc.title}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Category: {previewDoc.category} · Version {previewDoc.version}.0 · Created by {previewDoc.ownerName}
                </p>
              </div>

              {/* Document Body Sample */}
              <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
                {filePreview.loading ? <p className="py-12 text-center text-slate-500">Loading encrypted file…</p>
                : filePreview.error ? (
                  <div className="py-12 text-center text-rose-600 dark:text-rose-300">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-60" />
                    <p className="font-medium">Original file unavailable</p>
                    <p className="mt-1 text-xs">{filePreview.error}</p>
                    {previewDoc.textContentSample && <pre className="mx-auto mt-5 max-h-64 max-w-2xl overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-left font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">{previewDoc.textContentSample}</pre>}
                  </div>
                ) : previewDoc.fileType === 'pdf' && filePreview.url ? (
                  <iframe title={previewDoc.originalFileName} src={filePreview.url} className="h-[70vh] w-full rounded-lg border border-slate-200 dark:border-slate-700" />
                ) : ['png', 'jpg', 'jpeg'].includes(previewDoc.fileType) && filePreview.url ? (
                  <img src={filePreview.url} alt={previewDoc.originalFileName} className="mx-auto max-h-[70vh] max-w-full object-contain" />
                ) : previewDoc.fileType === 'txt' && filePreview.text !== undefined ? (
                  <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">{filePreview.text}</pre>
                ) : (
                  <div className="py-8 text-center text-slate-500">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="font-medium">Preview unavailable</p>
                    <p className="text-xs text-slate-400 mt-1">
                      This file type cannot be previewed in the browser. Download the original file to view it.
                    </p>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Security & Metadata Inspector Sidebar */}
          {showMetaSidebar && (
            <div className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 overflow-y-auto shrink-0 flex flex-col gap-5 text-xs">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm">
                  Document Details
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  File and access information
                </p>
              </div>

              {/* Core Details */}
              <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Classification</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sensitivityStyle.bg} ${sensitivityStyle.text}`}>
                    {previewDoc.sensitivity}
                  </span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Owner</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{previewDoc.ownerName}</span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">File Size</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">{formatBytes(previewDoc.fileSizeBytes)}</span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Created</span>
                  <span className="text-slate-800 dark:text-slate-200">{formatDate(previewDoc.createdAt)}</span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Last Modified</span>
                  <span className="text-slate-800 dark:text-slate-200">{formatDate(previewDoc.updatedAt)}</span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Version</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">v{previewDoc.version}.0</span>
                </div>
              </div>

              {/* Tags */}
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Document Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {previewDoc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {canReadContent && <section className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">Comments</h4>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {comments.map(comment => <article key={comment.id} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                    <p className="font-medium text-slate-700 dark:text-slate-200">{comment.authorName}</p>
                    <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{comment.body}</p>
                    <time className="text-[10px] text-slate-400">{formatDateTime(comment.createdAt)}</time>
                  </article>)}
                  {comments.length === 0 && <p className="text-slate-500">No comments yet.</p>}
                </div>
                <form onSubmit={handleAddComment} className="space-y-1.5">
                  <textarea value={commentDraft} onChange={event => setCommentDraft(event.target.value)} maxLength={4000}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    placeholder="Add a comment" rows={3} />
                  {commentError && <p className="text-rose-500">{commentError}</p>}
                  <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-50" disabled={!commentDraft.trim()}>Comment</button>
                </form>
              </section>}

              {/* Shared Access Count */}
              <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Collaborators</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{previewDoc.sharedWith.length}</span>
                </div>
                {previewDoc.publicShareLink && (
                  <div className="mt-2 p-2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                    <span>Public Link Active</span>
                    <span className="font-mono">{previewDoc.publicShareLink.accessCount} views</span>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
