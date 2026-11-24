import express from 'express';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { db, rowToDocument } from '../../database/db.js';
import { decryptDocument, encryptDocument } from '../../security/crypto.js';

const router = express.Router();

function getUserFromToken(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?').get(token, new Date().toISOString()) as any;
  const user = session ? db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as any || null : null;
  return user?.status === 'active' ? user : null;
}

type DocumentAction = 'view' | 'download' | 'edit' | 'owner' | 'review';
function activeDocumentRole(documentId: string, user: any): string | null {
  if (!user) return null;
  const owner = db.prepare('SELECT owner_id FROM documents WHERE id=?').get(documentId) as any;
  if (owner?.owner_id === user.id) return 'owner';
  const permission = db.prepare(`SELECT role FROM share_permissions WHERE document_id=? AND LOWER(email)=LOWER(?) AND (expires_at IS NULL OR expires_at > ?)`)
    .get(documentId, user.email, new Date().toISOString()) as any;
  if (permission?.role) return permission.role;
  if (user.id) {
    const teamPermission = db.prepare(`SELECT tda.role FROM team_document_access tda JOIN team_memberships tm
      ON tm.team_id=tda.team_id AND tm.user_id=tda.user_id
      WHERE tda.document_id=? AND tda.user_id=? AND tda.status='approved'`).get(documentId, user.id) as any;
    if (teamPermission?.role) return teamPermission.role;
  }
  return null;
}
function isTeamDocument(documentId: string, user: any): boolean {
  if (user?.role !== 'manager') return false;
  return !!db.prepare(`SELECT d.id FROM documents d JOIN team_memberships tm ON tm.user_id=d.owner_id
    JOIN teams t ON t.id=tm.team_id WHERE d.id=? AND t.manager_id=?`).get(documentId, user.id);
}
function canAccessMetadata(documentId: string, user: any): boolean {
  return !!activeDocumentRole(documentId, user) || user?.role === 'admin' || isTeamDocument(documentId, user);
}
function canReadContent(documentId: string, user: any): boolean {
  const role = activeDocumentRole(documentId, user);
  // Admin's global access is metadata-only. An explicit document permission still applies.
  return role === 'owner' || role === 'editor' || role === 'reviewer' || role === 'viewer' || isTeamDocument(documentId, user);
}
function canDownload(documentId: string, user: any): boolean {
  if (!canReadContent(documentId, user)) return false;
  const role = activeDocumentRole(documentId, user);
  if (role === 'owner' || role === 'editor' || role === 'reviewer') return true;
  const doc = db.prepare('SELECT sensitivity FROM documents WHERE id=?').get(documentId) as any;
  return !!doc && ['Public', 'Internal'].includes(doc.sensitivity);
}

router.use((req, res, next) => {
  if (req.path.startsWith('/public/')) return next();
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  const documentId = req.path.split('/')[1];
  if (documentId && !['batch-delete', 'public', 'team-audit'].includes(documentId)) {
    const doc = db.prepare('SELECT id FROM documents WHERE id=?').get(documentId) as any;
    if (doc && !canAccessMetadata(documentId, user)) {
      return res.status(403).json({ error: 'You do not have access to this document.' });
    }
    if (doc && req.method === 'GET' && !req.path.endsWith('/download') && !canReadContent(documentId, user)) {
      res.locals.metadataOnly = true;
    }
    const delegatedActions = ['/approve', '/reject', '/seal', '/submit', '/audit', '/permanent', '/restore', '/reviewers', '/comments'];
    const isRead = req.method === 'GET';
    if (doc && !isRead && !delegatedActions.some((action) => req.path.endsWith(action)) && !req.path.includes('/reviewers/') && !req.path.endsWith('/download')) {
      const role = activeDocumentRole(documentId, user);
      if (!['owner', 'editor'].includes(role || '')) {
        return res.status(403).json({ error: 'Owner or editor permission is required for this action.' });
      }
    }
    if (doc && req.path.endsWith('/download') && !canDownload(documentId, user)) return res.status(403).json({ error: 'Download is not permitted for this document.' });
  }
  next();
});

function getClientIp(req: express.Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
}

function addAuditLog(documentId: string, action: string, actorName: string, actorEmail: string, ipAddress: string, details: string) {
  db.prepare(`
    INSERT INTO audit_logs (id, document_id, action, actor_name, actor_email, ip_address, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(`log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, documentId, action, actorName, actorEmail, ipAddress, details);
}

function notifyUser(recipientId: string | null | undefined, documentId: string, type: string, title: string, message: string) {
  if (!recipientId) return;
  db.prepare(`INSERT INTO notifications (id,recipient_user_id,document_id,type,title,message) VALUES (?,?,?,?,?,?)`)
    .run(`ntf-${randomUUID()}`, recipientId, documentId, type, title, message);
}

