import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomBytes, scryptSync } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DOCVAULT_DB_PATH || path.join(__dirname, 'data', 'docvault.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    manager_id TEXT REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS team_memberships (
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(team_id,user_id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    avatar TEXT,
    department TEXT,
    team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
    two_factor_enabled INTEGER DEFAULT 0,
    storage_used_bytes INTEGER DEFAULT 0,
    storage_limit_bytes INTEGER DEFAULT 53687091200,
    status TEXT DEFAULT 'active',
    last_active TEXT DEFAULT 'Just now',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    category TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    sensitivity TEXT NOT NULL DEFAULT 'Internal',
    encryption_algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
    sha256_hash TEXT,
    owner_id TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    owner_avatar TEXT,
    team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
    is_starred INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    description TEXT,
    approval_status TEXT DEFAULT 'approved',
    reviewer_notes TEXT,
    sealed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    sealed_at TEXT,
    preview_url TEXT,
    text_content_sample TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS share_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    user_id TEXT,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    added_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS team_document_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('viewer','editor')),
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(team_id, document_id)
  );

  CREATE TABLE IF NOT EXISTS team_document_access (
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('viewer','editor')),
    status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending','approved','rejected','revoked')),
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(team_id,document_id,user_id)
  );

  CREATE TABLE IF NOT EXISTS team_document_share_requests (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_role TEXT NOT NULL DEFAULT 'viewer' CHECK(requested_role IN ('viewer','editor')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','revoked')),
    reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT,
    UNIQUE(team_id,document_id,requester_id)
  );

  CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    url TEXT NOT NULL,
    allow_download INTEGER DEFAULT 0,
    password_protected INTEGER DEFAULT 0,
    password TEXT,
    watermark INTEGER DEFAULT 1,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    access_count INTEGER DEFAULT 0,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    ip_address TEXT DEFAULT '127.0.0.1',
    details TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
    ON notifications(recipient_user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS document_comments (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    attempted_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, attempted_at);
  CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at);

  CREATE TABLE IF NOT EXISTS password_reset_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    attempted_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reset_attempts_email_time ON password_reset_attempts(email, attempted_at);

  CREATE TABLE IF NOT EXISTS document_blobs (
    document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    iv BLOB NOT NULL,
    ciphertext BLOB NOT NULL,
    auth_tag BLOB,
    wrapped_key BLOB,
    key_iv BLOB,
    key_auth_tag BLOB,
    encryption_version INTEGER NOT NULL DEFAULT 1,
    key_version TEXT NOT NULL DEFAULT 'v1'
  );
`);

const auditRetentionDays = Math.max(1, Math.min(3650, Number.parseInt(process.env.DOCVAULT_AUDIT_RETENTION_DAYS || '365', 10) || 365));
const auditMaxRows = Math.max(1000, Math.min(1000000, Number.parseInt(process.env.DOCVAULT_AUDIT_MAX_ROWS || '50000', 10) || 50000));
db.prepare("DELETE FROM audit_logs WHERE julianday(timestamp) < julianday('now', ?)").run(`-${auditRetentionDays} days`);
db.prepare('DELETE FROM audit_logs WHERE id IN (SELECT id FROM audit_logs ORDER BY timestamp DESC, rowid DESC LIMIT -1 OFFSET ?)').run(auditMaxRows);
db.exec(`CREATE TRIGGER IF NOT EXISTS audit_logs_retention AFTER INSERT ON audit_logs BEGIN
  DELETE FROM audit_logs WHERE julianday(timestamp) < julianday('now', '-${auditRetentionDays} days');
  DELETE FROM audit_logs WHERE id IN (SELECT id FROM audit_logs ORDER BY timestamp DESC, rowid DESC LIMIT -1 OFFSET ${auditMaxRows});
END;`);

// Upgrade existing local databases without discarding user or document data.
const ensureColumn = (table: string, column: string, definition: string) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};
ensureColumn('users', 'team_id', 'TEXT REFERENCES teams(id) ON DELETE SET NULL');
ensureColumn('documents', 'team_id', 'TEXT REFERENCES teams(id) ON DELETE SET NULL');
ensureColumn('documents', 'sealed_by', 'TEXT REFERENCES users(id) ON DELETE SET NULL');
ensureColumn('documents', 'sealed_at', 'TEXT');
db.prepare("UPDATE users SET avatar='/default-avatar.svg' WHERE avatar IS NULL OR TRIM(avatar)=''").run();
ensureColumn('document_blobs', 'auth_tag', 'BLOB');
ensureColumn('document_blobs', 'wrapped_key', 'BLOB');
ensureColumn('document_blobs', 'key_iv', 'BLOB');
ensureColumn('document_blobs', 'key_auth_tag', 'BLOB');
ensureColumn('document_blobs', 'encryption_version', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('document_blobs', 'key_version', "TEXT NOT NULL DEFAULT 'v1'");

// Preserve previous team-wide shares as approved access for each current member.
db.prepare(`INSERT OR IGNORE INTO team_document_access (team_id,document_id,user_id,role,status,created_by,created_at)
  SELECT p.team_id,p.document_id,m.user_id,p.role,'approved',p.created_by,p.created_at
  FROM team_document_permissions p JOIN team_memberships m ON m.team_id=p.team_id`).run();

for (const user of db.prepare('SELECT id, department, team_id FROM users').all() as Array<{ id: string; department: string | null; team_id: string | null }>) {
  const name = user.department?.trim() || 'General Operations';
  const id = `team-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  db.prepare('INSERT OR IGNORE INTO teams (id, name) VALUES (?, ?)').run(id, name);
  if (!user.team_id) db.prepare('UPDATE users SET team_id=? WHERE id=?').run(id, user.id);
}
db.prepare('UPDATE documents SET team_id=(SELECT team_id FROM users WHERE users.id=documents.owner_id) WHERE team_id IS NULL').run();
db.prepare('UPDATE share_permissions SET email=LOWER(TRIM(email))').run();
db.prepare(`DELETE FROM share_permissions WHERE id NOT IN (
  SELECT MIN(id) FROM share_permissions GROUP BY document_id, email
)`).run();
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_share_permissions_document_email ON share_permissions(document_id,email)');
// The product has three global roles. Legacy demo viewers become standard users;
// document-level viewer permissions remain unchanged in share_permissions.
db.prepare("UPDATE users SET role='user' WHERE role='viewer'").run();

