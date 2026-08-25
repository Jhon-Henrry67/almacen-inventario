/**
 * Session Management Module
 * Server-side sessions with cryptographically random tokens.
 * Tokens expire after 2 hours and can be revoked on logout.
 */

const crypto = require('crypto');

const sessions = new Map();
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

function createSession(role) {
    const token = crypto.randomBytes(32).toString('hex');
    const session = {
        role,
        created: Date.now(),
        expires: Date.now() + SESSION_DURATION_MS
    };
    sessions.set(token, session);
    return token;
}

function getSession(token) {
    if (!token || typeof token !== 'string') return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expires) {
        sessions.delete(token);
        return null;
    }
    return session;
}

function destroySession(token) {
    if (token) sessions.delete(token);
}

function destroyAllSessions() {
    sessions.clear();
}

setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions) {
        if (now > session.expires) sessions.delete(token);
    }
}, 5 * 60 * 1000);

module.exports = { createSession, getSession, destroySession, destroyAllSessions };