function notifyDocumentOwner(existing: any, type: string, title: string, message: string) {
  notifyUser(existing.owner_id, existing.id, type, title, message);
}

function getTeamManagerId(teamId: string | null) {
  return teamId ? (db.prepare('SELECT manager_id FROM teams WHERE id=?').get(teamId) as any)?.manager_id as string | undefined : undefined;
}

const sharePasswordHash = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};
const sharePasswordMatches = (password: string, saved: string | null) => {
  if (!saved) return false;
  if (saved.startsWith('scrypt:')) {
    const [, salt, hash] = saved.split(':');
    if (!salt || !hash) return false;
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  const savedHash = saved.startsWith('sha256:') ? saved.slice(7) : createHash('sha256').update(saved).digest('hex');
  const expected = Buffer.from(savedHash, 'hex');
  const actual = createHash('sha256').update(password).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

// GET /api/v1/documents
router.get('/', (req, res) => {
  const { category, query, sensitivity, fileType, tag, ownerId, starred, pending } = req.query;

  let sql = 'SELECT * FROM documents WHERE is_archived = 0';
  const params: any[] = [];

  if (category && category !== 'All') { sql += ' AND category = ?'; params.push(category); }
  if (sensitivity && sensitivity !== 'All') { sql += ' AND sensitivity = ?'; params.push(sensitivity); }
  if (fileType && fileType !== 'All') { sql += ' AND file_type = ?'; params.push((fileType as string).toLowerCase() === 'jpeg' ? 'jpg' : (fileType as string).toLowerCase()); }
  if (ownerId) { sql += ' AND owner_id = ?'; params.push(ownerId); }
  if (starred === 'true') { sql += ' AND is_starred = 1'; }
  if (pending === 'true') { sql += " AND approval_status = 'pending_review'"; }
  if (query) {
    sql += ' AND (LOWER(title) LIKE ? OR LOWER(original_file_name) LIKE ? OR LOWER(owner_name) LIKE ?)';
    const q = `%${(query as string).toLowerCase()}%`;
    params.push(q, q, q);
  }

  sql += ' ORDER BY updated_at DESC';

  const rows = db.prepare(sql).all(...params);
  const currentUser = getUserFromToken(req);
  const docs = rows.map((row: any) => rowToDocument(row, currentUser.id)).filter(Boolean).filter((doc: any) => canAccessMetadata(doc.id, currentUser)).map((doc: any) => {
    const role = activeDocumentRole(doc.id, currentUser);
    const access = { ...doc, canReadContent: canReadContent(doc.id, currentUser), canDownload: canDownload(doc.id, currentUser), isTeamDocument: isTeamDocument(doc.id, currentUser) };
    return currentUser.role === 'admin' && !role ? { ...access, textContentSample: undefined } : access;
  });

  // Filter by tag (done in JS since tags is JSON)
  const filtered = tag && tag !== 'All'
    ? docs.filter((d: any) => d.tags.includes(tag as string))
    : docs;

  res.json(filtered);
});

// GET /api/v1/documents/:id
router.get('/trash', (req, res) => {
  const user = getUserFromToken(req);
  let rows = db.prepare('SELECT * FROM documents WHERE is_archived=1 ORDER BY updated_at DESC').all() as any[];
  rows = rows.filter((row) => user.role === 'admin' || row.owner_id === user.id);
  res.json(rows.map((row: any) => rowToDocument(row, user.id)));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  const user = getUserFromToken(req);
  let doc: any = rowToDocument(row, user?.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  doc = { ...doc, canReadContent: canReadContent(req.params.id, user), canDownload: canDownload(req.params.id, user), isTeamDocument: isTeamDocument(req.params.id, user) };
  if (res.locals.metadataOnly) doc = { ...doc, textContentSample: undefined, previewUrl: undefined };
  res.json(doc);
});

const previewMimeTypes: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain; charset=utf-8',
};

router.get('/:id/preview', (req, res) => {
  const id = req.params.id;
  const doc = db.prepare('SELECT * FROM documents WHERE id=? AND is_archived=0').get(id) as any;
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  const blob = db.prepare('SELECT * FROM document_blobs WHERE document_id=?').get(id) as any;
  if (!blob) return res.status(404).json({ error: 'The original file is not stored for this document.' });
  try {
    const content = decryptDocument(blob);
    const extension = String(doc.file_type || '').toLowerCase();
    res.setHeader('Content-Type', previewMimeTypes[extension] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.original_file_name)}`);
    res.setHeader('Content-Length', content.length);
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    const user = getUserFromToken(req);
    addAuditLog(id, 'Viewed', user?.name || 'Unknown', user?.email || '', getClientIp(req), `Previewed ${doc.original_file_name}`);
    return res.send(content);
  } catch {
    return res.status(422).json({ error: 'The stored file could not be authenticated or decrypted.' });
  }
});

router.get('/:id/comments', (req, res) => {
  const user = getUserFromToken(req);
  if (!canReadContent(req.params.id, user)) return res.status(403).json({ error: 'Document content access is required to view comments.' });
  const rows = db.prepare('SELECT id,user_id AS userId,author_name AS authorName,body,created_at AS createdAt FROM document_comments WHERE document_id=? ORDER BY created_at ASC')
    .all(req.params.id);
  res.json(rows);
});

router.post('/:id/comments', (req, res) => {
  const user = getUserFromToken(req);
  if (!canReadContent(req.params.id, user)) return res.status(403).json({ error: 'Document access is required to comment.' });
  const body = String(req.body.body || '').trim();
  if (!body || body.length > 4000) return res.status(400).json({ error: 'A comment must contain between 1 and 4000 characters.' });
  const id = `comment-${randomUUID()}`;
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO document_comments (id,document_id,user_id,author_name,body,created_at) VALUES (?,?,?,?,?,?)')
    .run(id, req.params.id, user.id, user.name, body, createdAt);
  addAuditLog(req.params.id, 'Commented', user.name, user.email, getClientIp(req), 'Added a document comment');
  res.status(201).json({ id, userId: user.id, authorName: user.name, body, createdAt });
});

// POST /api/v1/documents
router.post('/', (req, res) => {
  const user = getUserFromToken(req);
  const body = req.body;
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  if (typeof body.title !== 'string' || !body.title.trim() || typeof body.originalFileName !== 'string' || !body.originalFileName.trim() || !body.fileType || !Number.isFinite(body.fileSizeBytes)) {
    return res.status(400).json({ error: 'Required document metadata is missing.' });
  }
  if (body.title.trim().length > 240 || body.originalFileName.length > 255 || !Number.isInteger(body.fileSizeBytes) || body.fileSizeBytes <= 0) return res.status(400).json({ error: 'Document metadata exceeds allowed limits.' });
  if (!['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg', 'zip', 'txt'].includes(String(body.fileType).toLowerCase())) return res.status(400).json({ error: 'Unsupported file type.' });
  if (!['Public', 'Internal', 'Confidential', 'Restricted'].includes(body.sensitivity)) return res.status(400).json({ error: 'Invalid document sensitivity.' });
  const categories = ['Legal & Contracts', 'Financial & Tax', 'Security & Compliance', 'Human Resources', 'Engineering & Tech', 'Marketing & Sales', 'Operations'];
  if (!categories.includes(body.category)) return res.status(400).json({ error: 'Invalid document category.' });
  if (body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.length > 30 || body.tags.some((tag: unknown) => typeof tag !== 'string' || tag.length > 40))) return res.status(400).json({ error: 'Tags must be a list of at most 30 short strings.' });
  if (body.fileSizeBytes > 50 * 1024 * 1024) return res.status(413).json({ error: 'Maximum file size is 50 MB.' });
  if (!body.fileContentBase64) return res.status(400).json({ error: 'File content is required.' });
  const fileBytes = Buffer.from(body.fileContentBase64, 'base64');
  if (fileBytes.length !== body.fileSizeBytes) return res.status(400).json({ error: 'File content size does not match metadata.' });
  const actualHash = createHash('sha256').update(fileBytes).digest('hex');
  if (body.sha256Hash && body.sha256Hash !== actualHash) return res.status(400).json({ error: 'File integrity check failed.' });
  const encrypted = encryptDocument(fileBytes);
  const newId = `doc-${randomUUID()}`;
  const now = new Date().toISOString();
  const managedTeam = db.prepare(`SELECT t.id FROM team_memberships tm JOIN teams t ON t.id=tm.team_id
    WHERE tm.user_id=? AND t.manager_id IS NOT NULL ORDER BY CASE WHEN t.manager_id=? THEN 0 ELSE 1 END,tm.created_at LIMIT 1`)
    .get(user.id, user.id) as any;
  const documentTeamId = managedTeam?.id || user.team_id || null;
  const requiresReview = user.role === 'user' && !!managedTeam;
  const initialApprovalStatus = requiresReview ? 'pending_review' : 'approved';
  const initialSealedBy = user.role === 'manager' || user.role === 'admin' ? user.id : null;
  const initialSealedAt = initialSealedBy ? now : null;

  const persistDocument = db.transaction(() => {
  db.prepare(`
    INSERT INTO documents (id, title, original_file_name, file_type, file_size_bytes, category, tags, sensitivity, encryption_algorithm, sha256_hash, owner_id, owner_name, owner_avatar, team_id, is_starred, is_archived, version, description, approval_status, sealed_by, sealed_at, text_content_sample, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId, body.title.trim(), body.originalFileName, String(body.fileType).toLowerCase() === 'jpeg' ? 'jpg' : String(body.fileType).toLowerCase(), body.fileSizeBytes,
    body.category, JSON.stringify(body.tags || []), body.sensitivity,
    'AES-256-GCM',
    actualHash,
    user.id, user.name, user.avatar || '', documentTeamId,
    body.description || '',
    initialApprovalStatus, initialSealedBy, initialSealedAt,
    body.textContentSample || '', now, now
  );

  db.prepare(`INSERT INTO document_blobs
    (document_id,iv,ciphertext,auth_tag,wrapped_key,key_iv,key_auth_tag,encryption_version,key_version)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(newId, encrypted.iv, encrypted.ciphertext, encrypted.authTag,
      encrypted.wrappedKey, encrypted.keyIv, encrypted.keyAuthTag, encrypted.encryptionVersion, encrypted.keyVersion);
  });

  // Keep metadata and encrypted bytes in sync if either write fails.
  persistDocument();

  const actorName = user?.name || body.ownerName || 'Unknown';
  const actorEmail = user?.email || body.ownerEmail || '';
  addAuditLog(newId, 'Created', actorName, actorEmail, getClientIp(req), `Uploaded and encrypted ${body.title} (${body.encryptionAlgorithm || 'AES-256-GCM'})`);
  if (requiresReview) {
    notifyUser(getTeamManagerId(documentTeamId), newId, 'member_upload', 'New team document', `${user.name} uploaded “${body.title}” and it is awaiting review.`);
  } else if ((user.role === 'manager' || user.role === 'admin') && documentTeamId) {
    const members = db.prepare('SELECT user_id FROM team_memberships WHERE team_id=? AND user_id<>?').all(documentTeamId, user.id) as Array<{ user_id: string }>;
    for (const member of members) notifyUser(member.user_id, newId, 'manager_upload', 'New team document', `${user.name} shared “${body.title}” with the team.`);
  }

  const doc = rowToDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(newId), user.id);
  res.status(201).json(doc);
});

// PATCH /api/v1/documents/:id
router.patch('/:id', (req, res) => {
  const user = getUserFromToken(req);
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
  if (!existing) return res.status(404).json({ error: 'Document not found.' });
  const body = req.body;
  const now = new Date().toISOString();
  const role = activeDocumentRole(id, user);
  if (body.sensitivity !== undefined && role !== 'owner') return res.status(403).json({ error: 'Only the document owner can change its classification.' });
  if (body.approvalStatus !== undefined || body.isArchived !== undefined) return res.status(400).json({ error: 'Use the dedicated workflow action for approval or trash.' });

  const fields: string[] = [];
  const values: any[] = [];

  if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
  if (body.category !== undefined) { fields.push('category = ?'); values.push(body.category); }
  if (body.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(body.tags)); }
  if (body.sensitivity !== undefined) { fields.push('sensitivity = ?'); values.push(body.sensitivity); }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
  if (body.isStarred !== undefined) { fields.push('is_starred = ?'); values.push(body.isStarred ? 1 : 0); }

  if (fields.length > 0) {
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);
    db.prepare(`UPDATE documents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  const actorName = user?.name || 'Unknown';
  const actorEmail = user?.email || '';
  addAuditLog(id, 'Metadata Updated', actorName, actorEmail, getClientIp(req), 'Document metadata or classification modified');

  const doc = rowToDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(id), user.id);
  res.json(doc);
});

// DELETE /api/v1/documents/:id
router.delete('/:id', (req, res) => {
  const user = getUserFromToken(req);
  const { id } = req.params;
  if (activeDocumentRole(id, user) !== 'owner') return res.status(403).json({ error: 'Only the owner can move this document to the trash.' });
  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
  if (!existing) return res.status(404).json({ error: 'Document not found.' });

  db.prepare('UPDATE documents SET is_archived=1, updated_at=? WHERE id=?').run(new Date().toISOString(), id);
  addAuditLog(id, 'Archived', user.name, user.email, getClientIp(req), `Document "${existing.title}" moved to trash`);
  res.json({ success: true, trashed: true });
});

router.post('/:id/restore', (req, res) => {
  const user = getUserFromToken(req);
  if (activeDocumentRole(req.params.id, user) !== 'owner') return res.status(403).json({ error: 'Only the owner can restore this document.' });
  const result = db.prepare('UPDATE documents SET is_archived=0, updated_at=? WHERE id=?').run(new Date().toISOString(), req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Document not found in trash.' });
  addAuditLog(req.params.id, 'Metadata Updated', user.name, user.email, getClientIp(req), 'Document restored from trash');
  res.json(rowToDocument(db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id), user.id));
});

router.delete('/:id/permanent', (req, res) => {
  const user = getUserFromToken(req);
  if (user.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required for permanent deletion.' });
  const existing = db.prepare('SELECT * FROM documents WHERE id=? AND is_archived=1').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Move the document to trash before permanent deletion.' });
  addAuditLog(req.params.id, 'Deleted', user.name, user.email, getClientIp(req), `Document "${existing.title}" permanently deleted by an administrator`);
  db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id);
  res.json({ success: true, permanentlyDeleted: true });
});

router.post('/:id/submit', (req, res) => {
  const user = getUserFromToken(req);
  if (!['owner', 'editor'].includes(activeDocumentRole(req.params.id, user) || '')) return res.status(403).json({ error: 'Owner or editor permission is required to submit this document.' });
  db.prepare("UPDATE documents SET approval_status='pending_review', reviewer_notes=NULL, updated_at=? WHERE id=?")
    .run(new Date().toISOString(), req.params.id);
  addAuditLog(req.params.id, 'Metadata Updated', user.name, user.email, getClientIp(req), 'Document submitted for approval');
  res.json(rowToDocument(db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id), user.id));
});

router.post('/:id/reviewers', (req, res) => {
  const user = getUserFromToken(req);
  const doc = db.prepare('SELECT team_id,owner_id FROM documents WHERE id=?').get(req.params.id) as any;
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  const managesDocumentTeam = !!db.prepare('SELECT 1 FROM teams WHERE id=? AND manager_id=?').get(doc.team_id, user.id);
  if (user.role !== 'admin' && !managesDocumentTeam) {
    return res.status(403).json({ error: 'Only an administrator or this team’s manager can designate reviewers.' });
  }
  const email = String(req.body.email || '').trim().toLowerCase();
  const reviewer = db.prepare(`SELECT u.id,u.email,u.status FROM users u JOIN team_memberships tm ON tm.user_id=u.id
    WHERE tm.team_id=? AND LOWER(u.email)=?`).get(doc.team_id, email) as any;
  if (!reviewer || reviewer.status !== 'active' || reviewer.id === doc.owner_id) return res.status(400).json({ error: 'Choose an active member of this document’s team other than its owner.' });
  db.prepare("INSERT INTO share_permissions (document_id,user_id,email,role) VALUES (?,?,?,'reviewer') ON CONFLICT(document_id,email) DO UPDATE SET user_id=excluded.user_id,role='reviewer'")
    .run(req.params.id, reviewer.id, reviewer.email);
  addAuditLog(req.params.id, 'Permission Changed', user.name, user.email, getClientIp(req), `Designated ${email} as document reviewer`);
  notifyUser(reviewer.id, req.params.id, 'review_requested', 'Review requested', `${user.name} asked you to review “${(db.prepare('SELECT title FROM documents WHERE id=?').get(req.params.id) as any)?.title || 'a document'}”.`);
  res.json({ success: true, email: reviewer.email, role: 'reviewer' });
});

router.delete('/:id/reviewers/:email', (req, res) => {
  const user = getUserFromToken(req);
  const doc = db.prepare('SELECT team_id FROM documents WHERE id=?').get(req.params.id) as any;
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  const managesDocumentTeam = !!db.prepare('SELECT 1 FROM teams WHERE id=? AND manager_id=?').get(doc.team_id, user.id);
  if (user.role !== 'admin' && !managesDocumentTeam) return res.status(403).json({ error: 'Only this team’s manager can remove a reviewer.' });
  const email = decodeURIComponent(req.params.email).trim().toLowerCase();
  const result = db.prepare("DELETE FROM share_permissions WHERE document_id=? AND LOWER(email)=? AND role='reviewer'").run(req.params.id, email);
  if (!result.changes) return res.status(404).json({ error: 'Reviewer assignment not found.' });
  addAuditLog(req.params.id, 'Permission Changed', user.name, user.email, getClientIp(req), `Removed ${email} as document reviewer`);
  res.json({ success: true });
});

// POST /api/v1/documents/batch-delete
router.post('/batch-delete', (req, res) => {
  const user = getUserFromToken(req);
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || ids.some((id) => typeof id !== 'string')) return res.status(400).json({ error: 'Provide between 1 and 100 document IDs.' });
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  const uniqueIds = [...new Set(ids)];
  const owned = db.prepare(`SELECT COUNT(*) as count FROM documents WHERE id IN (${uniqueIds.map(() => '?').join(',')}) AND owner_id=? AND is_archived=0`).get(...uniqueIds, user.id) as any;
  if (owned.count !== uniqueIds.length) return res.status(403).json({ error: 'You can only move documents you own to the trash.' });

  const actorName = user?.name || 'Unknown';
  const actorEmail = user?.email || '';

  const trashTx = db.transaction(() => {
    for (const id of uniqueIds) {
      addAuditLog(id, 'Archived', actorName, actorEmail, getClientIp(req), 'Document moved to trash in a batch action');
      db.prepare('UPDATE documents SET is_archived=1,updated_at=? WHERE id=?').run(new Date().toISOString(), id);
    }
  });
  trashTx();
  res.json({ success: true, trashed: uniqueIds.length });
});

