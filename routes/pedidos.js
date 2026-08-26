/**
 * Rutas de la API REST para Pedidos de Artículos (Solicitudes Internas)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAdmin } = require('../middleware/adminAuth');
const { getClientIp } = require('../utils/ip');

const MAX_PEDIDO_QTY = 10000;
const MAX_SOLICITANTE_LENGTH = 100;

function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim();
}

router.get('/', (req, res, next) => {
    try {
        let sql, params;

        if (req.query.ip) {
            const ip = String(req.query.ip).substring(0, 45);
            sql = `
                SELECT
                    p.id, p.articulo_id, p.cantidad, p.solicitante, p.ip,
                    p.estado, p.fecha_pedido,
                    a.nombre as articulo_nombre, a.sku, a.cantidad_disponible, a.imagen,
                    c.nombre as categoria_nombre
                FROM pedidos p
                JOIN articulos a ON p.articulo_id = a.id
                JOIN categorias c ON a.categoria_id = c.id
                WHERE p.ip = ?
                  AND (p.estado = 'Pendiente'
                       OR (p.estado != 'Pendiente' AND p.fecha_actualizacion > datetime('now', '-10 minutes')))
                ORDER BY CASE p.estado WHEN 'Pendiente' THEN 0 ELSE 1 END, p.fecha_pedido DESC
            `;
            params = [ip];
        } else {
            sql = `
                SELECT
                    p.id, p.articulo_id, p.cantidad, p.solicitante, p.ip,
                    p.estado, p.fecha_pedido,
                    a.nombre as articulo_nombre, a.sku, a.cantidad_disponible, a.imagen,
                    c.nombre as categoria_nombre
                FROM pedidos p
                JOIN articulos a ON p.articulo_id = a.id
                JOIN categorias c ON a.categoria_id = c.id
                WHERE p.estado = 'Pendiente'
                   OR (p.estado != 'Pendiente' AND p.fecha_actualizacion > datetime('now', '-10 minutes'))
                ORDER BY CASE p.estado WHEN 'Pendiente' THEN 0 ELSE 1 END, p.fecha_pedido DESC
            `;
            params = [];
        }

        const pedidos = db.prepare(sql).all(...params);
        res.json({ success: true, data: pedidos });
    } catch (error) {
        next(error);
    }
});

router.post('/', (req, res, next) => {
    try {
        const { articulo_id, cantidad, solicitante = '' } = req.body;
        const errors = [];

        if (!articulo_id || isNaN(Number(articulo_id)) || Number(articulo_id) <= 0) {
            errors.push('Debe seleccionar un artículo válido.');
        }
        if (cantidad === undefined || cantidad === null || isNaN(Number(cantidad)) ||
            !Number.isInteger(Number(cantidad)) || Number(cantidad) <= 0) {
            errors.push('La cantidad debe ser un número entero mayor a 0.');
        } else if (Number(cantidad) > MAX_PEDIDO_QTY) {
            errors.push(`La cantidad no puede exceder ${MAX_PEDIDO_QTY.toLocaleString()} unidades.`);
        }

        const solStr = String(solicitante).trim();
        if (solStr.length > MAX_SOLICITANTE_LENGTH) {
            errors.push(`El nombre del solicitante no puede exceder ${MAX_SOLICITANTE_LENGTH} caracteres.`);
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Error de validación en el pedido',
                errors
            });
        }

        const art = db.prepare('SELECT id, nombre FROM articulos WHERE id = ?').get(parseInt(articulo_id, 10));
        if (!art) {
            return res.status(400).json({ success: false, message: 'El artículo seleccionado no existe.' });
        }

        db.prepare(`
            INSERT INTO pedidos (articulo_id, cantidad, solicitante, ip)
            VALUES (?, ?, ?, ?)
        `).run(parseInt(articulo_id, 10), parseInt(cantidad, 10), sanitize(solStr), getClientIp(req));

        res.status(201).json({
            success: true,
            message: `Pedido de '${art.nombre}' registrado correctamente.`
        });
    } catch (error) {
        next(error);
    }
});

router.put('/:id/estado', requireAdmin, (req, res, next) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        if (!['Entregado', 'Cancelado'].includes(estado)) {
            return res.status(400).json({
                success: false,
                message: "Estado inválido. Use 'Entregado' o 'Cancelado'."
            });
        }

        const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'No se encontró el pedido.' });
        }
        if (pedido.estado !== 'Pendiente') {
            return res.status(400).json({
                success: false,
                message: 'El pedido ya fue procesado y no puede modificarse.'
            });
        }

        if (estado === 'Entregado') {
            const art = db.prepare('SELECT nombre, sku, cantidad_disponible FROM articulos WHERE id = ?').get(pedido.articulo_id);
            if (!art) {
                return res.status(400).json({ success: false, message: 'El artículo del pedido ya no existe.' });
            }
            if (art.cantidad_disponible < pedido.cantidad) {
                return res.status(400).json({
                    success: false,
                    message: 'Stock insuficiente para entregar este pedido.'
                });
            }

            const entregar = db.transaction(() => {
                db.prepare('UPDATE articulos SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?')
                    .run(pedido.cantidad, pedido.articulo_id);
                db.prepare("UPDATE pedidos SET estado = 'Entregado', fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?")
                    .run(id);
                db.prepare(`INSERT INTO movimientos (articulo_id, articulo_nombre, articulo_sku, tipo, cantidad, motivo, usuario) VALUES (?, ?, ?, 'Salida', ?, ?, ?)`).run(
                    pedido.articulo_id, art.nombre, art.sku, pedido.cantidad,
                    `Pedido #${id}`, pedido.solicitante || 'Desconocido'
                );
            });
            entregar();

            return res.json({
                success: true,
                message: `Pedido entregado. Se descontaron ${pedido.cantidad} unidades.`
            });
        }

        db.prepare("UPDATE pedidos SET estado = 'Cancelado', fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?").run(id);
        res.json({ success: true, message: 'El pedido ha sido cancelado.' });
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', requireAdmin, (req, res, next) => {
    try {
        const result = db.prepare('DELETE FROM pedidos WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'No se encontró el pedido.' });
        }
        res.json({ success: true, message: 'Pedido eliminado del registro.' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
