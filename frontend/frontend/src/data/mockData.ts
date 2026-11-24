import { DocumentItem, User, DocumentAuditLog } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-1',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@docvault.internal',
    role: 'admin',
    avatar: '/src/assets/images/avatar_sarah_admin_1794313392210.jpg',
    department: 'Executive Operations',
    twoFactorEnabled: true,
    storageUsedBytes: 42.4 * 1024 * 1024 * 1024, // 42.4 GB
    storageLimitBytes: 100 * 1024 * 1024 * 1024, // 100 GB
    status: 'active',
    lastActive: 'Just now',
  },
  {
    id: 'usr-2',
    name: 'Alex Rivera',
    email: 'alex.rivera@docvault.internal',
    role: 'manager',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    department: 'Engineering & Systems',
    twoFactorEnabled: true,
    storageUsedBytes: 18.2 * 1024 * 1024 * 1024,
    storageLimitBytes: 50 * 1024 * 1024 * 1024,
    status: 'active',
    lastActive: '14 minutes ago',
  },
  {
    id: 'usr-3',
    name: 'Elena Rostova Chen',
    email: 'elena.chen@docvault.internal',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    department: 'Legal & Compliance',
    twoFactorEnabled: true,
    storageUsedBytes: 31.0 * 1024 * 1024 * 1024,
    storageLimitBytes: 50 * 1024 * 1024 * 1024,
    status: 'active',
    lastActive: '2 hours ago',
  },
  {
    id: 'usr-4',
    name: 'Marcus Vance',
    email: 'marcus.v@docvault.internal',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    department: 'Finance & Tax',
    twoFactorEnabled: false,
    storageUsedBytes: 12.8 * 1024 * 1024 * 1024,
    storageLimitBytes: 50 * 1024 * 1024 * 1024,
    status: 'active',
    lastActive: 'Yesterday',
  },
  {
    id: 'usr-5',
    name: 'Priya Sharma',
    email: 'priya.sharma@docvault.internal',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    department: 'External Advisory',
    twoFactorEnabled: true,
    storageUsedBytes: 1.2 * 1024 * 1024 * 1024,
    storageLimitBytes: 10 * 1024 * 1024 * 1024,
    status: 'active',
    lastActive: '3 days ago',
  },
  {
    id: 'usr-6',
    name: 'David Kim',
    email: 'david.kim@docvault.internal',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    department: 'Product Management',
    twoFactorEnabled: true,
    storageUsedBytes: 8.5 * 1024 * 1024 * 1024,
    storageLimitBytes: 50 * 1024 * 1024 * 1024,
    status: 'suspended',
    lastActive: '2 weeks ago',
  },
];

