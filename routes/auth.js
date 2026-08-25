/**
 * Rutas de Autenticación (validación de clave de administrador)
 */

const express = require('express');
const router = express.Router();
const { getClientIp } = require('../utils/ip');

// GET /api/auth/whoami - Devuelve la IP del equipo que consulta (identifica al personal)
router.get('/whoami', (req, res) => {
    res.json({ success: true, ip: getClientIp(req) });
});

// POST /api/auth/login - Validar clave de administrador
router.post('/login', (req, res) => {
    const { clave } = req.body || {};
    const expected = process.env.ADMIN_PIN || 'admin123';

    if (clave && String(clave) === expected) {
        return res.json({ success: true, message: 'Bienvenido, administrador.' });
    }

    res.status(401).json({ success: false, message: 'Clave de administrador incorrecta.' });
});

module.exports = router;
