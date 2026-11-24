import express from 'express';
import { randomUUID } from 'crypto';
import { db, rowToUser } from '../../database/db.js';

const router = express.Router();

function getUserFromToken(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?').get(token, new Date().toISOString()) as any;
  const user = session ? db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as any || null : null;
  return user?.status === 'active' ? user : null;
}

router.use((req, res, next) => {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  res.locals.user = user;
  next();
});

function requireAdmin(req: express.Request, res: express.Response): boolean {
  if (res.locals.user?.role === 'admin') return true;
  res.status(403).json({ error: 'Administrator access required.' });
  return false;
}

function canManageTeam(teamId: string, user: any): boolean {
  if (user?.role === 'admin') return true;
  const team = db.prepare('SELECT manager_id FROM teams WHERE id=?').get(teamId) as any;
  return user?.role === 'manager' && team?.manager_id === user.id;
}

function addTeamShareAudit(documentId: string, action: string, user: any, details: string, ipAddress: string) {
  db.prepare(`INSERT INTO audit_logs (id,document_id,action,actor_name,actor_email,ip_address,details)
    VALUES (?,?,?,?,?,?,?)`).run(`log-${randomUUID()}`, documentId, action, user.name, user.email, ipAddress, details);
}

router.get('/notifications', (req, res) => {
  const user = res.locals.user;
  const rows = db.prepare(`SELECT id,document_id AS documentId,type,title,message,is_read AS isRead,created_at AS createdAt
    FROM notifications WHERE recipient_user_id=? ORDER BY created_at DESC LIMIT 50`).all(user.id) as any[];
  const unreadCount = (db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE recipient_user_id=? AND is_read=0').get(user.id) as any).count;
  res.json({ notifications: rows.map((row) => ({ ...row, isRead: !!row.isRead })), unreadCount });
});

router.patch('/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE recipient_user_id=?').run(res.locals.user.id);
  res.json({ success: true });
});

router.patch('/notifications/:notificationId/read', (req, res) => {
  const result = db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND recipient_user_id=?').run(req.params.notificationId, res.locals.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Notification not found.' });
  res.json({ success: true });
});

router.post('/teams', (req, res) => {
  const user = res.locals.user;
  if (!['admin', 'manager'].includes(user.role)) return res.status(403).json({ error: 'Only a manager or administrator can create a team.' });
  const name = String(req.body.name || '').trim();
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Team name must contain 2 to 80 characters.' });
  if (db.prepare('SELECT id FROM teams WHERE LOWER(name)=LOWER(?)').get(name)) return res.status(409).json({ error: 'A team with this name already exists.' });
  const managerId = user.role === 'manager' ? user.id : String(req.body.managerId || '');
  if (managerId) {
    const manager = db.prepare("SELECT id,role,status FROM users WHERE id=?").get(managerId) as any;
    if (!manager || manager.role !== 'manager' || manager.status !== 'active') return res.status(400).json({ error: 'Choose an active manager to lead this team.' });
  }
  const id = `team-${randomUUID()}`;
  db.transaction(() => {
    db.prepare('INSERT INTO teams (id,name,manager_id) VALUES (?,?,?)').run(id, name, managerId || null);
    if (managerId) {
      db.prepare('INSERT INTO team_memberships (team_id,user_id) VALUES (?,?)').run(id, managerId);
      db.prepare('UPDATE users SET team_id=? WHERE id=? AND team_id IS NULL').run(id, managerId);
    }
  })();
  res.status(201).json({ id, name, managerId: managerId || null, memberCount: managerId ? 1 : 0 });
});

router.delete('/teams/:teamId', (req, res) => {
  const teamId = req.params.teamId;
  if (!canManageTeam(teamId, res.locals.user)) return res.status(403).json({ error: 'Only this team’s manager or an administrator can delete it.' });
  const team = db.prepare('SELECT id FROM teams WHERE id=?').get(teamId);
  if (!team) return res.status(404).json({ error: 'Team not found.' });
  const documents = db.prepare('SELECT id FROM documents WHERE team_id=?').all(teamId) as Array<{ id: string }>;
  db.transaction(() => {
    db.prepare('DELETE FROM teams WHERE id=?').run(teamId);
    const reassign = db.prepare(`UPDATE documents SET team_id=(SELECT team_id FROM team_memberships
      WHERE user_id=documents.owner_id ORDER BY created_at,team_id LIMIT 1) WHERE id=?`);
    for (const document of documents) reassign.run(document.id);
  })();
  res.json({ success: true, teamId });
});