export const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc-101',
    title: 'Master Services Agreement & NDA - Q4 2026',
    originalFileName: 'MSA_Enterprise_Tier1_Executed_2026.pdf',
    fileType: 'pdf',
    fileSizeBytes: 4820000, // 4.82 MB
    category: 'Legal & Contracts',
    tags: ['contract', 'nda', 'enterprise', 'q4'],
    sensitivity: 'Restricted',
    ownerId: 'usr-1',
    ownerName: 'Sarah Jenkins',
    ownerAvatar: '/src/assets/images/avatar_sarah_admin_1794313392210.jpg',
    createdAt: '2026-10-18T14:32:00Z',
    updatedAt: '2026-11-04T09:15:00Z',
    isStarred: true,
    isArchived: false,
    version: 3,
    approvalStatus: 'approved',
    description: 'Fully executed tripartite master services agreement and bilateral non-disclosure provisions with Northstar Capital.',
    sharedWith: [
      { email: 'elena.chen@docvault.internal', role: 'editor', addedAt: '2026-10-19T10:00:00Z' },
      { email: 'alex.rivera@docvault.internal', role: 'reviewer', addedAt: '2026-10-20T11:30:00Z' },
    ],
    publicShareLink: {
      id: 'lnk-01',
      url: 'https://docvault.internal/s/v9k3-msa-sec-2026',
      allowDownload: false,
      passwordProtected: true,
      watermark: true,
      expiresAt: '2026-12-31T23:59:59Z',
      createdAt: '2026-10-20T11:45:00Z',
      accessCount: 14,
    },
    textContentSample: `MASTER SERVICES AGREEMENT (MSA)
Reference Code: MSA-2026-ENT-094
Status: EXECUTED & CIPHER VERIFIED

1. SCOPE OF SERVICES
The Provider shall deliver secure enterprise data retention and vault services adhering strictly to ISO 27001 and SOC 2 Type II controls.

2. CONFIDENTIALITY AND ENCRYPTION
Each party acknowledges that Proprietary Information includes all cryptographic keys, tenant vaults, and raw document payloads stored under 256-bit AES envelope encryption.

3. TERM AND TERMINATION
This Agreement shall remain in effect for a period of thirty-six (36) months commencing October 1, 2026.

Signatures:
/s/ Sarah Jenkins, Vice President
/s/ Marcus Sterling, General Counsel`,
  },
  {
    id: 'doc-102',
    title: 'SOC 2 Type II Security Audit Report (FY2026)',
    originalFileName: 'DocVault_SOC2_Type_II_Final_Audit.pdf',
    fileType: 'pdf',
    fileSizeBytes: 12400000, // 12.4 MB
    category: 'Security & Compliance',
    tags: ['soc2', 'compliance', 'audit', 'iso27001'],
    sensitivity: 'Confidential',
    ownerId: 'usr-1',
    ownerName: 'Sarah Jenkins',
    ownerAvatar: '/src/assets/images/avatar_sarah_admin_1794313392210.jpg',
    createdAt: '2026-09-30T16:00:00Z',
    updatedAt: '2026-10-15T08:20:00Z',
    isStarred: true,
    isArchived: false,
    version: 1,
    approvalStatus: 'approved',
    description: 'Independent auditor report on controls relevant to Security, Availability, and Confidentiality.',
    sharedWith: [
      { email: 'alex.rivera@docvault.internal', role: 'editor', addedAt: '2026-10-01T09:00:00Z' },
      { email: 'priya.sharma@docvault.internal', role: 'viewer', addedAt: '2026-10-05T14:10:00Z', expiresAt: '2026-11-30T00:00:00Z' },
    ],
    textContentSample: `INDEPENDENT AUDITOR'S REPORT
To the Board of Directors of DocVault Technologies:

Scope:
We have examined management's assertion that the controls within the DocVault Enterprise Cloud were suitably designed to provide reasonable assurance that the service commitments and system requirements were achieved based on the trust services criteria relevant to Security (TSP Section 100).

Opinion:
In our opinion, in all material respects, management's assertion is fairly stated, and the tested controls operated effectively throughout the period.`,
  },
  {
    id: 'doc-103',
    title: 'Q3 2026 Consolidated Financial Statement & EBITDA',
    originalFileName: 'Consolidated_Financials_Q3_2026.xlsx',
    fileType: 'xlsx',
    fileSizeBytes: 3150000, // 3.15 MB
    category: 'Financial & Tax',
    tags: ['financial', 'q3', 'ebitda', 'revenue'],
    sensitivity: 'Confidential',
    ownerId: 'usr-4',
    ownerName: 'Marcus Vance',
    ownerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    createdAt: '2026-10-10T11:20:00Z',
    updatedAt: '2026-10-24T18:45:00Z',
    isStarred: false,
    isArchived: false,
    version: 4,
    approvalStatus: 'approved',
    description: 'Quarterly breakdown of gross recurring revenue, cloud infrastructure COGS, and GAAP operating margins.',
    sharedWith: [
      { email: 'sarah.jenkins@docvault.internal', role: 'reviewer', addedAt: '2026-10-10T12:00:00Z' },
    ],
    textContentSample: `CONSOLIDATED FINANCIAL SUMMARY (Q3 2026 - USD Millions)
Metric              Q1 2026    Q2 2026    Q3 2026    YoY Delta
ARR                 $32.4M     $38.1M     $45.6M     +41.2%
Gross Margin        78.4%      79.2%      81.0%      +2.6%
Operating Income    $4.8M      $6.2M      $8.9M      +85.4%
Free Cash Flow      $3.9M      $5.1M      $7.4M      +89.7%`,
  },
  {
    id: 'doc-104',
    title: 'Zero-Trust Architecture & Key Rotation Protocol',
    originalFileName: 'ZeroTrust_KMS_Rotation_Specs_v2.docx',
    fileType: 'docx',
    fileSizeBytes: 2100000, // 2.1 MB
    category: 'Engineering & Tech',
    tags: ['architecture', 'security', 'kms', 'encryption'],
    sensitivity: 'Restricted',
    ownerId: 'usr-2',
    ownerName: 'Alex Rivera',
    ownerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    createdAt: '2026-08-14T09:15:00Z',
    updatedAt: '2026-11-01T15:10:00Z',
    isStarred: true,
    isArchived: false,
    version: 2,
    approvalStatus: 'pending_review',
    description: 'Hardware Security Module (HSM) cluster orchestration, per-tenant envelope keys, and 90-day automatic key rotation procedures.',
    sharedWith: [
      { email: 'sarah.jenkins@docvault.internal', role: 'editor', addedAt: '2026-08-15T08:00:00Z' },
    ],
    textContentSample: `ENGINEERING SPECIFICATION: ZERO-TRUST KEY ORCHESTRATION
Doc Version: 2.4.0-STABLE

1. Envelope Cryptography Pipeline
Data keys (DEKs) are generated on client runtime using WebCrypto API or authenticated agent instances.
The DEK is wrapped using the Tenant Key Encryption Key (KEK) housed within FIPS 140-3 Level 4 HSM enclosures.

2. Automated Re-wrapping and Epoch Transition
Every 90 days, epoch indices are incremented. Historical documents maintain integrity via cryptographic verifiable chaining.`,
  },
  {
    id: 'doc-105',
    title: 'Executive Compensation & Equity Grant Agreements',
    originalFileName: 'Exec_Comp_Equity_Schedule_2026.pdf',
    fileType: 'pdf',
    fileSizeBytes: 5400000, // 5.4 MB
    category: 'Human Resources',
    tags: ['hr', 'equity', 'compensation', 'board'],
    sensitivity: 'Restricted',
    ownerId: 'usr-1',
    ownerName: 'Sarah Jenkins',
    ownerAvatar: '/src/assets/images/avatar_sarah_admin_1794313392210.jpg',
    createdAt: '2026-07-20T10:00:00Z',
    updatedAt: '2026-09-12T14:00:00Z',
    isStarred: false,
    isArchived: false,
    version: 1,
    approvalStatus: 'approved',
    description: 'Board-approved executive share allocation schedules, cliff schedules, and accelerated vesting governance clauses.',
    sharedWith: [
      { email: 'elena.chen@docvault.internal', role: 'reviewer', addedAt: '2026-07-21T09:30:00Z' },
    ],
    textContentSample: `EXECUTIVE INCENTIVE PLAN (2026-2029)
Schedule B: Restricted Stock Units (RSUs)

Vesting Schedule:
- 25% upon completion of Year 1
- Monthly proportional vesting thereafter over 36 months
- Subject to continued compliance with non-compete and confidentiality stipulations.`,
  },
  {
    id: 'doc-106',
    title: 'Disaster Recovery Plan & Multi-Region Failover Runbook',
    originalFileName: 'DR_Failover_MultiRegion_Runbook.pdf',
    fileType: 'pdf',
    fileSizeBytes: 8900000,
    category: 'Operations',
    tags: ['operations', 'dr', 'failover', 'infra'],
    sensitivity: 'Internal',
    ownerId: 'usr-2',
    ownerName: 'Alex Rivera',
    ownerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    createdAt: '2026-09-02T13:40:00Z',
    updatedAt: '2026-10-18T16:20:00Z',
    isStarred: false,
    isArchived: false,
    version: 2,
    approvalStatus: 'pending_review',
    description: 'Step-by-step procedures for cross-region DNS failover, database replica promotion, and RPO/RTO verification under 60 seconds.',
    sharedWith: [
      { email: 'sarah.jenkins@docvault.internal', role: 'reviewer', addedAt: '2026-09-03T11:00:00Z' },
    ],
    textContentSample: `OPERATIONAL RUNBOOK: DISASTER RECOVERY & REGIONAL FAILOVER
Target RTO: < 90 seconds
Target RPO: 0 seconds (synchronous raft consensus)

Emergency Primary Site Degradation Protocol:
1. Verify partition telemetry across at least 3 quorum witnesses.
2. Trigger automated DNS health check failover to eu-central secondary region.
3. Validate hot standby read-write promotion.`,
  },
  {
    id: 'doc-107',
    title: 'Q4 2026 Enterprise Product Roadmap & Strategy',
    originalFileName: 'Product_Roadmap_Q4_2026_Enterprise.pptx',
    fileType: 'pptx',
    fileSizeBytes: 18200000,
    category: 'Engineering & Tech',
    tags: ['product', 'roadmap', 'q4', 'strategy'],
    sensitivity: 'Internal',
    ownerId: 'usr-6',
    ownerName: 'David Kim',
    ownerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    createdAt: '2026-10-05T09:00:00Z',
    updatedAt: '2026-10-12T11:00:00Z',
    isStarred: false,
    isArchived: false,
    version: 1,
    approvalStatus: 'pending_review',
    description: 'Executive slides highlighting the upcoming AI-driven classification pipeline, DLP scanners, and client-side mobile biometric unlock.',
    sharedWith: [
      { email: 'sarah.jenkins@docvault.internal', role: 'viewer', addedAt: '2026-10-06T15:00:00Z' },
      { email: 'alex.rivera@docvault.internal', role: 'editor', addedAt: '2026-10-06T15:00:00Z' },
    ],
    textContentSample: `DOCVAULT ENTERPRISE ROADMAP (Q4 2026 - Q2 2027)
1. Milestone Alpha: Automated DLP Content Redaction
2. Milestone Beta: Hardware Key (YubiKey / WebAuthn) Enforcement
3. Milestone Gamma: Fine-grained temporal watermarking`,
  },
  {
    id: 'doc-108',
    title: 'Vendor Risk Assessment: Cloudflare Zero Trust',
    originalFileName: 'Vendor_Security_Risk_Assessment_CF.pdf',
    fileType: 'pdf',
    fileSizeBytes: 2750000,
    category: 'Security & Compliance',
    tags: ['vendor', 'risk', 'compliance', 'security'],
    sensitivity: 'Internal',
    ownerId: 'usr-3',
    ownerName: 'Elena Rostova Chen',
    ownerAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    createdAt: '2026-10-22T14:30:00Z',
    updatedAt: '2026-10-22T14:30:00Z',
    isStarred: false,
    isArchived: false,
    version: 1,
    approvalStatus: 'approved',
    description: 'Comprehensive third-party vendor review covering data residency, encryption at transit/rest, and sub-processor agreements.',
    sharedWith: [
      { email: 'sarah.jenkins@docvault.internal', role: 'viewer', addedAt: '2026-10-23T09:00:00Z' },
    ],
    textContentSample: `VENDOR RISK ASSESSMENT MATRIX
Vendor: Cloudflare, Inc.
Assessment Result: LOW RISK (Approved)
Data Processing Addendum (DPA): Executed with Standard Contractual Clauses (SCCs).`,
  },
];

