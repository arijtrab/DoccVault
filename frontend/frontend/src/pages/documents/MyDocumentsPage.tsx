import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  UploadCloud, 
  Trash2, 
  Download, 
  Eye, 
  Share2, 
  Star, 
  Lock, 
  Clock, 
  FileText, 
  ChevronDown, 
  ArrowUpDown, 
  CheckSquare, 
  Square,
  Shield,
  MoreVertical,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDocuments } from '../../context/DocumentContext';
import { formatBytes, formatDate, getSensitivityColor, getFileTypeBadge } from '../../utils/formatters';
import { DocumentCategory, SensitivityLevel, FileType, DocumentItem } from '../../types';

export const MyDocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { 
    filteredDocuments, 
    documents,
    trashedDocuments,
    searchQuery, 
    setSearchQuery, 
    selectedCategory, 
    setSelectedCategory,
    selectedSensitivity, 
    setSelectedSensitivity,
    selectedFileType, 
    setSelectedFileType,
    selectedTag,
    setSelectedTag,
    viewMode, 
    setViewMode,
    sortBy, 
    setSortBy,
    setPreviewDoc,
    setShareDoc,
    setAuditDoc,
    deleteDocument,
    batchDelete,
    restoreDocument,
    permanentlyDeleteDocument,
    toggleStar,
    downloadDocument,
    myDocuments,
    sharedWithMeDocuments,
    starredDocuments
  } = useDocuments();

  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'shared' | 'starred' | 'trash'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);

  if (!currentUser) return null;

  // Tab filtration
  const currentTabDocs = (activeTab === 'trash' ? trashedDocuments : filteredDocuments).filter((doc) => {
    if (activeTab === 'mine') return doc.ownerId === currentUser.id;
    if (activeTab === 'shared') return doc.sharedWith.some(s => s.email.toLowerCase() === currentUser.email.toLowerCase()) || !!doc.teamShares?.some(s => currentUser.teamIds?.includes(s.teamId) || s.teamId === currentUser.teamId);
    if (activeTab === 'starred') return doc.isStarred;
    if (activeTab === 'trash') return currentUser.role === 'admin' || doc.ownerId === currentUser.id;
    return true;
  });

  const categories: string[] = [
    'All',
    'Legal & Contracts',
    'Financial & Tax',
    'Security & Compliance',
    'Human Resources',
    'Engineering & Tech',
    'Operations'
  ];

  const sensitivities: string[] = ['All', 'Restricted', 'Confidential', 'Internal', 'Public'];
  const fileTypes: string[] = ['All', 'PDF', 'DOCX', 'XLSX', 'PPTX'];

  const handleSelectAll = () => {
    if (selectedIds.length === currentTabDocs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentTabDocs.map(d => d.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBatchDownload = () => {
    const selected = documents.filter(d => selectedIds.includes(d.id));
    selected.forEach(d => downloadDocument(d));
    setSelectedIds([]);
  };

  const handleBatchDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.length} document(s)?`)) {
      batchDelete(selectedIds);
      setSelectedIds([]);
    }
  };

  const canTrashSelection = activeTab !== 'trash' && selectedIds.length > 0 && selectedIds.every(id => documents.some(doc => doc.id === id && doc.ownerId === currentUser.id));

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Document Repository
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Browse, manage, and verify enterprise zero-trust document assets.
          </p>
        </div>

        <button
          onClick={() => navigate('/upload')}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Main Filter & Tabs Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Documents ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab('mine')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'mine'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              My Uploads ({myDocuments.length})
            </button>
            <button
              onClick={() => setActiveTab('shared')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'shared'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Shared with Me ({sharedWithMeDocuments.length})
            </button>
            <button
              onClick={() => setActiveTab('starred')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'starred'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Starred ({starredDocuments.length})
            </button>
            <button
              onClick={() => { setActiveTab('trash'); setSelectedIds([]); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeTab === 'trash' ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              Trash ({trashedDocuments.length})
            </button>
          </div>

          {/* View Mode & Sort toggles */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="size-desc">Size (Largest)</option>
              <option value="starred">Starred First</option>
            </select>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Dynamic Filter Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title, tag, hash..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Category */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            {categories.map((c) => (
              <option key={c} value={c}>Category: {c}</option>
            ))}
          </select>

          {/* Sensitivity */}
          <select
            value={selectedSensitivity}
            onChange={(e) => setSelectedSensitivity(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            {sensitivities.map((s) => (
              <option key={s} value={s}>Classification: {s}</option>
            ))}
          </select>

          {/* File Type */}
          <select
            value={selectedFileType}
            onChange={(e) => setSelectedFileType(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            {fileTypes.map((t) => (
              <option key={t} value={t}>Format: {t}</option>
            ))}
          </select>
        </div>

        {/* Batch Action Bar if items selected */}
        {selectedIds.length > 0 && activeTab !== 'trash' && (
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-medium">
              <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{selectedIds.length} item(s) selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchDownload}
                className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Selected</span>
              </button>
              {canTrashSelection && <button
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>}
              <button
                onClick={() => setSelectedIds([])}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document Listing: Empty State vs Cards/Table */}
      {currentTabDocs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            No Documents Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'All' || selectedSensitivity !== 'All'
              ? 'Try adjusting your search criteria or clearing active filters.'
              : 'Your encrypted vault has no documents in this tab yet.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {(searchQuery || selectedCategory !== 'All' || selectedSensitivity !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setSelectedSensitivity('All');
                  setSelectedFileType('All');
                }}
                className="px-3.5 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200"
              >
                Clear Filters
              </button>
            )}
            <button
              onClick={() => navigate('/upload')}
              className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
            >
              Upload Document
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        
        /* Grid Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentTabDocs.map((doc) => {
            const badge = getFileTypeBadge(doc.fileType);
            const sens = getSensitivityColor(doc.sensitivity);
            const isSelected = selectedIds.includes(doc.id);
            const permission = doc.sharedWith.find(item => item.email.toLowerCase() === currentUser.email.toLowerCase());
            const teamPermission = doc.teamShares?.find(item => currentUser.teamIds?.includes(item.teamId) || item.teamId === currentUser.teamId);
            const canRead = doc.canReadContent ?? (doc.ownerId === currentUser.id || !!permission || !!teamPermission || currentUser.role === 'manager' && doc.teamId === currentUser.teamId);
            const accessRole = permission?.role || teamPermission?.role;
            const canEdit = doc.ownerId === currentUser.id || accessRole === 'editor';
            const canDownload = doc.hasFileContent !== false && (doc.canDownload ?? (canRead && (doc.ownerId === currentUser.id || ['editor', 'reviewer'].includes(accessRole || '') || ['Public', 'Internal'].includes(doc.sensitivity))));

            return (
              <div
                key={doc.id}
                className={`bg-white dark:bg-slate-900 rounded-xl border transition-all p-5 flex flex-col justify-between group shadow-xs ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top card bar */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleSelect(doc.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleStar(doc.id)}
                        className="p-1 text-slate-400 hover:text-amber-500 transition-colors"
                        title={doc.isStarred ? 'Unstar' : 'Star'}
                      >
                        <Star className={`w-3.5 h-3.5 ${doc.isStarred ? 'text-amber-500 fill-amber-500' : ''}`} />
                      </button>
                      <button
                        onClick={() => setAuditDoc(doc)}
                        className="p-1 text-slate-400 hover:text-indigo-500 transition-colors"
                        title="Audit Logs"
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Document Title & Description */}
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 text-left line-clamp-2 leading-snug"
                  >
                    {doc.title}
                  </button>

                  {doc.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {doc.description}
                    </p>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {doc.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Meta & Action strip */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${sens.bg} ${sens.text}`}>
                      {doc.sensitivity}
                    </span>
                    {doc.approvalStatus === 'pending_review' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        In Review
                      </span>
                    )}
                    {doc.approvalStatus === 'pending_manager_seal' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                        Awaiting Manager Seal
                      </span>
                    )}
                    {doc.approvalStatus === 'rejected' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                        Rejected
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {formatBytes(doc.fileSizeBytes)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {activeTab !== 'trash' && doc.ownerId === currentUser.id && <button
                      onClick={() => setShareDoc(doc)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                      title="Share"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>}
                    {activeTab !== 'trash' && canDownload && <button
                      onClick={() => downloadDocument(doc)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>}
                    {activeTab === 'trash' ? (
                      <>
                        {doc.ownerId === currentUser.id && <button onClick={() => void restoreDocument(doc.id)} className="px-2 py-1 text-xs rounded bg-emerald-600 text-white">Restore</button>}
                        {currentUser.role === 'admin' && <button onClick={() => { if (confirm(`Permanently delete ${doc.title}?`)) void permanentlyDeleteDocument(doc.id); }} className="px-2 py-1 text-xs rounded bg-rose-600 text-white">Delete forever</button>}
                      </>
                    ) : doc.ownerId === currentUser.id && <button
                      onClick={() => {
                        if (confirm(`Delete "${doc.title}" from vault?`)) {
                          deleteDocument(doc.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        
        /* Table View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3 pl-4 w-10">
                    <button
                      onClick={handleSelectAll}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {selectedIds.length === currentTabDocs.length && currentTabDocs.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-3">Document Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Sensitivity</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">Modified</th>
                  <th className="p-3 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {currentTabDocs.map((doc) => {
                  const badge = getFileTypeBadge(doc.fileType);
                  const sens = getSensitivityColor(doc.sensitivity);
                  const isSelected = selectedIds.includes(doc.id);
                  const permission = doc.sharedWith.find(item => item.email.toLowerCase() === currentUser.email.toLowerCase());
                  const teamPermission = doc.teamShares?.find(item => currentUser.teamIds?.includes(item.teamId) || item.teamId === currentUser.teamId);
                  const canRead = doc.canReadContent ?? (doc.ownerId === currentUser.id || !!permission || !!teamPermission || currentUser.role === 'manager' && doc.teamId === currentUser.teamId);
                  const accessRole = permission?.role || teamPermission?.role;
                  const canEdit = doc.ownerId === currentUser.id || accessRole === 'editor';
                  const canDownload = doc.hasFileContent !== false && (doc.canDownload ?? (canRead && (doc.ownerId === currentUser.id || ['editor', 'reviewer'].includes(accessRole || '') || ['Public', 'Internal'].includes(doc.sensitivity))));

                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <td className="p-3 pl-4">
                        <button
                          onClick={() => handleToggleSelect(doc.id)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded shrink-0 ${badge.color}`}>
                            {badge.label}
                          </span>
                          <div className="min-w-0">
                            <button
                              onClick={() => setPreviewDoc(doc)}
                              className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 truncate block text-left"
                            >
                              {doc.title}
                            </button>
                            <span className="text-[11px] text-slate-400 font-mono truncate block">
                              {doc.originalFileName}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">
                        {doc.category}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${sens.bg} ${sens.text}`}>
                          {doc.sensitivity}
                        </span>
                      </td>
                      <td className="p-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {formatBytes(doc.fileSizeBytes)}
                      </td>
                      <td className="p-3 text-slate-500">
                        {formatDate(doc.updatedAt)}
                      </td>
                      <td className="p-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {activeTab !== 'trash' && canEdit && <button
                            onClick={() => toggleStar(doc.id)}
                            className="p-1.5 text-slate-400 hover:text-amber-500 rounded transition-colors"
                            title="Star"
                          >
                            <Star className={`w-3.5 h-3.5 ${doc.isStarred ? 'text-amber-500 fill-amber-500' : ''}`} />
                          </button>}
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {activeTab !== 'trash' && doc.ownerId === currentUser.id && <button
                            onClick={() => setShareDoc(doc)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
                            title="Share"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>}
                          {activeTab !== 'trash' && canDownload && <button
                            onClick={() => downloadDocument(doc)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>}
                          {activeTab === 'trash' ? (
                            <>
                              {doc.ownerId === currentUser.id && <button onClick={() => void restoreDocument(doc.id)} className="rounded bg-emerald-600 px-2 py-1 text-white">Restore</button>}
                              {currentUser.role === 'admin' && <button onClick={() => { if (confirm(`Permanently delete ${doc.title}?`)) void permanentlyDeleteDocument(doc.id); }} className="rounded bg-rose-600 px-2 py-1 text-white">Delete forever</button>}
                            </>
                          ) : doc.ownerId === currentUser.id && <button
                            onClick={() => {
                              if (confirm(`Delete "${doc.title}"?`)) deleteDocument(doc.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
