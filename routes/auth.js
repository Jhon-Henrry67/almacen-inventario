/**
 * Rutas de Autenticación con Server-Side Sessions
 */

const express = require('express');
const router = express.Router();
const { getClientIp } = require('../utils/ip');
const { createSession, destroySession, getSession } = require('../middleware/session');

const PIN_MIN_LENGTH = 8;

function validatePinComplexity(pin) {
    if (typeof pin !== 'string') return false;
    if (pin.length < PIN_MIN_LENGTH) return false;
    if (!/[a-zA-Z]/.test(pin) || !/[0-9]/.test(pin)) return false;
    return true;
}

router.get('/whoami', (req, res) => {
    const ip = getClientIp(req);
    const validFormat = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip === '127.0.0.1';
    res.json({ success: true, ip: validFormat ? ip : '0.0.0.0' });
});

router.post('/login', (req, res) => {
    const { clave } = req.body || {};
    const expected = process.env.ADMIN_PIN;

    if (!expected || expected.length < PIN_MIN_LENGTH) {
        console.error('ADMIN_PIN no está configurado correctamente. Debe tener al menos 8 caracteres.');
        return res.status(500).json({
            success: false,
            message: 'Error de configuración del servidor.'
        });
    }

    if (!clave || String(clave).length > 200) {
        return res.status(400).json({
            success: false,
            message: 'Credenciales inválidas.'
        });
    }

    if (String(clave) === expected) {
        const sessionToken = createSession('admin');
        return res.json({
            success: true,
            message: 'Bienvenido, administrador.',
            sessionToken
        });
    }

    res.status(401).json({
        success: false,
        message: 'Clave de administrador incorrecta.'
    });
});

router.post('/logout', (req, res) => {
    const token = req.get('x-session-token');
    if (token) destroySession(token);
    res.json({ success: true, message: 'Sesión cerrada.' });
});

module.exports = router;