// POST /api/v1/documents/:id/star
router.post('/:id/star', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT is_starred FROM documents WHERE id = ?').get(id) as any;
  if (!existing) return res.status(404).json({ error: 'Document not found.' });
  const newStarred = existing.is_starred ? 0 : 1;
  db.prepare('UPDATE documents SET is_starred = ?, updated_at = ? WHERE id = ?').run(newStarred, new Date().toISOString(), id);
  res.json({ isStarred: !!newStarred });
});

// POST /api/v1/documents/:id/share (generate public link)
router.post('/:id/share', (req, res) => {
  const user = getUserFromToken(req);
  const { id } = req.params;
  const { allowDownload, passwordProtected, password, watermark, expiresInDays } = req.body;

  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Document not found.' });
  if (activeDocumentRole(id, user) !== 'owner') return res.status(403).json({ error: 'Only the document owner can create a public link.' });
  if (passwordProtected && String(password || '').trim().length < 12) return res.status(400).json({ error: 'The share passphrase must be at least 12 characters.' });
  const days = Number(expiresInDays || 7);
  if (!Number.isFinite(days) || days < 1 || days > 365) return res.status(400).json({ error: 'Link expiry must be between 1 and 365 days.' });

  // Remove old link if exists
  db.prepare('DELETE FROM share_links WHERE document_id = ?').run(id);

  const linkId = `lnk-${randomBytes(24).toString('hex')}`;
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl.replace(/\/$/, '')}/#/s/${linkId}`;

  db.prepare(`
    INSERT INTO share_links (id, document_id, url, allow_download, password_protected, password, watermark, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(linkId, id, url, allowDownload ? 1 : 0, passwordProtected ? 1 : 0, passwordProtected ? sharePasswordHash(String(password)) : null, watermark ? 1 : 0, expiresAt);

  const actorName = user?.name || 'Unknown';
  const actorEmail = user?.email || '';
  addAuditLog(id, 'Shared', actorName, actorEmail, getClientIp(req), `Created secure link (Password: ${passwordProtected ? 'Yes' : 'No'}, Watermark: ${watermark ? 'Yes' : 'No'})`);

  const link = db.prepare('SELECT * FROM share_links WHERE id = ?').get(linkId) as any;
  res.json({
    id: link.id, url: link.url, allowDownload: !!link.allow_download,
    passwordProtected: !!link.password_protected,
    watermark: !!link.watermark, expiresAt: link.expires_at,
    createdAt: link.created_at, accessCount: 0,
  });
});

// Public share preview; secrets are validated here and never returned to callers.
router.post('/public/:linkId', (req, res) => {
  const link = db.prepare('SELECT * FROM share_links WHERE id=?').get(req.params.linkId) as any;
  if (!link || (link.expires_at && Date.parse(link.expires_at) < Date.now())) return res.status(404).json({ error: 'This share link is unavailable or expired.' });
  if (link.password_protected && !sharePasswordMatches(String(req.body.password || ''), link.password)) return res.status(401).json({ error: 'A valid passphrase is required.' });
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(link.document_id) as any;
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  res.json({ id: link.id, title: doc.title, fileName: doc.original_file_name, fileType: doc.file_type,
    fileSizeBytes: doc.file_size_bytes, description: doc.description, allowDownload: !!link.allow_download,
    watermark: !!link.watermark, ownerName: doc.owner_name });
});

router.post('/public/:linkId/download', (req, res) => {
  const link = db.prepare('SELECT * FROM share_links WHERE id=?').get(req.params.linkId) as any;
  if (!link || !link.allow_download || (link.expires_at && Date.parse(link.expires_at) < Date.now())) return res.status(404).json({ error: 'Download is unavailable or link expired.' });
  if (link.password_protected && !sharePasswordMatches(String(req.body.password || ''), link.password)) return res.status(401).json({ error: 'A valid passphrase is required.' });
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(link.document_id) as any;
  const blob = db.prepare('SELECT * FROM document_blobs WHERE document_id=?').get(link.document_id) as any;
  if (!doc || !blob) return res.status(404).json({ error: 'File content is unavailable.' });
  const plaintext = decryptDocument(blob);
  db.prepare('UPDATE share_links SET access_count=access_count+1 WHERE id=?').run(link.id);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.original_file_name)}`);
  res.send(plaintext);
});