router.delete('/teams/:teamId/documents', (req, res) => {
  const teamId = req.params.teamId;
  if (!canManageTeam(teamId, res.locals.user)) return res.status(403).json({ error: 'Only this team’s manager or an administrator can delete its documents.' });
  const documentIds = db.prepare(`SELECT id FROM documents WHERE team_id=? OR owner_id IN
    (SELECT user_id FROM team_memberships WHERE team_id=?)`).all(teamId, teamId) as Array<{ id: string }>;
  if (documentIds.length === 0) return res.json({ success: true, deletedCount: 0 });
  db.transaction(() => {
    const remove = db.prepare('DELETE FROM documents WHERE id=?');
    for (const document of documentIds) remove.run(document.id);
  })();
  res.json({ success: true, deletedCount: documentIds.length });
});

router.get('/teams/:teamId/available-members', (req, res) => {
  const teamId = req.params.teamId;
  if (!canManageTeam(teamId, res.locals.user)) return res.status(403).json({ error: 'You cannot manage this team.' });
  const members = db.prepare("SELECT u.id,u.name,u.email,u.team_id FROM users u WHERE u.status='active' AND u.role='user' AND NOT EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.user_id=u.id AND tm.team_id=?) ORDER BY u.name").all(teamId);
  res.json(members);
});

router.post('/teams/:teamId/members', (req, res) => {
  const teamId = req.params.teamId;
  if (!canManageTeam(teamId, res.locals.user)) return res.status(403).json({ error: 'You cannot manage this team.' });
  const userId = String(req.body.userId || '');
  const member = db.prepare("SELECT id,role,status FROM users WHERE id=?").get(userId) as any;
  if (!member || member.role !== 'user' || member.status !== 'active') return res.status(400).json({ error: 'Choose an active standard user.' });
  db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO team_memberships (team_id,user_id) VALUES (?,?)').run(teamId, userId);
    db.prepare('UPDATE users SET team_id=(SELECT team_id FROM team_memberships WHERE user_id=? ORDER BY created_at,team_id LIMIT 1) WHERE id=? AND team_id IS NULL').run(userId, userId);
  })();
  res.status(200).json({ success: true, userId });
});

router.delete('/teams/:teamId/members/:userId', (req, res) => {
  const teamId = req.params.teamId;
  if (!canManageTeam(teamId, res.locals.user)) return res.status(403).json({ error: 'You cannot manage this team.' });
  const memberId = req.params.userId;
  const membership = db.prepare("SELECT 1 FROM team_memberships WHERE user_id=? AND team_id=? AND user_id IN (SELECT id FROM users WHERE role='user')").get(memberId, teamId);
  if (!membership) return res.status(404).json({ error: 'Team member not found.' });
  db.transaction(() => {
    db.prepare('DELETE FROM team_memberships WHERE user_id=? AND team_id=?').run(memberId, teamId);
    db.prepare("UPDATE team_document_access SET status='revoked',updated_at=datetime('now') WHERE team_id=? AND user_id=?").run(teamId, memberId);
    db.prepare("UPDATE team_document_share_requests SET status='revoked',reviewed_at=datetime('now') WHERE team_id=? AND requester_id=? AND status='pending'").run(teamId, memberId);
    db.prepare(`UPDATE documents SET team_id=(SELECT team_id FROM team_memberships WHERE user_id=? ORDER BY created_at,team_id LIMIT 1)
      WHERE owner_id=? AND team_id=?`).run(memberId, memberId, teamId);
  })();
  db.prepare(`UPDATE users SET team_id=(SELECT team_id FROM team_memberships WHERE user_id=? ORDER BY created_at,team_id LIMIT 1)
    WHERE id=? AND team_id=?`).run(memberId, memberId, teamId);
  res.json({ success: true });
});

