/**
 * Rutas de la API REST para Historial de Movimientos de Stock
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50));
        const offset = (page - 1) * limit;

        const totalResult = db.prepare('SELECT COUNT(*) as total FROM movimientos').get();
        const totalItems = totalResult.total;
        const totalPages = Math.ceil(totalItems / limit) || 1;

        const data = db.prepare(`
            SELECT * FROM movimientos
            ORDER BY fecha_movimiento DESC
            LIMIT ? OFFSET ?
        `).all(limit, offset);

        res.json({
            success: true,
            data,
            pagination: {
                totalItems,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
