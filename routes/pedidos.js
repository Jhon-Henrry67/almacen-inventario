/**
 * Rutas de la API REST para Pedidos de Artículos (Solicitudes Internas)
 * Usa pedido_grupo + pedido_detalle (múltiples artículos por solicitud).
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
        let grupos;

        if (req.query.ip) {
            const ip = String(req.query.ip).substring(0, 45);
            grupos = db.prepare(`
                SELECT
                    g.id, g.solicitante, g.ip, g.estado, g.fecha_pedido, g.fecha_actualizacion
                FROM pedido_grupo g
                WHERE g.ip = ?
                  AND (g.estado = 'Pendiente'
                       OR (g.estado != 'Pendiente' AND g.fecha_actualizacion > datetime('now', '-10 minutes')))
                ORDER BY CASE g.estado WHEN 'Pendiente' THEN 0 ELSE 1 END, g.fecha_pedido DESC
            `).all(ip);
        } else {
            grupos = db.prepare(`
                SELECT
                    g.id, g.solicitante, g.ip, g.estado, g.fecha_pedido, g.fecha_actualizacion
                FROM pedido_grupo g
                WHERE g.estado = 'Pendiente'
                   OR (g.estado != 'Pendiente' AND g.fecha_actualizacion > datetime('now', '-10 minutes'))
                ORDER BY CASE g.estado WHEN 'Pendiente' THEN 0 ELSE 1 END, g.fecha_pedido DESC
            `).all();
        }

        if (grupos.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const grupoIds = grupos.map(g => g.id);
        const placeholders = grupoIds.map(() => '?').join(',');

        const detalles = db.prepare(`
            SELECT
                d.id, d.grupo_id, d.articulo_id, d.cantidad,
                a.nombre as articulo_nombre, a.sku, a.imagen,
                c.nombre as categoria_nombre
            FROM pedido_detalle d
            JOIN articulos a ON d.articulo_id = a.id
            JOIN categorias c ON a.categoria_id = c.id
            WHERE d.grupo_id IN (${placeholders})
        `).all(...grupoIds);

        const detallesPorGrupo = {};
        for (const d of detalles) {
            if (!detallesPorGrupo[d.grupo_id]) detallesPorGrupo[d.grupo_id] = [];
            detallesPorGrupo[d.grupo_id].push(d);
        }

        const data = grupos.map(g => ({
            id: g.id,
            solicitante: g.solicitante,
            ip: g.ip,
            estado: g.estado,
            fecha_pedido: g.fecha_pedido,
            fecha_actualizacion: g.fecha_actualizacion,
            items: detallesPorGrupo[g.id] || []
        }));

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

router.post('/', (req, res, next) => {
    try {
        const { items, solicitante = '' } = req.body;
        const errors = [];

        if (!Array.isArray(items) || items.length === 0) {
            errors.push('Debe incluir al menos un artículo en el pedido.');
        }

        const solStr = String(solicitante).trim();
        if (!solStr) {
            errors.push('El nombre del solicitante es obligatorio.');
        } else if (solStr.length > MAX_SOLICITANTE_LENGTH) {
            errors.push(`El nombre del solicitante no puede exceder ${MAX_SOLICITANTE_LENGTH} caracteres.`);
        }

        if (errors.length > 0) {
            return res.status(400).json({ success: false, message: errors.join(' ') });
        }

        if (Array.isArray(items)) {
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                if (!it.articulo_id || isNaN(Number(it.articulo_id)) || Number(it.articulo_id) <= 0) {
                    errors.push(`Artículo #${i + 1}: ID inválido.`);
                }
                if (it.cantidad === undefined || it.cantidad === null || isNaN(Number(it.cantidad)) ||
                    !Number.isInteger(Number(it.cantidad)) || Number(it.cantidad) <= 0) {
                    errors.push(`Artículo #${i + 1}: cantidad inválida.`);
                } else if (Number(it.cantidad) > MAX_PEDIDO_QTY) {
                    errors.push(`Artículo #${i + 1}: la cantidad no puede exceder ${MAX_PEDIDO_QTY.toLocaleString()}.`);
                }
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ success: false, message: errors.join(' ') });
        }

        const ip = getClientIp(req);

        const insertGrupo = db.prepare("INSERT INTO pedido_grupo (solicitante, ip) VALUES (?, ?)");
        const insertDetalle = db.prepare("INSERT INTO pedido_detalle (grupo_id, articulo_id, cantidad) VALUES (?, ?, ?)");

        const crearPedido = db.transaction(() => {
            const g = insertGrupo.run(sanitize(solStr), ip);
            const grupoId = g.lastInsertRowid;
            for (const it of items) {
                insertDetalle.run(grupoId, parseInt(it.articulo_id, 10), parseInt(it.cantidad, 10));
            }
        });

        crearPedido();

        res.status(201).json({
            success: true,
            message: 'Pedido registrado correctamente.'
        });
    } catch (error) {
        next(error);
    }
});

router.put('/:id/estado', requireAdmin, (req, res, next) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        if (!['En Proceso', 'Entregado', 'Cancelado'].includes(estado)) {
            return res.status(400).json({
                success: false,
                message: "Estado inválido. Use 'En Proceso', 'Entregado' o 'Cancelado'."
            });
        }

        const grupo = db.prepare('SELECT * FROM pedido_grupo WHERE id = ?').get(id);
        if (!grupo) {
            return res.status(404).json({ success: false, message: 'No se encontró el pedido.' });
        }

        if (grupo.estado === 'Entregado' || grupo.estado === 'Cancelado') {
            return res.status(400).json({
                success: false,
                message: 'El pedido ya fue procesado y no puede modificarse.'
            });
        }

        if (grupo.estado === 'Pendiente' && estado === 'En Proceso') {
            db.prepare("UPDATE pedido_grupo SET estado = 'En Proceso', fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?").run(id);
            return res.json({ success: true, message: 'Pedido marcado como en proceso.' });
        }

        if (grupo.estado === 'En Proceso' && estado === 'Cancelado') {
            db.prepare("UPDATE pedido_grupo SET estado = 'Cancelado', fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?").run(id);
            return res.json({ success: true, message: 'El pedido ha sido cancelado.' });
        }

        if (estado === 'Entregado') {
            const detalles = db.prepare(`
                SELECT d.*, a.nombre as articulo_nombre, a.sku, a.cantidad_disponible
                FROM pedido_detalle d
                JOIN articulos a ON d.articulo_id = a.id
                WHERE d.grupo_id = ?
            `).all(id);

            for (const det of detalles) {
                if (det.cantidad_disponible < det.cantidad) {
                    return res.status(400).json({
                        success: false,
                        message: `Stock insuficiente para "${det.articulo_nombre}" (disponible: ${det.cantidad_disponible}, solicitado: ${det.cantidad}).`
                    });
                }
            }

            const entregar = db.transaction(() => {
                for (const det of detalles) {
                    db.prepare('UPDATE articulos SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?')
                        .run(det.cantidad, det.articulo_id);
                    db.prepare(`INSERT INTO movimientos (articulo_id, articulo_nombre, articulo_sku, tipo, cantidad, motivo, usuario) VALUES (?, ?, ?, 'Salida', ?, ?, ?)`)
                        .run(det.articulo_id, det.articulo_nombre, det.sku, det.cantidad,
                            `Pedido #${id}`, grupo.solicitante || 'Desconocido');
                }
                db.prepare("UPDATE pedido_grupo SET estado = 'Entregado', fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?").run(id);
            });
            entregar();

            return res.json({
                success: true,
                message: `Pedido entregado. ${detalles.length} artículo(s) descontado(s) del inventario.`
            });
        }

        if (grupo.estado === 'Pendiente' && estado === 'Cancelado') {
            db.prepare("UPDATE pedido_grupo SET estado = 'Cancelado', fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?").run(id);
            return res.json({ success: true, message: 'El pedido ha sido cancelado.' });
        }

        return res.status(400).json({
            success: false,
            message: 'Transición de estado no permitida.'
        });
    } catch (error) {
        next(error);
    }
});

router.put('/:id/cancelar-personal', (req, res, next) => {
    try {
        const { id } = req.params;
        const grupo = db.prepare('SELECT * FROM pedido_grupo WHERE id = ?').get(id);
        if (!grupo) {
            return res.status(404).json({ success: false, message: 'No se encontró el pedido.' });
        }

        const clientIp = getClientIp(req);
        if (grupo.ip !== clientIp) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para cancelar este pedido.' });
        }

        if (grupo.estado !== 'Pendiente') {
            return res.status(400).json({ success: false, message: 'Solo se pueden cancelar pedidos pendientes.' });
        }

        db.prepare("UPDATE pedido_grupo SET estado = 'Cancelado', fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?").run(id);
        res.json({ success: true, message: 'Pedido cancelado correctamente.' });
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', requireAdmin, (req, res, next) => {
    try {
        const result = db.prepare('DELETE FROM pedido_grupo WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'No se encontró el pedido.' });
        }
        res.json({ success: true, message: 'Pedido eliminado del registro.' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