router.get('/teams/:teamId/document-shares', (req, res) => {
  const teamId = req.params.teamId;
  const user = res.locals.user;
  const member = db.prepare('SELECT 1 FROM team_memberships WHERE team_id=? AND user_id=?').get(teamId, user.id);
  if (!canManageTeam(teamId, user) && !member) return res.status(403).json({ error: 'You are not a member of this team.' });
  const manager = canManageTeam(teamId, user);
  const shares = db.prepare(`SELECT a.document_id AS documentId,a.user_id AS userId,a.role,a.status,a.created_at AS createdAt,
      d.title,d.original_file_name AS originalFileName,d.sensitivity,d.owner_name AS ownerName,u.name AS memberName
    FROM team_document_access a JOIN documents d ON d.id=a.document_id JOIN users u ON u.id=a.user_id
    WHERE a.team_id=? AND (?=1 OR a.user_id=?) ORDER BY d.title,u.name`).all(teamId, manager ? 1 : 0, user.id);
  const requests = db.prepare(`SELECT r.id,r.document_id AS documentId,r.requester_id AS requesterId,r.requested_role AS requestedRole,
      r.status,r.created_at AS createdAt,d.title,d.owner_name AS ownerName,u.name AS requesterName
    FROM team_document_share_requests r JOIN documents d ON d.id=r.document_id JOIN users u ON u.id=r.requester_id
    WHERE r.team_id=? AND (?=1 AND r.status='pending' OR ?=0 AND r.requester_id=?) ORDER BY r.created_at DESC`).all(teamId, manager ? 1 : 0, manager ? 1 : 0, user.id);
  res.json({ shares, requests });
});

router.put('/teams/:teamId/document-shares/:documentId', (req, res) => {
  const { teamId, documentId } = req.params;
  const user = res.locals.user;
  const member = db.prepare('SELECT 1 FROM team_memberships WHERE team_id=? AND user_id=?').get(teamId, user.id);
  const manager = canManageTeam(teamId, user);
  if (!member && !manager) return res.status(403).json({ error: 'You are not a member of this team.' });
  const role = req.body.role;
  if (!['viewer', 'editor'].includes(role)) return res.status(400).json({ error: 'Team document access must be viewer or editor.' });
  const document = db.prepare(`SELECT d.id,d.owner_id FROM documents d WHERE d.id=? AND d.is_archived=0 AND
    d.owner_id IN (SELECT user_id FROM team_memberships WHERE team_id=?)`).get(documentId, teamId) as any;
  if (!document) return res.status(404).json({ error: 'Choose an active document owned by a member of this team.' });
  if (manager) {
    const targetUserId = String(req.body.userId || '');
    if (!targetUserId || !db.prepare('SELECT 1 FROM team_memberships WHERE team_id=? AND user_id=?').get(teamId, targetUserId)) {
      return res.status(400).json({ error: 'Choose a member of this team.' });
    }
    db.prepare(`INSERT INTO team_document_access (team_id,document_id,user_id,role,status,created_by)
      VALUES (?,?,?,?,'approved',?) ON CONFLICT(team_id,document_id,user_id) DO UPDATE SET role=excluded.role,status='approved',created_by=excluded.created_by,updated_at=datetime('now')`)
      .run(teamId, documentId, targetUserId, role, user.id);
    addTeamShareAudit(documentId, 'Permission Changed', user, `Granted ${role} team access to member ${targetUserId}`, req.ip);
    return res.json({ success: true, status: 'approved', userId: targetUserId, role });
  }
  if (document.owner_id !== user.id) return res.status(403).json({ error: 'You can only request sharing your own documents.' });
  const prior = db.prepare("SELECT id,status FROM team_document_share_requests WHERE team_id=? AND document_id=? AND requester_id=?").get(teamId, documentId, user.id) as any;
  if (prior?.status === 'pending') return res.status(409).json({ error: 'This document is already waiting for manager approval.' });
  const requestId = prior?.id || `team-share-${randomUUID()}`;
  db.prepare(`INSERT INTO team_document_share_requests (id,team_id,document_id,requester_id,requested_role,status)
    VALUES (?,?,?,?,?,'pending') ON CONFLICT(team_id,document_id,requester_id) DO UPDATE SET requested_role=excluded.requested_role,status='pending',reviewer_id=NULL,created_at=datetime('now'),reviewed_at=NULL`)
    .run(requestId, teamId, documentId, user.id, role);
  addTeamShareAudit(documentId, 'Shared', user, `Requested team sharing approval as ${role}`, req.ip);
  return res.status(202).json({ success: true, status: 'pending' });
});