// DELETE /api/v1/documents/:id/share (revoke link)
router.delete('/:id/share', (req, res) => {
  const user = getUserFromToken(req);
  const { id } = req.params;
  if (activeDocumentRole(id, user) !== 'owner') return res.status(403).json({ error: 'Only the document owner can revoke a public link.' });
  db.prepare('DELETE FROM share_links WHERE document_id = ?').run(id);

  const actorName = user?.name || 'Unknown';
  const actorEmail = user?.email || '';
  addAuditLog(id, 'Shared', actorName, actorEmail, getClientIp(req), 'Public share link revoked immediately');

  res.json({ success: true });
});

// POST /api/v1/documents/:id/collaborators
router.post('/:id/collaborators', (req, res) => {
  const user = getUserFromToken(req);
  const { id } = req.params;
  const { email, role } = req.body;
  if (activeDocumentRole(id, user) !== 'owner') return res.status(403).json({ error: 'Only the document owner can change permissions.' });
  if (!['viewer', 'editor'].includes(role)) return res.status(400).json({ error: 'Choose viewer or editor; reviewers are designated by the team manager.' });
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ error: 'A valid collaborator email is required.' });
  const collaborator = db.prepare("SELECT id,status FROM users WHERE LOWER(email)=?").get(normalizedEmail) as any;
  if (!collaborator || collaborator.status !== 'active') return res.status(400).json({ error: 'Collaborators must be active members of this workspace.' });

  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Document not found.' });

  // Upsert
  db.prepare('DELETE FROM share_permissions WHERE document_id = ? AND LOWER(email) = LOWER(?)').run(id, normalizedEmail);
  db.prepare(`
    INSERT INTO share_permissions (document_id,user_id, email, role) VALUES (?, ?, ?, ?)
  `).run(id, collaborator.id, normalizedEmail, role);

  const actorName = user?.name || 'Unknown';
  const actorEmail = user?.email || '';
  addAuditLog(id, 'Permission Changed', actorName, actorEmail, getClientIp(req), `Granted ${role.toUpperCase()} access to ${normalizedEmail}`);

  res.json({ success: true, email: normalizedEmail, role });
});

