/**
 * Middleware de Autorización con Server-Side Sessions
 * Valida tokens de sesión en lugar del PIN raw.
 */

const { getSession } = require('./session');

function requireAdmin(req, res, next) {
    const token = req.get('x-session-token') || '';

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Acceso restringido: sesión no válida.'
        });
    }

    const session = getSession(token);
    if (!session || session.role !== 'admin') {
        return res.status(401).json({
            success: false,
            message: 'Acceso restringido: sesión expirada o inválida.'
        });
    }

    req.sessionRole = session.role;
    next();
}

module.exports = { requireAdmin };