// ─── Seed Data ────────────────────────────────────────────────────────────────

function seedIfEmpty() {
  const seeded = db.prepare("SELECT value FROM app_metadata WHERE key='initial_seed_completed'").get();
  if (seeded) return;
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  if (userCount > 0) {
    db.prepare("INSERT INTO app_metadata (key,value) VALUES ('initial_seed_completed','1')").run();
    return;
  }

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, avatar, department, two_factor_enabled, storage_used_bytes, storage_limit_bytes, status, last_active)
    VALUES (@id, @name, @email, @password_hash, @role, @avatar, @department, @two_factor_enabled, @storage_used_bytes, @storage_limit_bytes, @status, @last_active)
  `);

  const users = [
    { id: 'usr-1', name: 'Sarah Jenkins', email: 'sarah.jenkins@docvault.internal', password_hash: 'password123', role: 'admin', avatar: '/src/assets/images/avatar_sarah_admin_1794313392210.jpg', department: 'Executive Operations', two_factor_enabled: 1, storage_used_bytes: Math.floor(42.4 * 1024 * 1024 * 1024), storage_limit_bytes: Math.floor(100 * 1024 * 1024 * 1024), status: 'active', last_active: 'Just now' },
    { id: 'usr-2', name: 'Alex Rivera', email: 'alex.rivera@docvault.internal', password_hash: 'password123', role: 'manager', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', department: 'Engineering & Systems', two_factor_enabled: 1, storage_used_bytes: Math.floor(18.2 * 1024 * 1024 * 1024), storage_limit_bytes: Math.floor(50 * 1024 * 1024 * 1024), status: 'active', last_active: '14 minutes ago' },
    { id: 'usr-3', name: 'Elena Rostova Chen', email: 'elena.chen@docvault.internal', password_hash: 'password123', role: 'user', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80', department: 'Legal & Compliance', two_factor_enabled: 1, storage_used_bytes: Math.floor(31.0 * 1024 * 1024 * 1024), storage_limit_bytes: Math.floor(50 * 1024 * 1024 * 1024), status: 'active', last_active: '2 hours ago' },
    { id: 'usr-4', name: 'Marcus Vance', email: 'marcus.v@docvault.internal', password_hash: 'password123', role: 'user', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', department: 'Finance & Tax', two_factor_enabled: 0, storage_used_bytes: Math.floor(12.8 * 1024 * 1024 * 1024), storage_limit_bytes: Math.floor(50 * 1024 * 1024 * 1024), status: 'active', last_active: 'Yesterday' },
    { id: 'usr-5', name: 'Priya Sharma', email: 'priya.sharma@docvault.internal', password_hash: 'password123', role: 'viewer', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', department: 'External Advisory', two_factor_enabled: 1, storage_used_bytes: Math.floor(1.2 * 1024 * 1024 * 1024), storage_limit_bytes: Math.floor(10 * 1024 * 1024 * 1024), status: 'active', last_active: '3 days ago' },
    { id: 'usr-6', name: 'David Kim', email: 'david.kim@docvault.internal', password_hash: 'password123', role: 'user', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', department: 'Product Management', two_factor_enabled: 1, storage_used_bytes: Math.floor(8.5 * 1024 * 1024 * 1024), storage_limit_bytes: Math.floor(50 * 1024 * 1024 * 1024), status: 'suspended', last_active: '2 weeks ago' },
  ];

  const seedUsers = db.transaction(() => {
    for (const u of users) insertUser.run(u);
  });
  seedUsers();

  const insertDoc = db.prepare(`
    INSERT INTO documents (id, title, original_file_name, file_type, file_size_bytes, category, tags, sensitivity, encryption_algorithm, sha256_hash, owner_id, owner_name, owner_avatar, is_starred, is_archived, version, description, approval_status, text_content_sample, created_at, updated_at)
    VALUES (@id, @title, @original_file_name, @file_type, @file_size_bytes, @category, @tags, @sensitivity, @encryption_algorithm, @sha256_hash, @owner_id, @owner_name, @owner_avatar, @is_starred, @is_archived, @version, @description, @approval_status, @text_content_sample, @created_at, @updated_at)
  `);

  const docs = [
    { id: 'doc-101', title: 'Master Services Agreement & NDA - Q4 2026', original_file_name: 'MSA_Enterprise_Tier1_Executed_2026.pdf', file_type: 'pdf', file_size_bytes: 4820000, category: 'Legal & Contracts', tags: JSON.stringify(['contract','nda','enterprise','q4']), sensitivity: 'Restricted', encryption_algorithm: 'AES-256-GCM', sha256_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', owner_id: 'usr-1', owner_name: 'Sarah Jenkins', owner_avatar: '/src/assets/images/avatar_sarah_admin_1794313392210.jpg', is_starred: 1, is_archived: 0, version: 3, description: 'Fully executed tripartite master services agreement.', approval_status: 'approved', text_content_sample: 'MASTER SERVICES AGREEMENT (MSA)\nReference Code: MSA-2026-ENT-094\nStatus: EXECUTED & CIPHER VERIFIED', created_at: '2026-10-18T14:32:00Z', updated_at: '2026-11-04T09:15:00Z' },
    { id: 'doc-102', title: 'SOC 2 Type II Security Audit Report (FY2026)', original_file_name: 'DocVault_SOC2_Type_II_Final_Audit.pdf', file_type: 'pdf', file_size_bytes: 12400000, category: 'Security & Compliance', tags: JSON.stringify(['soc2','compliance','audit','iso27001']), sensitivity: 'Confidential', encryption_algorithm: 'AES-256-GCM', sha256_hash: 'a71917b2b527fb9e574673620fe7f7881c6fb62fa9d8f3ecf7cf17286396e944', owner_id: 'usr-1', owner_name: 'Sarah Jenkins', owner_avatar: '/src/assets/images/avatar_sarah_admin_1794313392210.jpg', is_starred: 1, is_archived: 0, version: 1, description: 'Independent auditor report on controls relevant to Security, Availability, and Confidentiality.', approval_status: 'approved', text_content_sample: "INDEPENDENT AUDITOR'S REPORT\nScope: Security TSP Section 100.", created_at: '2026-09-30T16:00:00Z', updated_at: '2026-10-15T08:20:00Z' },
    { id: 'doc-103', title: 'Q3 2026 Consolidated Financial Statement & EBITDA', original_file_name: 'Consolidated_Financials_Q3_2026.xlsx', file_type: 'xlsx', file_size_bytes: 3150000, category: 'Financial & Tax', tags: JSON.stringify(['financial','q3','ebitda','revenue']), sensitivity: 'Confidential', encryption_algorithm: 'AES-256-GCM', sha256_hash: '1a8565a9dae5bad7141dd518747ee1149504b73a6085b7165888163195009f82', owner_id: 'usr-4', owner_name: 'Marcus Vance', owner_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', is_starred: 0, is_archived: 0, version: 4, description: 'Quarterly breakdown of gross recurring revenue.', approval_status: 'approved', text_content_sample: 'CONSOLIDATED FINANCIAL SUMMARY (Q3 2026)\nARR: $45.6M (+41.2% YoY)', created_at: '2026-10-10T11:20:00Z', updated_at: '2026-10-24T18:45:00Z' },
    { id: 'doc-104', title: 'Zero-Trust Architecture & Key Rotation Protocol', original_file_name: 'ZeroTrust_KMS_Rotation_Specs_v2.docx', file_type: 'docx', file_size_bytes: 2100000, category: 'Engineering & Tech', tags: JSON.stringify(['architecture','security','kms','encryption']), sensitivity: 'Restricted', encryption_algorithm: 'ChaCha20-Poly1305', sha256_hash: '3f786850e387550fdab836ed7e6dc881de23001b70e87038c0136221509b3800', owner_id: 'usr-2', owner_name: 'Alex Rivera', owner_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', is_starred: 1, is_archived: 0, version: 2, description: 'HSM cluster orchestration and 90-day key rotation procedures.', approval_status: 'pending_review', text_content_sample: 'ZERO-TRUST KEY ORCHESTRATION\nEnvelope Cryptography Pipeline: DEK wrapped by KEK in FIPS 140-3 HSM.', created_at: '2026-08-14T09:15:00Z', updated_at: '2026-11-01T15:10:00Z' },
    { id: 'doc-105', title: 'Executive Compensation & Equity Grant Agreements', original_file_name: 'Exec_Comp_Equity_Schedule_2026.pdf', file_type: 'pdf', file_size_bytes: 5400000, category: 'Human Resources', tags: JSON.stringify(['hr','equity','compensation','board']), sensitivity: 'Restricted', encryption_algorithm: 'AES-256-GCM', sha256_hash: '9f83c60518b4c25165b302e3a847b3e9e64a1a0c1cf66b443247360c702088a5', owner_id: 'usr-1', owner_name: 'Sarah Jenkins', owner_avatar: '/src/assets/images/avatar_sarah_admin_1794313392210.jpg', is_starred: 0, is_archived: 0, version: 1, description: 'Board-approved executive share allocation schedules.', approval_status: 'approved', text_content_sample: 'EXECUTIVE INCENTIVE PLAN (2026-2029)\n25% upon completion of Year 1, monthly vesting thereafter.', created_at: '2026-07-20T10:00:00Z', updated_at: '2026-09-12T14:00:00Z' },
    { id: 'doc-106', title: 'Disaster Recovery Plan & Multi-Region Failover Runbook', original_file_name: 'DR_Failover_MultiRegion_Runbook.pdf', file_type: 'pdf', file_size_bytes: 8900000, category: 'Operations', tags: JSON.stringify(['operations','dr','failover','infra']), sensitivity: 'Internal', encryption_algorithm: 'AES-256-GCM', sha256_hash: 'b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78', owner_id: 'usr-2', owner_name: 'Alex Rivera', owner_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', is_starred: 0, is_archived: 0, version: 2, description: 'Cross-region DNS failover procedures. RTO < 90s.', approval_status: 'pending_review', text_content_sample: 'DISASTER RECOVERY RUNBOOK\nTarget RTO: < 90 seconds | Target RPO: 0 seconds', created_at: '2026-09-02T13:40:00Z', updated_at: '2026-10-18T16:20:00Z' },
    { id: 'doc-107', title: 'Q4 2026 Enterprise Product Roadmap & Strategy', original_file_name: 'Product_Roadmap_Q4_2026_Enterprise.pptx', file_type: 'pptx', file_size_bytes: 18200000, category: 'Engineering & Tech', tags: JSON.stringify(['product','roadmap','q4','strategy']), sensitivity: 'Internal', encryption_algorithm: 'AES-256-GCM', sha256_hash: 'c45c01c1345b92e45277964f5716b3f33db6580d56ac37e76e64647c6459f476', owner_id: 'usr-6', owner_name: 'David Kim', owner_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', is_starred: 0, is_archived: 0, version: 1, description: 'AI-driven classification pipeline and mobile biometric unlock roadmap.', approval_status: 'pending_review', text_content_sample: 'DOCVAULT ENTERPRISE ROADMAP (Q4 2026)\n1. DLP Content Redaction\n2. WebAuthn Enforcement\n3. Temporal Watermarking', created_at: '2026-10-05T09:00:00Z', updated_at: '2026-10-12T11:00:00Z' },
    { id: 'doc-108', title: 'Vendor Risk Assessment: Cloudflare Zero Trust', original_file_name: 'Vendor_Security_Risk_Assessment_CF.pdf', file_type: 'pdf', file_size_bytes: 2750000, category: 'Security & Compliance', tags: JSON.stringify(['vendor','risk','compliance','security']), sensitivity: 'Internal', encryption_algorithm: 'AES-256-GCM', sha256_hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', owner_id: 'usr-3', owner_name: 'Elena Rostova Chen', owner_avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80', is_starred: 0, is_archived: 0, version: 1, description: 'Third-party vendor review covering data residency and encryption.', approval_status: 'approved', text_content_sample: 'VENDOR RISK ASSESSMENT MATRIX\nVendor: Cloudflare, Inc.\nResult: LOW RISK (Approved)', created_at: '2026-10-22T14:30:00Z', updated_at: '2026-10-22T14:30:00Z' },
  ];

  const seedDocs = db.transaction(() => {
    for (const d of docs) insertDoc.run(d);
  });
  seedDocs();

  // Share permissions
  const insertPerm = db.prepare(`
    INSERT INTO share_permissions (document_id, email, role, added_at)
    VALUES (@document_id, @email, @role, @added_at)
  `);
  const perms = [
    { document_id: 'doc-101', email: 'elena.chen@docvault.internal', role: 'editor', added_at: '2026-10-19T10:00:00Z' },
    { document_id: 'doc-101', email: 'alex.rivera@docvault.internal', role: 'reviewer', added_at: '2026-10-20T11:30:00Z' },
    { document_id: 'doc-102', email: 'alex.rivera@docvault.internal', role: 'editor', added_at: '2026-10-01T09:00:00Z' },
    { document_id: 'doc-102', email: 'priya.sharma@docvault.internal', role: 'viewer', added_at: '2026-10-05T14:10:00Z' },
    { document_id: 'doc-103', email: 'sarah.jenkins@docvault.internal', role: 'reviewer', added_at: '2026-10-10T12:00:00Z' },
    { document_id: 'doc-104', email: 'sarah.jenkins@docvault.internal', role: 'editor', added_at: '2026-08-15T08:00:00Z' },
    { document_id: 'doc-105', email: 'elena.chen@docvault.internal', role: 'reviewer', added_at: '2026-07-21T09:30:00Z' },
    { document_id: 'doc-106', email: 'sarah.jenkins@docvault.internal', role: 'reviewer', added_at: '2026-09-03T11:00:00Z' },
    { document_id: 'doc-107', email: 'sarah.jenkins@docvault.internal', role: 'viewer', added_at: '2026-10-06T15:00:00Z' },
    { document_id: 'doc-107', email: 'alex.rivera@docvault.internal', role: 'editor', added_at: '2026-10-06T15:00:00Z' },
    { document_id: 'doc-108', email: 'sarah.jenkins@docvault.internal', role: 'viewer', added_at: '2026-10-23T09:00:00Z' },
  ];
  const seedPerms = db.transaction(() => {
    for (const p of perms) insertPerm.run(p);
  });
  seedPerms();

  // Share link for doc-101
  db.prepare(`
    INSERT INTO share_links (id, document_id, url, allow_download, password_protected, watermark, expires_at, created_at, access_count)
    VALUES ('lnk-01', 'doc-101', 'https://docvault.internal/s/v9k3-msa-sec-2026', 0, 1, 1, '2026-12-31T23:59:59Z', '2026-10-20T11:45:00Z', 14)
  `).run();

  // Audit logs
  const insertLog = db.prepare(`
    INSERT INTO audit_logs (id, document_id, action, actor_name, actor_email, timestamp, ip_address, details)
    VALUES (@id, @document_id, @action, @actor_name, @actor_email, @timestamp, @ip_address, @details)
  `);
  const logs = [
    { id: 'log-101', document_id: 'doc-101', action: 'Shared', actor_name: 'Sarah Jenkins', actor_email: 'sarah.jenkins@docvault.internal', timestamp: '2026-11-10T03:45:12Z', ip_address: '192.168.1.104', details: 'Generated secure time-limited public link with watermarking enabled' },
    { id: 'log-102', document_id: 'doc-102', action: 'Downloaded', actor_name: 'Priya Sharma', actor_email: 'priya.sharma@docvault.internal', timestamp: '2026-11-09T22:15:30Z', ip_address: '172.56.21.89', details: 'Downloaded encrypted blob with decrypted key verification' },
    { id: 'log-103', document_id: 'doc-104', action: 'Metadata Updated', actor_name: 'Alex Rivera', actor_email: 'alex.rivera@docvault.internal', timestamp: '2026-11-09T18:02:11Z', ip_address: '10.0.4.12', details: 'Updated sensitivity classification from Confidential to Restricted' },
    { id: 'log-104', document_id: 'doc-103', action: 'Viewed', actor_name: 'Sarah Jenkins', actor_email: 'sarah.jenkins@docvault.internal', timestamp: '2026-11-09T14:22:45Z', ip_address: '192.168.1.104', details: 'Viewed spreadsheet via secure in-memory browser sandbox' },
    { id: 'log-105', document_id: 'doc-105', action: 'Permission Changed', actor_name: 'Sarah Jenkins', actor_email: 'sarah.jenkins@docvault.internal', timestamp: '2026-11-08T11:05:00Z', ip_address: '192.168.1.104', details: 'Granted Reviewer access to Elena Rostova Chen' },
    { id: 'log-106', document_id: 'doc-101', action: 'Created', actor_name: 'Sarah Jenkins', actor_email: 'sarah.jenkins@docvault.internal', timestamp: '2026-10-18T14:32:00Z', ip_address: '192.168.1.104', details: 'Uploaded and encrypted using client-side AES-256-GCM envelope' },
  ];
  const seedLogs = db.transaction(() => {
    for (const l of logs) insertLog.run(l);
  });
  seedLogs();

  db.prepare("INSERT INTO app_metadata (key,value) VALUES ('initial_seed_completed','1')").run();

  console.log('✅ Database seeded with initial data');
}

seedIfEmpty();

// Seed data is inserted after the schema migration on a fresh database, so
// assign its team memberships and team ownership once more after seeding.
for (const user of db.prepare('SELECT id, department, role, team_id FROM users').all() as Array<{ id: string; department: string | null; role: string; team_id: string | null }>) {
  let teamId = user.team_id;
  if (!teamId) {
    const name = user.department?.trim() || 'General Operations';
    teamId = `team-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    db.prepare('INSERT OR IGNORE INTO teams (id, name) VALUES (?, ?)').run(teamId, name);
    db.prepare('UPDATE users SET team_id=? WHERE id=?').run(teamId, user.id);
  }
  db.prepare("UPDATE users SET role='user' WHERE id=? AND role='viewer'").run(user.id);
  if (user.role === 'manager') db.prepare('UPDATE teams SET manager_id=? WHERE id=? AND manager_id IS NULL').run(user.id, teamId);
  db.prepare('INSERT OR IGNORE INTO team_memberships (team_id,user_id) VALUES (?,?)').run(teamId, user.id);
}
db.prepare(`INSERT OR IGNORE INTO team_document_access (team_id,document_id,user_id,role,status,created_by,created_at)
  SELECT p.team_id,p.document_id,m.user_id,p.role,'approved',p.created_by,p.created_at
  FROM team_document_permissions p JOIN team_memberships m ON m.team_id=p.team_id`).run();