// DELETE /api/v1/documents/:id/collaborators/:email
router.delete('/:id/collaborators/:email', (req, res) => {
  const user = getUserFromToken(req);
  const { id, email } = req.params;
  if (activeDocumentRole(id, user) !== 'owner') return res.status(403).json({ error: 'Only the document owner can change permissions.' });
  db.prepare('DELETE FROM share_permissions WHERE document_id = ? AND LOWER(email) = LOWER(?) AND role != \'reviewer\'').run(id, email);

  const actorName = user?.name || 'Unknown';
  const actorEmail = user?.email || '';
  addAuditLog(id, 'Permission Changed', actorName, actorEmail, getClientIp(req), `Revoked access for ${email}`);

  res.json({ success: true });
});

// POST /api/v1/documents/:id/approve
router.post('/:id/approve', (req, res) => {
  const user = getUserFromToken(req);
  if (!user || activeDocumentRole(req.params.id, user) !== 'reviewer') return res.status(403).json({ error: 'Only a designated reviewer can approve this document.' });
  const { id } = req.params;
  const { notes } = req.body;

  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
  if (!existing) return res.status(404).json({ error: 'Document not found.' });
  if (existing.owner_id === user.id) return res.status(403).json({ error: 'Owners cannot approve their own documents.' });
  if (existing.approval_status !== 'pending_review') return res.status(409).json({ error: 'Only documents awaiting review can be approved.' });

  const now = new Date().toISOString();
  db.prepare("UPDATE documents SET approval_status = 'pending_manager_seal', reviewer_notes = ?, updated_at = ? WHERE id = ?")
    .run(notes || 'Reviewer approved; awaiting manager seal', now, id);

  const actorName = user?.name || 'Unknown';
  const actorEmail = user?.email || '';
  addAuditLog(id, 'Metadata Updated', actorName, actorEmail, getClientIp(req), `Reviewer approved document "${existing.title}"; awaiting manager seal`);
  notifyUser(getTeamManagerId(existing.team_id), id, 'review_approved', 'Review completed', `${user.name} approved “${existing.title}”. It is ready for your decision.`);

  const doc = rowToDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(id), user.id);
  res.json(doc);
});

