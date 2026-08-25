/**
 * Rutas de Autenticación con Server-Side Sessions
 */

const express = require('express');
const router = express.Router();
const { getClientIp } = require('../utils/ip');
const { createSession, destroySession, getSession } = require('../middleware/session');
const rateLimit = require('express-rate-limit');

const PIN_MIN_LENGTH = 8;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const loginAttempts = new Map();

const loginLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    max: MAX_LOGIN_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Demasiados intentos de acceso. Espera 15 minutos.'
        });
    }
});

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

router.post('/login', loginLimiter, (req, res) => {
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

    const clientIp = getClientIp(req);
    const attemptsKey = clientIp;
    const attempts = loginAttempts.get(attemptsKey) || { count: 0, firstAttempt: Date.now() };

    if (Date.now() - attempts.firstAttempt > LOGIN_WINDOW_MS) {
        attempts.count = 0;
        attempts.firstAttempt = Date.now();
    }

    if (String(clave) === expected) {
        attempts.count = 0;
        loginAttempts.set(attemptsKey, attempts);

        const sessionToken = createSession('admin');
        return res.json({
            success: true,
            message: 'Bienvenido, administrador.',
            sessionToken
        });
    }

    attempts.count++;
    loginAttempts.set(attemptsKey, attempts);

    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
        loginAttempts.delete(attemptsKey);
        return res.status(429).json({
            success: false,
            message: 'Demasiados intentos fallidos. Bloqueado por 15 minutos.'
        });
    }

    const remaining = MAX_LOGIN_ATTEMPTS - attempts.count;
    res.status(401).json({
        success: false,
        message: remaining <= 2
            ? `Clave incorrecta. Te quedan ${remaining} intento(s).`
            : 'Clave de administrador incorrecta.'
    });
});

router.post('/logout', (req, res) => {
    const token = req.get('x-session-token');
    if (token) destroySession(token);
    res.json({ success: true, message: 'Sesión cerrada.' });
});

module.exports = router;
