/**
 * Middleware de Autorización: restringe acciones exclusivas del administrador.
 * El frontend envía la clave en el encabezado 'x-admin-key'.
 */

function requireAdmin(req, res, next) {
    const key = req.get('x-admin-key') || '';
    const expected = process.env.ADMIN_PIN || 'admin123';

    if (!key || key !== expected) {
        return res.status(401).json({
            success: false,
            message: 'Acceso restringido: solo el administrador puede realizar esta acción.'
        });
    }

    next();
}

module.exports = { requireAdmin };
