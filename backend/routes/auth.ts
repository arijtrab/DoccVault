import express from 'express';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'crypto';
import { db, rowToUser } from '../../database/db.js';

const router = express.Router();
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};
const passwordMatches = (password: string, stored: string) => {
  const [, salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
function issueSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 86400000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return token;
}

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').run(cutoff);
  const recentAttempts = (db.prepare('SELECT COUNT(*) AS c FROM login_attempts WHERE email=? OR ip_address=?').get(email, ip) as any).c;
  if (recentAttempts >= 10) return res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.' });
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email) as any;
  if (!user || !passwordMatches(password, user.password_hash) || user.status !== 'active') {
    db.prepare('INSERT INTO login_attempts (email,ip_address,attempted_at) VALUES (?,?,?)').run(email, ip, new Date().toISOString());
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  db.prepare('DELETE FROM login_attempts WHERE email=?').run(email);
  db.prepare("UPDATE users SET last_active = 'Just now' WHERE id = ?").run(user.id);
  res.json({ success: true, token: issueSession(user.id), user: rowToUser(user) });
});

router.post('/register', (req, res) => {
  const { name } = req.body;
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !email || password.length < 8) return res.status(400).json({ error: 'Name, valid email, and password of at least 8 characters are required.' });
  if (db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email)) return res.status(409).json({ error: 'An account with this email already exists.' });
  const id = `usr-${randomUUID()}`;
  // New accounts join a team only when an administrator or manager adds them.
  db.prepare("INSERT INTO users (id,name,email,password_hash,role,avatar,department,team_id,status) VALUES (?,?,?,?,'user','/default-avatar.svg',NULL,NULL,'active')")
    .run(id, String(name).trim(), email, hashPassword(password));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  res.status(201).json({ success: true, token: issueSession(id), user: rowToUser(user) });
});

router.post('/forgot-password', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const deliveryUrl = process.env.DOCVAULT_PASSWORD_RESET_WEBHOOK;
  if (!deliveryUrl) return res.status(503).json({ error: 'Password recovery delivery is not configured. Contact your workspace administrator.' });
  try { if (!['https:', 'http:'].includes(new URL(deliveryUrl).protocol)) throw new Error('Invalid protocol'); }
  catch { return res.status(503).json({ error: 'Password recovery delivery is misconfigured.' }); }
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  db.prepare('DELETE FROM password_reset_attempts WHERE attempted_at < ?').run(cutoff);
  const attempts = (db.prepare('SELECT COUNT(*) AS c FROM password_reset_attempts WHERE email=? OR ip_address=?').get(email, ip) as any).c;
  if (attempts >= 5) return res.status(429).json({ error: 'Too many recovery requests. Please try again later.' });
  db.prepare('INSERT INTO password_reset_attempts (email,ip_address,attempted_at) VALUES (?,?,?)').run(email, ip, new Date().toISOString());
  const user = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email) as any;
  if (!user) return res.status(202).json({ success: true });
  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();
  db.prepare('INSERT INTO password_resets (token_hash,user_id,expires_at) VALUES (?,?,?)')
    .run(createHash('sha256').update(token).digest('hex'), user.id, expiresAt);
  void fetch(deliveryUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.DOCVAULT_PASSWORD_RESET_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.DOCVAULT_PASSWORD_RESET_WEBHOOK_TOKEN}` } : {}) },
    body: JSON.stringify({ email, token, expiresAt, appUrl: process.env.APP_URL || '' }),
    signal: AbortSignal.timeout(10_000),
  }).then(async response => {
    if (!response.ok) throw new Error('Recovery delivery failed.');
    res.status(202).json({ success: true });
  }).catch(() => {
    db.prepare('DELETE FROM password_resets WHERE user_id=?').run(user.id);
    if (!res.headersSent) res.status(503).json({ error: 'Recovery instructions could not be delivered. Please try again later.' });
  });
});

router.post('/reset-password', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.newPassword || '');
  const token = String(req.body.token || '');
  if (password.length < 8 || !token) return res.status(400).json({ error: 'A valid reset token and password of at least 8 characters are required.' });
  const reset = db.prepare(`SELECT pr.token_hash, pr.user_id, pr.expires_at FROM password_resets pr JOIN users u ON u.id=pr.user_id WHERE LOWER(u.email)=? AND pr.token_hash=?`)
    .get(email, createHash('sha256').update(token).digest('hex')) as any;
  if (!reset || Date.parse(reset.expires_at) < Date.now()) return res.status(400).json({ error: 'Reset token is invalid or expired.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), reset.user_id);
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(reset.user_id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.user_id);
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Unauthorized.' });
  const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token) as any;
  if (!session || Date.parse(session.expires_at) < Date.now()) return res.status(401).json({ error: 'Session expired.' });
  const user = db.prepare("SELECT * FROM users WHERE id = ? AND status='active'").get(session.user_id) as any;
  if (!user) return res.status(401).json({ error: 'User not found or inactive.' });
  res.json(rowToUser(user));
});

router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ success: true });
});

router.patch('/profile', (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const session = token ? db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires_at > ?').get(token, new Date().toISOString()) as any : null;
  if (!session) return res.status(401).json({ error: 'Unauthorized.' });
  const { name, avatar } = req.body;
  if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 120)) return res.status(400).json({ error: 'Name must contain between 1 and 120 characters.' });
  if (avatar !== undefined && (typeof avatar !== 'string' || avatar.length > 2048)) return res.status(400).json({ error: 'Avatar must be a valid image URL.' });
  const normalizedAvatar = avatar === undefined ? null : avatar.trim() || '/default-avatar.svg';
  db.prepare(`UPDATE users SET name=COALESCE(?,name), avatar=COALESCE(?,avatar) WHERE id=?`)
    .run(name?.trim() ?? null, normalizedAvatar, session.user_id);
  res.json(rowToUser(db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id)));
});

export default router;