db.prepare('UPDATE documents SET team_id=(SELECT team_id FROM users WHERE users.id=documents.owner_id) WHERE team_id IS NULL').run();

// Upgrade legacy demo credentials once; new credentials use scrypt hashes.
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};
for (const user of db.prepare('SELECT id, password_hash FROM users').all() as any[]) {
  if (user.password_hash && !String(user.password_hash).startsWith('scrypt:')) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(user.password_hash), user.id);
  }
}
db.prepare('UPDATE users SET two_factor_enabled=0').run();
for (const link of db.prepare('SELECT id, password FROM share_links WHERE password IS NOT NULL').all() as any[]) {
  if (!String(link.password).startsWith('sha256:')) {
    const hashed = `sha256:${createHash('sha256').update(link.password).digest('hex')}`;
    db.prepare('UPDATE share_links SET password=? WHERE id=?').run(hashed, link.id);
  }
}
db.prepare('UPDATE share_links SET password_protected=0 WHERE password_protected=1 AND password IS NULL').run();

// ─── Helper: row → DocumentItem ──────────────────────────────────────────────

export function rowToDocument(row: any, viewerId?: string) {
  if (!row) return null;
  const perms = db.prepare('SELECT * FROM share_permissions WHERE document_id = ?').all(row.id);
  const teamPermSql = `SELECT tda.team_id,t.name AS team_name,tda.role,tda.created_at,tda.user_id,u.name AS member_name
    FROM team_document_access tda JOIN teams t ON t.id=tda.team_id JOIN users u ON u.id=tda.user_id
    WHERE tda.document_id=? AND tda.status='approved'${viewerId ? ' AND tda.user_id=?' : ''}`;
  const teamPerms = db.prepare(teamPermSql).all(...(viewerId ? [row.id, viewerId] : [row.id])) as any[];
  const hasFileContent = !!db.prepare('SELECT 1 FROM document_blobs WHERE document_id=?').get(row.id);
  const link = db.prepare('SELECT * FROM share_links WHERE document_id = ?').get(row.id) as any;

  return {
    id: row.id,
    title: row.title,
    originalFileName: row.original_file_name,
    fileType: row.file_type,
    fileSizeBytes: row.file_size_bytes,
    category: row.category,
    tags: JSON.parse(row.tags || '[]'),
    sensitivity: row.sensitivity,
    ownerId: row.owner_id,
    teamId: row.team_id,
    hasFileContent,
    ownerName: row.owner_name,
    ownerAvatar: row.owner_avatar || '/default-avatar.svg',
    isStarred: !!row.is_starred,
    isArchived: !!row.is_archived,
    version: row.version,
    description: row.description,
    approvalStatus: row.approval_status,
    reviewerNotes: row.reviewer_notes,
    sealedBy: row.sealed_by || undefined,
    sealedAt: row.sealed_at || undefined,
    previewUrl: row.preview_url,
    textContentSample: row.text_content_sample,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sharedWith: perms.map((p: any) => ({
      userId: p.user_id,
      email: p.email,
      role: p.role,
      addedAt: p.added_at,
      expiresAt: p.expires_at,
    })),
    teamShares: teamPerms.map((p) => ({ teamId: p.team_id, teamName: p.team_name, userId: p.user_id, memberName: p.member_name, role: p.role, createdAt: p.created_at })),
    publicShareLink: link ? {
      id: link.id,
      url: link.url,
      allowDownload: !!link.allow_download,
      passwordProtected: !!link.password_protected,
      watermark: !!link.watermark,
      expiresAt: link.expires_at,
      createdAt: link.created_at,
      accessCount: link.access_count,
    } : undefined,
  };
}

export function rowToUser(row: any) {
  if (!row) return null;
  const teamIds = db.prepare('SELECT team_id FROM team_memberships WHERE user_id=? ORDER BY created_at').all(row.id).map((membership: any) => membership.team_id);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar: row.avatar || '/default-avatar.svg',
    department: row.department || '',
    teamId: row.team_id || undefined,
    teamIds,
    twoFactorEnabled: !!row.two_factor_enabled,
    storageUsedBytes: row.storage_used_bytes,
    storageLimitBytes: row.storage_limit_bytes,
    status: row.status,
    lastActive: row.last_active,
  };
}
