export type UserRole = 'admin' | 'manager' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  department: string;
  teamId?: string;
  teamIds?: string[];
  twoFactorEnabled: boolean;
  storageUsedBytes: number;
  storageLimitBytes: number;
  status: 'active' | 'suspended' | 'invited';
  lastActive: string;
}

export type DocumentCategory = 
  | 'Legal & Contracts'
  | 'Financial & Tax'
  | 'Security & Compliance'
  | 'Human Resources'
  | 'Engineering & Tech'
  | 'Marketing & Sales'
  | 'Operations';

export type SensitivityLevel = 'Public' | 'Internal' | 'Confidential' | 'Restricted';

export type FileType = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'png' | 'jpg' | 'zip' | 'txt';

export interface SharePermission {
  userId?: string;
  email: string;
  role: 'viewer' | 'reviewer' | 'editor';
  addedAt: string;
  expiresAt?: string;
}

export interface TeamSharePermission {
  teamId: string;
  teamName: string;
  userId?: string;
  memberName?: string;
  role: 'viewer' | 'editor';
  createdAt: string;
}

export interface PublicShareLink {
  id: string;
  url: string;
  allowDownload: boolean;
  passwordProtected: boolean;
  password?: string;
  watermark: boolean;
  expiresAt: string;
  createdAt: string;
  accessCount: number;
}

export interface DocumentAuditLog {
  id: string;
  documentId: string;
  action: 'Created' | 'Viewed' | 'Downloaded' | 'Shared' | 'Permission Changed' | 'Metadata Updated' | 'Archived' | 'Deleted' | 'Commented';
  actorName: string;
  actorEmail: string;
  timestamp: string;
  ipAddress: string;
  details?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  originalFileName: string;
  fileType: FileType;
  fileSizeBytes: number;
  category: DocumentCategory;
  tags: string[];
  sensitivity: SensitivityLevel;
  ownerId: string;
  teamId?: string;
  hasFileContent?: boolean;
  canReadContent?: boolean;
  canDownload?: boolean;
  isTeamDocument?: boolean;
  ownerName: string;
  ownerAvatar?: string;
  createdAt: string;
  updatedAt: string;
  isStarred: boolean;
  isArchived: boolean;
  version: number;
  description?: string;
  approvalStatus?: 'approved' | 'pending_review' | 'pending_manager_seal' | 'rejected';
  reviewerNotes?: string;
  sealedBy?: string;
  sealedAt?: string;
  sharedWith: SharePermission[];
  teamShares?: TeamSharePermission[];
  publicShareLink?: PublicShareLink;
  previewUrl?: string;
  textContentSample?: string;
}

export interface UploadProgressItem {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'encrypting' | 'uploading' | 'verifying' | 'completed' | 'error';
  errorMessage?: string;
  category: DocumentCategory;
  sensitivity: SensitivityLevel;
  tags: string[];
}

export interface SystemStats {
  totalDocuments: number;
  totalStorageBytes: number;
  maxStorageBytes: number;
  sharedLinksCount: number;
  securityScore: number | null;
  activeUsersCount: number;
  auditEventsCount: number;
}