export const INITIAL_AUDIT_LOGS: DocumentAuditLog[] = [
  {
    id: 'log-101',
    documentId: 'doc-101',
    action: 'Shared',
    actorName: 'Sarah Jenkins',
    actorEmail: 'sarah.jenkins@docvault.internal',
    timestamp: '2026-11-10T03:45:12Z',
    ipAddress: '192.168.1.104',
    details: 'Generated secure time-limited public link with watermarking enabled',
  },
  {
    id: 'log-102',
    documentId: 'doc-102',
    action: 'Downloaded',
    actorName: 'Priya Sharma',
    actorEmail: 'priya.sharma@docvault.internal',
    timestamp: '2026-11-09T22:15:30Z',
    ipAddress: '172.56.21.89',
    details: 'Downloaded encrypted blob with decrypted key verification',
  },
  {
    id: 'log-103',
    documentId: 'doc-104',
    action: 'Metadata Updated',
    actorName: 'Alex Rivera',
    actorEmail: 'alex.rivera@docvault.internal',
    timestamp: '2026-11-09T18:02:11Z',
    ipAddress: '10.0.4.12',
    details: 'Updated sensitivity classification from Confidential to Restricted',
  },
  {
    id: 'log-104',
    documentId: 'doc-103',
    action: 'Viewed',
    actorName: 'Sarah Jenkins',
    actorEmail: 'sarah.jenkins@docvault.internal',
    timestamp: '2026-11-09T14:22:45Z',
    ipAddress: '192.168.1.104',
    details: 'Viewed spreadsheet via secure in-memory browser sandbox',
  },
  {
    id: 'log-105',
    documentId: 'doc-105',
    action: 'Permission Changed',
    actorName: 'Sarah Jenkins',
    actorEmail: 'sarah.jenkins@docvault.internal',
    timestamp: '2026-11-08T11:05:00Z',
    ipAddress: '192.168.1.104',
    details: 'Granted Reviewer access to Elena Rostova Chen',
  },
  {
    id: 'log-106',
    documentId: 'doc-101',
    action: 'Created',
    actorName: 'Sarah Jenkins',
    actorEmail: 'sarah.jenkins@docvault.internal',
    timestamp: '2026-10-18T14:32:00Z',
    ipAddress: '192.168.1.104',
    details: 'Uploaded and encrypted using client-side AES-256-GCM envelope',
  },
];