router.patch('/teams/:teamId/document-share-requests/:requestId', (req, res) => {
  const { teamId, requestId } = req.params;
  const user = res.locals.user;
  if (!canManageTeam(teamId, user)) return res.status(403).json({ error: 'Only this team’s manager can review sharing requests.' });
  const decision = req.body.decision;
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'Choose approve or reject.' });
  const request = db.prepare("SELECT * FROM team_document_share_requests WHERE id=? AND team_id=? AND status='pending'").get(requestId, teamId) as any;
  if (!request) return res.status(404).json({ error: 'Pending share request not found.' });
  db.transaction(() => {
    db.prepare("UPDATE team_document_share_requests SET status=?,reviewer_id=?,reviewed_at=datetime('now') WHERE id=?")
      .run(decision === 'approve' ? 'approved' : 'rejected', user.id, requestId);
    if (decision === 'approve') {
      const members = db.prepare('SELECT user_id FROM team_memberships WHERE team_id=? AND user_id<>?').all(teamId, request.requester_id) as Array<{ user_id: string }>;
      const grant = db.prepare(`INSERT INTO team_document_access (team_id,document_id,user_id,role,status,created_by)
        VALUES (?,?,?,?,'approved',?) ON CONFLICT(team_id,document_id,user_id) DO UPDATE SET role=excluded.role,status='approved',created_by=excluded.created_by,updated_at=datetime('now')`);
      for (const member of members) grant.run(teamId, request.document_id, member.user_id, request.requested_role, user.id);
    }
  })();
  addTeamShareAudit(request.document_id, 'Permission Changed', user,
    `${decision === 'approve' ? 'Approved' : 'Rejected'} team sharing request ${requestId}`, req.ip);
  res.json({ success: true, status: decision === 'approve' ? 'approved' : 'rejected' });
});

router.delete('/teams/:teamId/document-shares/:documentId/:userId', (req, res) => {
  const { teamId, documentId, userId } = req.params;
  const user = res.locals.user;
  if (!canManageTeam(teamId, user)) return res.status(403).json({ error: 'Only this team’s manager can revoke member access.' });
  const result = db.prepare("UPDATE team_document_access SET status='revoked',updated_at=datetime('now') WHERE team_id=? AND document_id=? AND user_id=? AND status='approved'")
    .run(teamId, documentId, userId);
  if (!result.changes) return res.status(404).json({ error: 'Approved team access not found.' });
  addTeamShareAudit(documentId, 'Permission Changed', user, `Revoked team access for member ${userId}`, req.ip);
  res.json({ success: true });
});

// GET /api/v1/admin/users
router.get('/users', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  res.json(rows.map(rowToUser));
});

// POST /api/v1/admin/users (add user)
router.post('/users', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, email, role, department, avatar, status } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required.' });
  if (typeof name !== 'string' || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'A valid name and email are required.' });
  }
  if (role && !['admin', 'manager', 'user'].includes(role)) return res.status(400).json({ error: 'Invalid user role.' });
  if (status && !['active', 'suspended', 'invited'].includes(status)) return res.status(400).json({ error: 'Invalid user status.' });

  const trimmedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(trimmedEmail);
  if (existing) return res.status(409).json({ error: 'Email already exists.' });

  const newId = `usr-${Date.now()}`;
  const teamName = String(department || 'General').trim();
  const teamId = `team-${teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  db.prepare('INSERT OR IGNORE INTO teams (id,name) VALUES (?,?)').run(teamId, teamName);
  if ((role || 'user') === 'manager' && db.prepare("SELECT id FROM users WHERE role='manager' AND team_id=? AND status='active'").get(teamId)) {
    return res.status(409).json({ error: 'This team already has an active manager.' });
  }
  db.prepare(`
    INSERT INTO users (id, name, email, role, avatar, department, team_id, status, storage_limit_bytes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(newId, name.trim(), trimmedEmail, role || 'user', typeof avatar === 'string' && avatar.trim() ? avatar.trim() : '/default-avatar.svg', teamName, teamId, status || 'invited', 50 * 1024 * 1024 * 1024);
  db.prepare('INSERT OR IGNORE INTO team_memberships (team_id,user_id) VALUES (?,?)').run(teamId, newId);
  if ((role || 'user') === 'manager') db.prepare('UPDATE teams SET manager_id=? WHERE id=?').run(newId, teamId);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(newId);
  res.status(201).json(rowToUser(user));
});

