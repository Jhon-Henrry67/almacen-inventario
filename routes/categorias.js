/**
 * Rutas de la API REST para Gestión de Categorías de Suministros
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { validateCategory } = require('../middleware/validation');
const { requireAdmin } = require('../middleware/adminAuth');

// ==========================================
// 1. GET /api/categorias - Obtener todas las categorías con total de artículos
// ==========================================
router.get('/', (req, res, next) => {
    try {
        const sql = `
            SELECT 
                c.id,
                c.nombre,
                c.descripcion,
                c.fecha_creacion,
                COUNT(a.id) as total_articulos,
                COALESCE(SUM(a.cantidad_disponible), 0) as total_unidades
            FROM categorias c
            LEFT JOIN articulos a ON c.id = a.categoria_id
            GROUP BY c.id
            ORDER BY c.nombre ASC
        `;
        const categories = db.prepare(sql).all();

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// 2. GET /api/categorias/:id - Obtener detalle de una categoría
// ==========================================
router.get('/:id', (req, res, next) => {
    try {
        const { id } = req.params;
        const sql = `
            SELECT 
                c.*,
                COUNT(a.id) as total_articulos
            FROM categorias c
            LEFT JOIN articulos a ON c.id = a.categoria_id
            WHERE c.id = ?
            GROUP BY c.id
        `;
        const category = db.prepare(sql).get(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada.'
            });
        }

        res.json({
            success: true,
            data: category
        });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// 3. POST /api/categorias - Crear nueva categoría
// ==========================================
router.post('/', requireAdmin, validateCategory, (req, res, next) => {
    try {
        const { nombre, descripcion } = req.body;

        // Verificar unicidad de nombre
        const existing = db.prepare('SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?)').get(nombre);
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe una categoría con ese nombre.'
            });
        }

        const insertSql = `INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)`;
        const result = db.prepare(insertSql).run(nombre, descripcion);

        const newCategory = db.prepare('SELECT * FROM categorias WHERE id = ?').get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: 'Categoría creada con éxito.',
            data: newCategory
        });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// 4. PUT /api/categorias/:id - Actualizar categoría
// ==========================================
router.put('/:id', requireAdmin, validateCategory, (req, res, next) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;

        const existingCategory = db.prepare('SELECT id FROM categorias WHERE id = ?').get(id);
        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada.'
            });
        }

        // Verificar conflicto de nombre con otra categoría
        const nameConflict = db.prepare('SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?) AND id != ?').get(nombre, id);
        if (nameConflict) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe otra categoría con ese nombre.'
            });
        }

        db.prepare('UPDATE categorias SET nombre = ?, descripcion = ? WHERE id = ?').run(nombre, descripcion, id);

        const updated = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);

        res.json({
            success: true,
            message: 'Categoría actualizada exitosamente.',
            data: updated
        });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// 5. DELETE /api/categorias/:id - Eliminar categoría
// ==========================================
router.delete('/:id', requireAdmin, (req, res, next) => {
    try {
        const { id } = req.params;

        const category = db.prepare('SELECT nombre FROM categorias WHERE id = ?').get(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada.'
            });
        }

        // Verificar si existen artículos asociados a esta categoría
        const articleCount = db.prepare('SELECT COUNT(*) as count FROM articulos WHERE categoria_id = ?').get(id);
        if (articleCount.count > 0) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar la categoría porque tiene ${articleCount.count} artículo(s) asignado(s). Reasigne o elimine los artículos primero.`
            });
        }

        db.prepare('DELETE FROM categorias WHERE id = ?').run(id);

        res.json({
            success: true,
            message: 'Categoría eliminada correctamente.'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
