import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { DocumentItem, User, DocumentAuditLog } from '../types';

/**
 * Production-ready Axios instance configured for DocVault REST API.
 * Future backend endpoints will mount directly under /api/v1.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor to attach JWT Authorization Bearer token from localStorage
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('docvault_auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle unified error reporting
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Future redirect to /auth/login
      console.warn('Unauthorized request - session may be expired');
    }
    return Promise.reject(error);
  }
);

/**
 * Authentication Service
 */
export const authService = {
  login: async (credentials: { email: string; password: string }) => {
    // Simulated endpoint call: return promise for future server connection
    return {
      token: 'simulated_jwt_token_docvault_' + Date.now(),
      email: credentials.email,
    };
  },
  register: async (data: { name: string; email: string; department: string; password?: string }) => {
    return { success: true, ...data };
  },
  requestPasswordReset: async (email: string) => {
    return { 
      success: true, 
      email, 
      resetToken: 'reset_token_' + Math.random().toString(36).substring(2, 10),
      message: 'Password reset instructions requested' 
    };
  },
  resetPassword: async (tokenOrEmail: string, newPassword: string) => {
    return { success: true, message: 'Password updated' };
  },
  getCurrentUser: async () => {
    return apiClient.get<User>('/auth/me').then(res => res.data).catch(() => null);
  },
};

/**
 * Documents Service
 */
export const documentService = {
  getDocuments: async (params?: { category?: string; query?: string; sensitivity?: string }) => {
    return apiClient.get<DocumentItem[]>('/documents', { params }).then(res => res.data);
  },
  getDocumentById: async (id: string) => {
    return apiClient.get<DocumentItem>(`/documents/${id}`).then(res => res.data);
  },
  createDocument: async (docData: Partial<DocumentItem>) => {
    return apiClient.post<DocumentItem>('/documents', docData).then(res => res.data);
  },
  updateDocument: async (id: string, updates: Partial<DocumentItem>) => {
    return apiClient.patch<DocumentItem>(`/documents/${id}`, updates).then(res => res.data);
  },
  deleteDocument: async (id: string) => {
    return apiClient.delete(`/documents/${id}`).then(res => res.data);
  },
  batchDelete: async (ids: string[]) => {
    return apiClient.post('/documents/batch-delete', { ids }).then(res => res.data);
  },
  downloadDocument: async (id: string) => {
    return apiClient.post(`/documents/${id}/download`, undefined, { responseType: 'blob' });
  },
  previewDocument: async (id: string) => {
    return apiClient.get(`/documents/${id}/preview`, { responseType: 'blob' });
  },
};

/**
 * Sharing Service
 */
export const shareService = {
  generateShareLink: async (documentId: string, settings: {
    allowDownload: boolean;
    passwordProtected: boolean;
    password?: string;
    watermark: boolean;
    expiresInDays: number;
  }) => {
    return apiClient.post(`/documents/${documentId}/share`, settings).then(res => res.data);
  },
  revokeShareLink: async (documentId: string) => {
    return apiClient.delete(`/documents/${documentId}/share`).then(res => res.data);
  },
  inviteCollaborator: async (documentId: string, payload: { email: string; role: 'viewer' | 'reviewer' | 'editor' }) => {
    return apiClient.post(`/documents/${documentId}/collaborators`, payload).then(res => res.data);
  },
};

/**
 * Admin Service
 */
export const adminService = {
  getUsers: async () => {
    return apiClient.get<User[]>('/admin/users').then(res => res.data);
  },
  updateUserRole: async (userId: string, role: string) => {
    return apiClient.patch(`/admin/users/${userId}/role`, { role }).then(res => res.data);
  },
  getAuditLogs: async (params?: { action?: string; userId?: string }) => {
    return apiClient.get<DocumentAuditLog[]>('/admin/audit-logs', { params }).then(res => res.data);
  },
  exportAuditLogs: async (format: 'csv' | 'json') => {
    return apiClient.get(`/admin/audit-logs/export?format=${format}`, { responseType: 'blob' });
  },
};