// PATCH /api/v1/admin/users/:id/role
router.patch('/users/:id/role', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  const { role } = req.body;
  if (!['admin', 'manager', 'user'].includes(role)) return res.status(400).json({ error: 'A valid role is required.' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'admin' && role !== 'admin' && (db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND status='active'").get() as any).c <= 1) {
    return res.status(409).json({ error: 'The last active administrator cannot be demoted.' });
  }
  if (role === 'manager' && db.prepare("SELECT id FROM users WHERE role='manager' AND team_id=? AND id<>? AND status='active'").get(user.team_id, id)) {
    return res.status(409).json({ error: 'Each team can have one manager. Reassign the current manager first.' });
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  if (user.role === 'manager' && role !== 'manager') db.prepare('UPDATE teams SET manager_id=NULL WHERE manager_id=?').run(id);
  if (role === 'manager') db.prepare('UPDATE teams SET manager_id=? WHERE id=?').run(id, user.team_id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json(rowToUser(updated));
});

// PATCH /api/v1/admin/users/:id/status
router.patch('/users/:id/status', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  const { status } = req.body;
  if (!['active', 'suspended', 'invited'].includes(status)) return res.status(400).json({ error: 'A valid status is required.' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'admin' && status !== 'active' && (db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND status='active'").get() as any).c <= 1) {
    return res.status(409).json({ error: 'The last active administrator cannot be suspended.' });
  }

  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  if (status === 'suspended') db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json(rowToUser(updated));
});

// DELETE /api/v1/admin/users/:id
router.delete('/users/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.params.id === res.locals.user.id) return res.status(400).json({ error: 'You cannot delete your own administrator account.' });
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if ((db.prepare('SELECT COUNT(*) AS c FROM documents WHERE owner_id=?').get(id) as any).c > 0) return res.status(409).json({ error: 'Reassign or delete this user’s documents before deleting the account.' });
  if ((user as any).role === 'admin' && (db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND status='active'").get() as any).c <= 1) return res.status(409).json({ error: 'The last active administrator cannot be deleted.' });

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

router.get('/my-audit', (req, res) => {
  const user = res.locals.user;
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(req.query.limit || '100'), 10) || 100));
  const rows = db.prepare('SELECT * FROM audit_logs WHERE LOWER(actor_email)=LOWER(?) ORDER BY timestamp DESC LIMIT ?').all(user.email, limit) as any[];
  res.json(rows.map((r) => ({ id: r.id, documentId: r.document_id, action: r.action, actorName: r.actor_name,
    actorEmail: r.actor_email, timestamp: r.timestamp, ipAddress: r.ip_address })));
});

router.patch('/users/:id/team', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { teamId } = req.body;
  const team = db.prepare('SELECT id,name FROM teams WHERE id=?').get(teamId) as any;
  if (!team) return res.status(404).json({ error: 'Team not found.' });
  const member = db.prepare('SELECT id,role FROM users WHERE id=?').get(req.params.id) as any;
  if (!member) return res.status(404).json({ error: 'User not found.' });
  db.transaction(() => {
    db.prepare('UPDATE users SET team_id=?,department=? WHERE id=?').run(team.id, team.name, member.id);
    db.prepare('INSERT OR IGNORE INTO team_memberships (team_id,user_id) VALUES (?,?)').run(team.id, member.id);
  })();
  if (member.role === 'manager') db.prepare('UPDATE teams SET manager_id=NULL WHERE manager_id=?').run(member.id);
  const updated = db.prepare('SELECT * FROM users WHERE id=?').get(member.id);
  if (member.role === 'manager') db.prepare('UPDATE teams SET manager_id=? WHERE id=?').run(member.id, team.id);
  res.json(rowToUser(updated));
});

// GET /api/v1/admin/audit-logs
router.get('/audit-logs', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { action, userId, documentId, limit } = req.query;

  let sql = 'SELECT * FROM audit_logs';
  const params: any[] = [];
  const conditions: string[] = [];

  if (action) { conditions.push('action = ?'); params.push(action); }
  if (documentId) { conditions.push('document_id = ?'); params.push(documentId); }

  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY timestamp DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit as string)); }

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((r: any) => ({
    id: r.id,
    documentId: r.document_id,
    action: r.action,
    actorName: r.actor_name,
    actorEmail: r.actor_email,
    timestamp: r.timestamp,
    ipAddress: r.ip_address,
  })));
});

