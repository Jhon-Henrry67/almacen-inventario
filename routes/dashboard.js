/**
 * Rutas de la API REST para Métricas del Dashboard y Alertas de Almacén
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/stats', (req, res, next) => {
    try {
        const lowStockThreshold = parseInt(process.env.LOW_STOCK_THRESHOLD, 10) || 10;

        // 1. Total de Artículos Distintos Registrados
        const totalArticulosRow = db.prepare('SELECT COUNT(*) as count FROM articulos').get();
        const totalArticulos = totalArticulosRow.count;

        // 2. Total de Unidades Físicas en Stock
        const totalUnidadesRow = db.prepare('SELECT COALESCE(SUM(cantidad_disponible), 0) as total FROM articulos').get();
        const totalUnidadesStock = totalUnidadesRow.total;

        // 3. Total de Categorías Registradas
        const totalCategoriasRow = db.prepare('SELECT COUNT(*) as count FROM categorias').get();
        const totalCategorias = totalCategoriasRow.count;

        // 4. Conteo de Artículos con Stock Bajo ( > 0 y <= Threshold)
        const stockBajoRow = db.prepare('SELECT COUNT(*) as count FROM articulos WHERE cantidad_disponible > 0 AND cantidad_disponible <= ?').get(lowStockThreshold);
        const stockBajoCount = stockBajoRow.count;

        // 5. Conteo de Artículos Agotados ( = 0 )
        const agotadosRow = db.prepare('SELECT COUNT(*) as count FROM articulos WHERE cantidad_disponible = 0').get();
        const agotadosCount = agotadosRow.count;

        // 6. Lista de Artículos con Alerta (Agotados o Stock Bajo)
        const alertSql = `
            SELECT 
                a.id,
                a.nombre,
                a.sku,
                a.cantidad_disponible,
                c.nombre as categoria_nombre,
                CASE 
                    WHEN a.cantidad_disponible = 0 THEN 'Agotado'
                    ELSE 'Stock Bajo'
                END as estado_alerta
            FROM articulos a
            JOIN categorias c ON a.categoria_id = c.id
            WHERE a.cantidad_disponible <= ?
            ORDER BY a.cantidad_disponible ASC
            LIMIT 10
        `;
        const alertItems = db.prepare(alertSql).all(lowStockThreshold);

        // 7. Distribución de Unidades por Categoría
        const distSql = `
            SELECT 
                c.nombre as categoria,
                COUNT(a.id) as total_articulos,
                COALESCE(SUM(a.cantidad_disponible), 0) as total_unidades
            FROM categorias c
            LEFT JOIN articulos a ON c.id = a.categoria_id
            GROUP BY c.id
            ORDER BY total_unidades DESC
        `;
        const distribucionCategorias = db.prepare(distSql).all();

        res.json({
            success: true,
            data: {
                totalArticulos,
                totalUnidadesStock,
                totalCategorias,
                stockBajoCount,
                agotadosCount,
                alertCountTotal: stockBajoCount + agotadosCount,
                lowStockThreshold,
                alertItems,
                distribucionCategorias
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
