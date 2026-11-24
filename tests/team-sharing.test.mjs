import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import express from 'express';

const dataDir = mkdtempSync(join(tmpdir(), 'docvault-team-test-'));
process.env.DOCVAULT_DB_PATH = join(dataDir, 'test.db');
process.env.DOCVAULT_MASTER_KEY = 'a'.repeat(64);
process.env.DOCVAULT_MASTER_KEY_VERSION = 'test-v1';

const [{ db }, { default: authRoutes }, { default: adminRoutes }, { default: documentRoutes }] = await Promise.all([
  import('../database/db.ts'),
  import('../backend/routes/auth.ts'),
  import('../backend/routes/admin.ts'),
  import('../backend/routes/documents.ts'),
]);

const app = express();
app.use(express.json({ limit: '70mb' }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/documents', documentRoutes);
let server;
let baseUrl;

before(async () => {
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  db.close();
  rmSync(dataDir, { recursive: true, force: true });
});

async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

function createSession(userId) {
  const token = `test-session-${userId}`;
  db.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)')
    .run(token, userId, new Date(Date.now() + 60_000).toISOString());
  return token;
}

function createDocument(id, ownerId, teamId, title) {
  db.prepare(`INSERT INTO documents (id,title,original_file_name,file_type,file_size_bytes,category,tags,sensitivity,
    owner_id,owner_name,team_id,approval_status) VALUES (?,?,?,'txt',12,'Operations','[]','Confidential',?,?,?,'approved')`)
    .run(id, title, `${id}.txt`, ownerId, ownerId, teamId);
}

test('team sharing approval, member rights, revocation, and deletion stay team-scoped', async () => {
  db.prepare(`INSERT INTO users (id,name,email,role,status,storage_limit_bytes) VALUES
    ('test-manager','Test Manager','manager@test.local','manager','active',1000000)`).run();
  const managerToken = createSession('test-manager');
  const userA = await api('/api/v1/auth/register', { method: 'POST', body: { name: 'User A', email: 'user-a@test.local', password: 'test-password-123' } });
  const userB = await api('/api/v1/auth/register', { method: 'POST', body: { name: 'User B', email: 'user-b@test.local', password: 'test-password-123' } });
  assert.equal(userA.status, 201);
  assert.equal(userB.status, 201);
  assert.equal(userA.body.user.avatar, '/default-avatar.svg');
  db.prepare("INSERT INTO teams (id,name) VALUES ('test-other-team','Other Team')").run();
  db.prepare("UPDATE users SET team_id='test-other-team' WHERE id=?").run(userA.body.user.id);

  const created = await api('/api/v1/admin/teams', { token: managerToken, method: 'POST', body: { name: 'Integration Team' } });
  assert.equal(created.status, 201);
  const teamId = created.body.id;
  for (const user of [userA.body.user, userB.body.user]) {
    const added = await api(`/api/v1/admin/teams/${teamId}/members`, { token: managerToken, method: 'POST', body: { userId: user.id } });
    assert.equal(added.status, 200);
  }

  createDocument('test-user-document', userA.body.user.id, teamId, 'User document');
  createDocument('test-manager-document', 'test-manager', teamId, 'Manager document');
  createDocument('test-review-document', 'test-manager', teamId, 'Review document');
  db.prepare("UPDATE documents SET approval_status='pending_review' WHERE id='test-review-document'").run();

  const managerFile = Buffer.from('Manager uploads do not require review');
  const managerUpload = await api('/api/v1/documents', { token: managerToken, method: 'POST', body: {
    title: 'Manager direct upload', originalFileName: 'manager.txt', fileType: 'txt', fileSizeBytes: managerFile.length,
    category: 'Operations', sensitivity: 'Internal', tags: [], fileContentBase64: managerFile.toString('base64'),
  } });
  assert.equal(managerUpload.status, 201);
  assert.equal(managerUpload.body.approvalStatus, 'approved');
  assert.equal(managerUpload.body.sealedBy, 'test-manager');
  assert.ok(managerUpload.body.sealedAt);

  const assignedReviewer = await api('/api/v1/documents/test-review-document/reviewers', {
    token: managerToken, method: 'POST', body: { email: userA.body.user.email },
  });
  assert.equal(assignedReviewer.status, 200, 'team membership, not the user primary team field, determines reviewer eligibility');
  const reviewerQueue = await api('/api/v1/documents', { token: userA.body.token });
  assert.ok(reviewerQueue.body.some(document => document.id === 'test-review-document'), 'the assigned reviewer sees the pending document in their queue');
  const reviewed = await api('/api/v1/documents/test-review-document/approve', {
    token: userA.body.token, method: 'POST', body: { notes: 'Reviewed' },
  });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.approvalStatus, 'pending_manager_seal');
  assert.equal(reviewed.body.sealedAt, undefined, 'review approval is not the final seal');
  const reviewerCannotSeal = await api('/api/v1/documents/test-review-document/seal', { token: userA.body.token, method: 'POST', body: {} });
  assert.equal(reviewerCannotSeal.status, 403);
  const sealed = await api('/api/v1/documents/test-review-document/seal', { token: managerToken, method: 'POST', body: {} });
  assert.equal(sealed.status, 200);
  assert.equal(sealed.body.approvalStatus, 'approved');
  assert.equal(sealed.body.sealedBy, 'test-manager');

  const request = await api(`/api/v1/admin/teams/${teamId}/document-shares/test-user-document`, {
    token: userA.body.token, method: 'PUT', body: { role: 'viewer' },
  });
  assert.equal(request.status, 202);
  const blocked = await api('/api/v1/documents/test-user-document', { token: userB.body.token });
  assert.equal(blocked.status, 403, 'pending team requests must not expose documents');

  const inbox = await api(`/api/v1/admin/teams/${teamId}/document-shares`, { token: managerToken });
  const pending = inbox.body.requests.find(item => item.documentId === 'test-user-document');
  assert.ok(pending);
  const approved = await api(`/api/v1/admin/teams/${teamId}/document-share-requests/${pending.id}`, {
    token: managerToken, method: 'PATCH', body: { decision: 'approve' },
  });
  assert.equal(approved.status, 200);
  const visible = await api('/api/v1/documents/test-user-document', { token: userB.body.token });
  assert.equal(visible.status, 200);
  assert.equal(visible.body.canReadContent, true);
  assert.equal(visible.body.canDownload, false, 'viewer download stays blocked for confidential files');

  const granted = await api(`/api/v1/admin/teams/${teamId}/document-shares/test-manager-document`, {
    token: managerToken, method: 'PUT', body: { userId: userB.body.user.id, role: 'editor' },
  });
  assert.equal(granted.status, 200);
  const editorAccess = await api('/api/v1/documents/test-manager-document', { token: userB.body.token });
  assert.equal(editorAccess.body.canDownload, true);

  const revoked = await api(`/api/v1/admin/teams/${teamId}/document-shares/test-manager-document/${userB.body.user.id}`, {
    token: managerToken, method: 'DELETE',
  });
  assert.equal(revoked.status, 200);
  const blockedAfterRevoke = await api('/api/v1/documents/test-manager-document', { token: userB.body.token });
  assert.equal(blockedAfterRevoke.status, 403);

  const removed = await api(`/api/v1/admin/teams/${teamId}/members/${userB.body.user.id}`, { token: managerToken, method: 'DELETE' });
  assert.equal(removed.status, 200);
  const deleteAll = await api(`/api/v1/admin/teams/${teamId}/documents`, { token: managerToken, method: 'DELETE' });
  assert.equal(deleteAll.status, 200);
  assert.equal(deleteAll.body.deletedCount, 4);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM documents WHERE id LIKE 'test-%'").get().count, 0);

  const retainedId = 'test-retained-document';
  createDocument(retainedId, userA.body.user.id, teamId, 'Retained document');
  const deletedTeam = await api(`/api/v1/admin/teams/${teamId}`, { token: managerToken, method: 'DELETE' });
  assert.equal(deletedTeam.status, 200);
  assert.ok(db.prepare('SELECT id FROM documents WHERE id=?').get(retainedId), 'deleting a team keeps its documents');
});