// GET /api/v1/admin/audit-logs/export
router.get('/audit-logs/export', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { format } = req.query;
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC').all() as any[];

  if (format === 'csv') {
    const headers = 'id,documentId,action,actorName,actorEmail,timestamp,ipAddress';
    const csvCell = (value: unknown) => {
      const text = String(value ?? '').replace(/[\r\n]+/g, ' ');
      const safe = /^[=+\-@\t]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const lines = rows.map((r: any) => [r.id, r.document_id, r.action, r.actor_name, r.actor_email, r.timestamp, r.ip_address].map(csvCell).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    return res.send([headers, ...lines].join('\n'));
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.json"');
  res.json(rows.map((r: any) => ({
    id: r.id, documentId: r.document_id, action: r.action,
    actorName: r.actor_name, actorEmail: r.actor_email,
    timestamp: r.timestamp, ipAddress: r.ip_address,
  })));
});

// GET /api/v1/admin/stats
router.get('/stats', (req, res) => {
  const user = res.locals.user;
  let scopeSql = '';
  const scopeParams: unknown[] = [];
  if (user.role === 'manager') {
    scopeSql = ' AND EXISTS (SELECT 1 FROM team_memberships tm JOIN teams t ON t.id=tm.team_id WHERE tm.user_id=documents.owner_id AND t.manager_id=?)';
    scopeParams.push(user.id);
  }
  else if (user.role !== 'admin') { scopeSql = ' AND owner_id=?'; scopeParams.push(user.id); }
  const totalDocuments = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE is_archived = 0${scopeSql}`).get(...scopeParams) as any).c;
  const totalStorageBytes = (db.prepare(`SELECT COALESCE(SUM(file_size_bytes), 0) as s FROM documents WHERE is_archived=0${scopeSql}`).get(...scopeParams) as any).s;
  const scopedLinkSql = user.role === 'admin' ? 'SELECT COUNT(*) as c FROM share_links'
    : user.role === 'manager' ? 'SELECT COUNT(*) as c FROM share_links s JOIN documents d ON d.id=s.document_id WHERE EXISTS (SELECT 1 FROM team_memberships tm JOIN teams t ON t.id=tm.team_id WHERE tm.user_id=d.owner_id AND t.manager_id=?)'
      : 'SELECT COUNT(*) as c FROM share_links s JOIN documents d ON d.id=s.document_id WHERE d.owner_id=?';
  const sharedLinksCount = (db.prepare(scopedLinkSql).get(...(user.role === 'admin' ? [] : [user.role === 'manager' ? user.id : user.id])) as any).c;
  const activeUsersCount = user.role === 'admin'
    ? (db.prepare("SELECT COUNT(*) as c FROM users WHERE status='active'").get() as any).c
    : user.role === 'manager'
      ? (db.prepare("SELECT COUNT(DISTINCT u.id) as c FROM users u JOIN team_memberships tm ON tm.user_id=u.id JOIN teams t ON t.id=tm.team_id WHERE u.status='active' AND t.manager_id=?").get(user.id) as any).c
      : 1;
  const auditEventsCount = user.role === 'admin'
    ? (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c
    : user.role === 'manager'
      ? (db.prepare('SELECT COUNT(*) as c FROM audit_logs l JOIN documents d ON d.id=l.document_id WHERE EXISTS (SELECT 1 FROM team_memberships tm JOIN teams t ON t.id=tm.team_id WHERE tm.user_id=d.owner_id AND t.manager_id=?)').get(user.id) as any).c
      : (db.prepare('SELECT COUNT(*) as c FROM audit_logs WHERE LOWER(actor_email)=LOWER(?)').get(user.email) as any).c;
  const maxStorageBytes = user.role === 'admin'
    ? 1024 * 1024 * 1024 * 1024
    : user.role === 'manager'
      ? (db.prepare("SELECT COALESCE(SUM(u.storage_limit_bytes),0) as s FROM users u WHERE u.id IN (SELECT DISTINCT tm.user_id FROM team_memberships tm JOIN teams t ON t.id=tm.team_id WHERE t.manager_id=?)").get(user.id) as any).s
      : user.storage_limit_bytes;

  res.json({
    totalDocuments,
    totalStorageBytes,
    maxStorageBytes,
    sharedLinksCount,
    securityScore: null,
    activeUsersCount,
    auditEventsCount,
  });
});

router.get('/team-audit', (req, res) => {
  const user = res.locals.user;
  if (!['admin', 'manager'].includes(user.role)) return res.status(403).json({ error: 'Manager access is required.' });
  const limit = Math.min(500, Math.max(1, Number.parseInt(String(req.query.limit || '100'), 10) || 100));
  const rows = user.role === 'admin'
    ? db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit)
    : db.prepare(`SELECT l.* FROM audit_logs l JOIN documents d ON d.id=l.document_id WHERE EXISTS
      (SELECT 1 FROM team_memberships tm JOIN teams t ON t.id=tm.team_id WHERE tm.user_id=d.owner_id AND t.manager_id=?) ORDER BY l.timestamp DESC LIMIT ?`).all(user.id, limit);
  res.json((rows as any[]).map((r) => ({
    id: r.id, documentId: r.document_id, action: r.action, actorName: r.actor_name,
    actorEmail: r.actor_email, timestamp: r.timestamp, ipAddress: r.ip_address,
  })));
});

router.get('/teams', (req, res) => {
  const user = res.locals.user;
  const rows = user.role === 'admin'
    ? db.prepare('SELECT t.id,t.name,t.manager_id,COUNT(tm.user_id) AS member_count FROM teams t LEFT JOIN team_memberships tm ON tm.team_id=t.id GROUP BY t.id ORDER BY t.name').all()
    : user.role === 'manager'
      ? db.prepare('SELECT t.id,t.name,t.manager_id,COUNT(tm.user_id) AS member_count FROM teams t LEFT JOIN team_memberships tm ON tm.team_id=t.id WHERE t.manager_id=? GROUP BY t.id ORDER BY t.name').all(user.id)
      : db.prepare(`SELECT t.id,t.name,t.manager_id,COUNT(tm.user_id) AS member_count FROM teams t
        JOIN team_memberships mine ON mine.team_id=t.id AND mine.user_id=?
        LEFT JOIN team_memberships tm ON tm.team_id=t.id GROUP BY t.id ORDER BY t.name`).all(user.id);
  res.json(rows);
});

router.get('/teams/:teamId/members', (req, res) => {
  const user = res.locals.user;
  const member = db.prepare('SELECT 1 FROM team_memberships WHERE team_id=? AND user_id=?').get(req.params.teamId, user.id);
  if (!canManageTeam(req.params.teamId, user) && !member) return res.status(403).json({ error: 'You can only view members of your own team.' });
  const rows = db.prepare("SELECT u.* FROM users u JOIN team_memberships tm ON tm.user_id=u.id WHERE tm.team_id=? AND u.status='active' ORDER BY u.name").all(req.params.teamId);
  res.json((rows as any[]).map(rowToUser));
});

export default router;