router.post('/:id/seal', (req, res) => {
  const user = getUserFromToken(req);
  if (!user || !['manager', 'admin'].includes(user.role)) return res.status(403).json({ error: 'Only a manager or administrator can seal a reviewed document.' });
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM documents WHERE id=?').get(id) as any;
  if (!existing) return res.status(404).json({ error: 'Document not found.' });
  const managesTeam = !!db.prepare('SELECT 1 FROM teams WHERE id=? AND manager_id=?').get(existing.team_id, user.id);
  if (user.role !== 'admin' && !managesTeam) return res.status(403).json({ error: 'Only the manager of this document’s team can seal it.' });
  if (existing.approval_status !== 'pending_manager_seal') return res.status(409).json({ error: 'Only documents approved by a reviewer can be sealed.' });

  const sealedAt = new Date().toISOString();
  db.prepare("UPDATE documents SET approval_status='approved',sealed_by=?,sealed_at=?,updated_at=? WHERE id=?")
    .run(user.id, sealedAt, sealedAt, id);
  addAuditLog(id, 'Metadata Updated', user.name, user.email, getClientIp(req), `Document "${existing.title}" sealed by manager`);
  notifyDocumentOwner(existing, 'document_sealed', 'Document approved', `${user.name} approved and sealed “${existing.title}”.`);
  res.json(rowToDocument(db.prepare('SELECT * FROM documents WHERE id=?').get(id), user.id));
});

