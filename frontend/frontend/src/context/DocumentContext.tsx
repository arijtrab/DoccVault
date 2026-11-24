import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  DocumentItem, 
  DocumentCategory, 
  SensitivityLevel, 
  FileType, 
  DocumentAuditLog, 
  PublicShareLink, 
  SharePermission 
} from '../types';
import { useAuth } from './AuthContext';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message?: string;
}

interface DocumentContextType {
  documents: DocumentItem[];
  trashedDocuments: DocumentItem[];
  auditLogs: DocumentAuditLog[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  selectedSensitivity: string;
  setSelectedSensitivity: (sens: string) => void;
  selectedFileType: string;
  setSelectedFileType: (type: string) => void;
  selectedTag: string;
  setSelectedTag: (tag: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  sortBy: 'date-desc' | 'date-asc' | 'name-asc' | 'size-desc' | 'starred';
  setSortBy: (sort: 'date-desc' | 'date-asc' | 'name-asc' | 'size-desc' | 'starred') => void;
  
  // Modals & Selected
  previewDoc: DocumentItem | null;
  setPreviewDoc: (doc: DocumentItem | null) => void;
  shareDoc: DocumentItem | null;
  setShareDoc: (doc: DocumentItem | null) => void;
  auditDoc: DocumentItem | null;
  setAuditDoc: (doc: DocumentItem | null) => void;

  // Actions
  addDocument: (doc: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'sharedWith'> & { fileContentBase64?: string }) => Promise<DocumentItem>;
  updateDocument: (id: string, updates: Partial<DocumentItem>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  batchDelete: (ids: string[]) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
  generateShareLink: (documentId: string, settings: Omit<PublicShareLink, 'id' | 'createdAt' | 'accessCount'>) => Promise<void>;
  revokeShareLink: (documentId: string) => Promise<void>;
  addCollaborator: (documentId: string, collaborator: Omit<SharePermission, 'addedAt'>) => Promise<void>;
  removeCollaborator: (documentId: string, email: string) => Promise<void>;
  downloadDocument: (doc: DocumentItem) => Promise<void>;
  addAuditLog: (log: Omit<DocumentAuditLog, 'id' | 'timestamp'>) => Promise<void>;
  approveDocument: (id: string, notes?: string) => Promise<void>;
  sealDocument: (id: string) => Promise<void>;
  rejectDocument: (id: string, reason: string) => Promise<void>;
  refreshDocuments: () => Promise<void>;
  refreshAuditLogs: () => Promise<void>;
  restoreDocument: (id: string) => Promise<void>;
  permanentlyDeleteDocument: (id: string) => Promise<void>;

  // Toasts
  toasts: ToastMessage[];
  addToast: (type: 'success' | 'info' | 'warning' | 'error', title: string, message?: string) => void;
  removeToast: (id: string) => void;

  // Filtered list
  filteredDocuments: DocumentItem[];
  myDocuments: DocumentItem[];
  sharedWithMeDocuments: DocumentItem[];
  sharedByMeDocuments: DocumentItem[];
  starredDocuments: DocumentItem[];
  pendingApprovalDocuments: DocumentItem[];
  departmentDocuments: DocumentItem[];
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

const BASE_URL = '/api/v1';

function getToken() {
  return localStorage.getItem('docvault_auth_token');
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const activeUser = currentUser || {
    id: 'usr-1',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@docvault.internal',
    department: 'Executive Operations',
    role: 'admin' as const,
    teamId: undefined,
    teamIds: [] as string[],
  };

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [trashedDocuments, setTrashedDocuments] = useState<DocumentItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<DocumentAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSensitivity, setSelectedSensitivity] = useState<string>('All');
  const [selectedFileType, setSelectedFileType] = useState<string>('All');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name-asc' | 'size-desc' | 'starred'>('date-desc');

  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [shareDoc, setShareDoc] = useState<DocumentItem | null>(null);
  const [auditDoc, setAuditDoc] = useState<DocumentItem | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'info' | 'warning' | 'error', title: string, message?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => removeToast(id), 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch('/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      } else {
        setDocuments([]);
      }
    } catch {
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshTrash = useCallback(async () => {
    try {
      const response = await apiFetch('/documents/trash');
      if (!response.ok) throw new Error('Could not load trash.');
      setTrashedDocuments(await response.json());
    } catch {
      setTrashedDocuments([]);
    }
  }, []);

  const refreshAuditLogs = useCallback(async () => {
    try {
      const path = activeUser.role === 'admin' ? '/admin/audit-logs'
        : activeUser.role === 'manager' ? '/admin/team-audit' : '/admin/my-audit';
      const res = await apiFetch(path);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      } else setAuditLogs([]);
    } catch {
      setAuditLogs([]);
    }
  }, [activeUser.id, activeUser.role]);

  // Initial load
  useEffect(() => {
    refreshDocuments();
    refreshTrash();
    refreshAuditLogs();
  }, [currentUser, refreshDocuments, refreshTrash, refreshAuditLogs]);

  const addAuditLog = async (logData: Omit<DocumentAuditLog, 'id' | 'timestamp'>) => {
    const newLog: DocumentAuditLog = {
      ...logData,
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs(prev => [newLog, ...prev]);
    // Also persist to API
    try {
      await apiFetch(`/documents/${logData.documentId}/audit`, {
        method: 'POST',
        body: JSON.stringify({ action: logData.action, details: logData.details }),
      });
    } catch {}
  };

  const addDocument = async (docData: Omit<DocumentItem, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'sharedWith'> & { fileContentBase64?: string }): Promise<DocumentItem> => {
    const payload = {
      ...docData,
      ownerEmail: activeUser.email,
    };

    let newDoc: DocumentItem;

    try {
      const res = await apiFetch('/documents', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        newDoc = await res.json();
        setDocuments(prev => [newDoc, ...prev]);
      } else {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Document upload failed.');
      }
    } catch (error) {
      addToast('error', 'Upload Failed', error instanceof Error ? error.message : 'Could not store the file.');
      throw error;
    }

    addToast('success', 'Document Vaulted', `"${newDoc.title}" securely stored and encrypted.`);
    return newDoc;
  };

  const updateDocument = async (id: string, updates: Partial<DocumentItem>) => {
    const previous = documents.find(doc => doc.id === id);
    // Optimistic update
    setDocuments(prev =>
      prev.map(doc => doc.id === id ? { ...doc, ...updates, updatedAt: new Date().toISOString() } : doc)
    );

    try {
      const saveResponse = await apiFetch(`/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (!saveResponse.ok) throw new Error('Could not save document changes.');
      // Refresh to get server state
      const res = await apiFetch(`/documents/${id}`);
      if (res.ok) {
        const updated = await res.json();
        setDocuments(prev => prev.map(doc => doc.id === id ? updated : doc));
      }
    } catch {
      if (previous) setDocuments(prev => prev.map(doc => doc.id === id ? previous : doc));
      addToast('error', 'Update Failed', 'Could not save document changes. Please try again.');
      return;
    }

    addToast('success', 'Document Updated', 'Changes were saved successfully.');
  };

  const deleteDocument = async (id: string) => {
    const docToDelete = documents.find(d => d.id === id);
    if (!docToDelete) return;

    // Optimistic update
    setDocuments(prev => prev.filter(d => d.id !== id));

    try {
      const response = await apiFetch(`/documents/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
    } catch {
      // Revert on error
      setDocuments(prev => [docToDelete, ...prev]);
      addToast('error', 'Delete Failed', 'Could not delete document. Please try again.');
      return;
    }

    addToast('warning', 'Document Deleted', `"${docToDelete.title}" has been removed.`);
    setTrashedDocuments(prev => [docToDelete, ...prev]);
  };

  const batchDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    const previous = documents.filter(d => ids.includes(d.id));
    // Optimistic update
    setDocuments(prev => prev.filter(d => !ids.includes(d.id)));

    try {
      const response = await apiFetch('/documents/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error('Batch delete failed');
    } catch {
      setDocuments(prev => [...previous, ...prev.filter(d => !ids.includes(d.id))]);
      addToast('error', 'Batch Deletion Failed', 'Could not delete the selected documents. Please try again.');
      return;
    }

    addToast('warning', 'Batch Deletion Complete', `${ids.length} documents removed.`);
    setTrashedDocuments(prev => [...previous, ...prev]);
  };

  const restoreDocument = async (id: string) => {
    try {
      const response = await apiFetch(`/documents/${id}/restore`, { method: 'POST' });
      if (!response.ok) throw new Error('Could not restore document.');
      const restored = await response.json();
      setTrashedDocuments(prev => prev.filter(doc => doc.id !== id));
      setDocuments(prev => [restored, ...prev.filter(doc => doc.id !== id)]);
      addToast('success', 'Document Restored', `"${restored.title}" is back in the repository.`);
    } catch (error) {
      addToast('error', 'Restore Failed', error instanceof Error ? error.message : 'Could not restore document.');
    }
  };

  const permanentlyDeleteDocument = async (id: string) => {
    try {
      const response = await apiFetch(`/documents/${id}/permanent`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not permanently delete document.');
      setTrashedDocuments(prev => prev.filter(doc => doc.id !== id));
      addToast('warning', 'Document Permanently Deleted', 'The document and encrypted file were removed.');
    } catch (error) {
      addToast('error', 'Permanent Deletion Failed', error instanceof Error ? error.message : 'Could not permanently delete document.');
    }
  };

  const toggleStar = async (id: string) => {
    // Optimistic update
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, isStarred: !d.isStarred } : d));

    try {
      const response = await apiFetch(`/documents/${id}/star`, { method: 'POST' });
      if (!response.ok) throw new Error('Could not update star');
    } catch {
      setDocuments(prev => prev.map(d => d.id === id ? { ...d, isStarred: !d.isStarred } : d));
      addToast('error', 'Update Failed', 'Could not change the starred status.');
    }
  };

  const generateShareLink = async (
    documentId: string,
    settings: Omit<PublicShareLink, 'id' | 'createdAt' | 'accessCount'>
  ) => {
    try {
      const res = await apiFetch(`/documents/${documentId}/share`, {
        method: 'POST',
        body: JSON.stringify({
          allowDownload: settings.allowDownload,
          passwordProtected: settings.passwordProtected,
          password: settings.password,
          watermark: settings.watermark,
          expiresInDays: Math.max(1, Math.ceil((new Date(settings.expiresAt).getTime() - Date.now()) / 86400000)),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not create share link.');
      const shareLink = result as PublicShareLink;
      setDocuments(prev => prev.map(d => d.id === documentId ? { ...d, publicShareLink: shareLink } : d));
      setShareDoc(prev => prev?.id === documentId ? { ...prev, publicShareLink: shareLink } : prev);
      addToast('success', 'Secure Link Generated', 'Share link is ready to copy.');
    } catch (error) {
      addToast('error', 'Share Link Failed', error instanceof Error ? error.message : 'Could not create share link.');
    }
  };

  const revokeShareLink = async (documentId: string) => {
    try {
      const response = await apiFetch(`/documents/${documentId}/share`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not revoke link');
    } catch {
      addToast('error', 'Revoke Failed', 'Could not disable the share link.');
      return;
    }
    setDocuments(prev => prev.map(d => d.id === documentId ? { ...d, publicShareLink: undefined } : d));
    addToast('info', 'Link Revoked', 'External access has been disabled for this file.');
  };

  const addCollaborator = async (documentId: string, collaborator: Omit<SharePermission, 'addedAt'>) => {
    try {
      const response = await apiFetch(`/documents/${documentId}/collaborators`, {
        method: 'POST',
        body: JSON.stringify({ email: collaborator.email, role: collaborator.role }),
      });
      if (!response.ok) throw new Error('Could not add collaborator');
    } catch {
      addToast('error', 'Invitation Failed', `Could not assign ${collaborator.email}.`);
      return;
    }

    const perm: SharePermission = { ...collaborator, addedAt: new Date().toISOString() };
    setDocuments(prev =>
      prev.map(d => {
        if (d.id === documentId) {
          const filtered = d.sharedWith.filter(s => s.email !== perm.email);
          return { ...d, sharedWith: [...filtered, perm] };
        }
        return d;
      })
    );
    addToast('success', 'Collaborator Invited', `${perm.email} assigned as ${perm.role}.`);
  };

  const removeCollaborator = async (documentId: string, email: string) => {
    try {
      const response = await apiFetch(`/documents/${documentId}/collaborators/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Could not remove collaborator');
    } catch {
      addToast('error', 'Revocation Failed', `Could not remove ${email}.`);
      return;
    }

    setDocuments(prev =>
      prev.map(d => {
        if (d.id === documentId) {
          return { ...d, sharedWith: d.sharedWith.filter(s => s.email !== email) };
        }
        return d;
      })
    );
    addToast('info', 'Access Revoked', `Removed ${email} from document permissions.`);
  };

  const downloadDocument = async (doc: DocumentItem) => {
    if (doc.hasFileContent === false) {
      addToast('error', 'File Unavailable', 'The original file is missing from storage. This entry contains metadata only.');
      return;
    }
    if (doc.canDownload === false) {
      addToast('error', 'Download Not Allowed', 'Your document access role does not allow downloading this file.');
      return;
    }
    try {
      const response = await apiFetch(`/documents/${doc.id}/download`, { method: 'POST' });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.originalFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      addToast('success', 'Download Complete', `Downloaded ${doc.originalFileName}`);
      return;
    } catch {
      addToast('error', 'Download Failed', `Could not retrieve ${doc.originalFileName}.`);
    }
  };

  const approveDocument = async (id: string, notes?: string) => {
    try {
      const res = await apiFetch(`/documents/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error('Approval was rejected');
      const updated = await res.json();
      setDocuments(prev => prev.map(d => d.id === id ? updated : d));
    } catch {
      addToast('error', 'Approval Failed', 'The document could not be approved. Check your reviewer permissions and try again.');
      return;
    }

    const doc = documents.find(d => d.id === id);
    addToast('success', 'Review Complete', `"${doc?.title}" is waiting for the manager’s final seal.`);
  };

  const sealDocument = async (id: string) => {
    try {
      const res = await apiFetch(`/documents/${id}/seal`, { method: 'POST', body: JSON.stringify({}) });
      if (!res.ok) throw new Error('Seal was rejected');
      const updated = await res.json();
      setDocuments(prev => prev.map(d => d.id === id ? updated : d));
      addToast('success', 'Document Sealed', `"${updated.title}" is now certified.`);
    } catch {
      addToast('error', 'Seal Failed', 'The document could not be sealed. Check your manager permissions and try again.');
    }
  };

  const rejectDocument = async (id: string, reason: string) => {
    try {
      const res = await apiFetch(`/documents/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Rejection was rejected');
      const updated = await res.json();
      setDocuments(prev => prev.map(d => d.id === id ? updated : d));
    } catch {
      addToast('error', 'Rejection Failed', 'The document could not be rejected. Check your reviewer permissions and try again.');
      return;
    }

    const doc = documents.find(d => d.id === id);
    addToast('warning', 'Document Rejected', `"${doc?.title}" was rejected with feedback.`);
  };

  // Filtered views
  const filteredDocuments = documents.filter(doc => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = doc.title.toLowerCase().includes(q);
      const matchesFilename = doc.originalFileName.toLowerCase().includes(q);
      const matchesTags = doc.tags.some(t => t.toLowerCase().includes(q));
      const matchesOwner = doc.ownerName.toLowerCase().includes(q);
      if (!matchesTitle && !matchesFilename && !matchesTags && !matchesOwner) return false;
    }

    if (selectedCategory !== 'All' && doc.category !== selectedCategory) return false;
    if (selectedSensitivity !== 'All' && doc.sensitivity !== selectedSensitivity) return false;
    if (selectedFileType !== 'All' && doc.fileType !== selectedFileType.toLowerCase()) return false;
    if (selectedTag !== 'All' && !doc.tags.includes(selectedTag)) return false;

    return true;
  }).sort((a, b) => {
    if (sortBy === 'starred') return (b.isStarred ? 1 : 0) - (a.isStarred ? 1 : 0);
    if (sortBy === 'name-asc') return a.title.localeCompare(b.title);
    if (sortBy === 'size-desc') return b.fileSizeBytes - a.fileSizeBytes;
    if (sortBy === 'date-asc') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const myDocuments = documents.filter(d => d.ownerId === activeUser.id);
  const sharedWithMeDocuments = documents.filter(d =>
    d.sharedWith.some(s => s.email.toLowerCase() === activeUser.email.toLowerCase()) ||
    d.teamShares?.some(s => activeUser.teamIds?.includes(s.teamId) || s.teamId === activeUser.teamId)
  );
  const sharedByMeDocuments = documents.filter(
    d => d.ownerId === activeUser.id && (d.sharedWith.length > 0 || !!d.teamShares?.length || !!d.publicShareLink)
  );
  const starredDocuments = documents.filter(d => d.isStarred);
  const pendingApprovalDocuments = documents.filter(d => {
    const isReviewStep = d.approvalStatus === 'pending_review';
    const isSealStep = d.approvalStatus === 'pending_manager_seal';
    if (!isReviewStep && !isSealStep) return false;
    const reviewerAssigned = isReviewStep && d.ownerId !== activeUser.id && d.sharedWith.some(s =>
      s.email.toLowerCase() === activeUser.email.toLowerCase() && s.role === 'reviewer');
    const teamManager = activeUser.role === 'manager' && (d.isTeamDocument || !!activeUser.teamId && d.teamId === activeUser.teamId);
    return reviewerAssigned || teamManager || activeUser.role === 'admin';
  });

  const departmentDocuments = documents.filter(d => {
    return activeUser.role === 'manager' && (d.isTeamDocument || !!activeUser.teamId && d.teamId === activeUser.teamId);
  });

  return (
    <DocumentContext.Provider
      value={{
        documents,
        trashedDocuments,
        auditLogs,
        isLoading,
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
        previewDoc,
        setPreviewDoc,
        shareDoc,
        setShareDoc,
        auditDoc,
        setAuditDoc,
        addDocument,
        updateDocument,
        deleteDocument,
        batchDelete,
        toggleStar,
        generateShareLink,
        revokeShareLink,
        addCollaborator,
        removeCollaborator,
        downloadDocument,
        addAuditLog,
        approveDocument,
        sealDocument,
        rejectDocument,
        refreshDocuments,
        refreshAuditLogs,
        restoreDocument,
        permanentlyDeleteDocument,
        toasts,
        addToast,
        removeToast,
        filteredDocuments,
        myDocuments,
        sharedWithMeDocuments,
        sharedByMeDocuments,
        starredDocuments,
        pendingApprovalDocuments,
        departmentDocuments,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};

export const useDocuments = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocuments must be used within a DocumentProvider');
  }
  return context;
};