// POST /api/v1/documents/:id/reject
router.post('/:id/reject', (req, res) => {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  const { id } = req.params;
  const { reason } = req.body;

  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
  if (!existing) return res.status(404).json({ error: 'Document not found.' });
  const reviewerCanReject = activeDocumentRole(id, user) === 'reviewer' && existing.approval_status === 'pending_review' && existing.owner_id !== user.id;
  const managesTeam = !!db.prepare('SELECT 1 FROM teams WHERE id=? AND manager_id=?').get(existing.team_id, user.id);
  const managerCanReject = ['manager', 'admin'].includes(user.role) && existing.approval_status === 'pending_manager_seal' && (user.role === 'admin' || managesTeam);
  if (!reviewerCanReject && !managerCanReject) return res.status(403).json({ error: 'Reviewers can reject during review; the team manager can reject after reviewer approval.' });

  const now = new Date().toISOString();
  db.prepare("UPDATE documents SET approval_status = 'rejected', reviewer_notes = ?, updated_at = ? WHERE id = ?")
    .run(reason || 'Rejected', now, id);

  const actorName = user?.name || 'Unknown';
  const actorEmail = user?.email || '';
  const decisionBy = managerCanReject ? 'manager' : 'reviewer';
  addAuditLog(id, 'Metadata Updated', actorName, actorEmail, getClientIp(req), `Document "${existing.title}" rejected by ${decisionBy}: ${reason}`);
  if (decisionBy === 'reviewer') {
    notifyUser(getTeamManagerId(existing.team_id), id, 'review_rejected', 'Reviewer rejected a document', `${user.name} rejected “${existing.title}”.`);
    notifyDocumentOwner(existing, 'document_rejected', 'Document rejected', `${user.name} rejected “${existing.title}” during review.`);
  } else {
    notifyDocumentOwner(existing, 'document_rejected', 'Document rejected', `${user.name} rejected “${existing.title}”.`);
  }

  const doc = rowToDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(id), user.id);
  res.json(doc);
});

// POST /api/v1/documents/:id/download (log download)
router.post('/:id/download', (req, res) => {
  const user = getUserFromToken(req);
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
  if (!existing) return res.status(404).json({ error: 'Document not found.' });
  const blob = db.prepare('SELECT * FROM document_blobs WHERE document_id=?').get(id) as any;
  if (!blob) return res.status(404).json({ error: 'File content is unavailable.' });
  const plaintext = decryptDocument(blob);

  const actorName = user?.name || 'Unknown';
  const actorEmail = user?.email || '';
  addAuditLog(id, 'Downloaded', actorName, actorEmail, getClientIp(req), `Decrypted and downloaded ${existing.original_file_name}`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(existing.original_file_name)}`);
  res.setHeader('Content-Length', plaintext.length);
  res.send(plaintext);
});

// POST /api/v1/documents/:id/audit (log view)
router.post('/:id/audit', (req, res) => {
  const user = getUserFromToken(req);
  const { id } = req.params;
  const { action, details } = req.body;

  const actorName = user?.name || 'Unknown';
  const actorEmail = user?.email || '';
  addAuditLog(id, action || 'Viewed', actorName, actorEmail, getClientIp(req), details || 'Document accessed');
  res.json({ success: true });
});

export default router;
