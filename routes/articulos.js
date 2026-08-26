/**
 * Rutas de la API REST para Gestión de Artículos de Almacén
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { validateArticle } = require('../middleware/validation');
const { requireAdmin } = require('../middleware/adminAuth');

// Directorio donde se guardan las fotos de los artículos
const IMG_DIR = path.resolve(__dirname, '..', 'public', 'img', 'articulos');

/**
 * Guarda una imagen en formato data URL y devuelve la ruta pública.
 * Ej: 'data:image/png;base64,iVBOR...' -> '/img/articulos/art-ABC123.png'
 */
function saveArticleImage(dataUrl, sku) {
    const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(String(dataUrl));
    if (!match) return '';

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');

    // Límite de seguridad: 1.5MB decodificados
    if (buffer.length > 1500000) return '';

    fs.mkdirSync(IMG_DIR, { recursive: true });
    const safeSku = String(sku).replace(/[^a-zA-Z0-9\-_]/g, '');
    const fileName = `art-${safeSku}-${Date.now().toString(36)}.${ext}`;
    fs.writeFileSync(path.join(IMG_DIR, fileName), buffer);

    return `/img/articulos/${fileName}`;
}

/** Elimina el archivo de foto de un artículo (best-effort, con reintentos por bloqueo de Windows) */
function deleteArticleImage(imagenPath) {
    if (!imagenPath || !imagenPath.startsWith('/img/articulos/')) return;
    const publicDir = path.resolve(__dirname, '..', 'public');
    const filePath = path.resolve(__dirname, '..', 'public', imagenPath);
    if (!filePath.startsWith(publicDir)) return;
    const intento = (restantes) => {
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            if (restantes > 0 && (err.code === 'EBUSY' || err.code === 'EPERM')) {
                setTimeout(() => intento(restantes - 1), 500);
            }
        }
    };
    intento(3);
}

/**
 * Barrido de inicio: elimina fotos huérfanas que ya no referencia ningún artículo
 * (puede pasar si un unlink falló por bloqueo del archivo en ese momento).
 */
function sweepOrphanImages() {
    try {
        if (!fs.existsSync(IMG_DIR)) return;
        const filas = db.prepare("SELECT imagen FROM articulos WHERE imagen LIKE '/img/articulos/%'").all();
        const referenciadas = new Set(filas.map(f => path.basename(f.imagen)));
        for (const archivo of fs.readdirSync(IMG_DIR)) {
            if (!referenciadas.has(archivo)) {
                try { fs.unlinkSync(path.join(IMG_DIR, archivo)); } catch (_) {}
            }
        }
    } catch (_) {}
}

// ==========================================
// 1. GET /api/articulos - Obtener listado con filtros y paginación
// ==========================================
router.get('/', (req, res, next) => {
    try {
        const {
            search = '',
            categoria_id = '',
            estado = '',
            page = 1,
            limit = 10,
            sortBy = 'id',
            order = 'DESC'
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
        const offset = (pageNum - 1) * limitNum;

        let whereClauses = [];
        let params = [];

        // Filtro por búsqueda global (Nombre, SKU, Descripción)
        if (search && search.trim() !== '') {
            const searchPattern = `%${search.trim()}%`;
            whereClauses.push('(a.nombre LIKE ? OR a.sku LIKE ? OR a.descripcion LIKE ?)');
            params.push(searchPattern, searchPattern, searchPattern);
        }

        // Filtro por Categoría
        if (categoria_id && !isNaN(Number(categoria_id)) && Number(categoria_id) > 0) {
            whereClauses.push('a.categoria_id = ?');
            params.push(parseInt(categoria_id, 10));
        }

        // Filtro por Estado de Stock (alerta = stock bajo o agotado)
        if (estado === 'alerta') {
            const lowStockThreshold = parseInt(process.env.LOW_STOCK_THRESHOLD, 10) || 10;
            whereClauses.push('a.cantidad_disponible <= ?');
            params.push(lowStockThreshold);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Columnas permitidas para ordenar
        const validSortColumns = {
            'id': 'a.id',
            'nombre': 'a.nombre',
            'sku': 'a.sku',
            'cantidad_disponible': 'a.cantidad_disponible',
            'categoria': 'c.nombre',
            'fecha_ingreso': 'a.fecha_ingreso',
            'ultima_actualizacion': 'a.ultima_actualizacion'
        };
        const sortColumn = validSortColumns[sortBy] || 'a.id';
        const sortOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Consulta de Conteo Total
        const countSql = `
            SELECT COUNT(*) as total 
            FROM articulos a
            ${whereSql}
        `;
        const totalResult = db.prepare(countSql).get(...params);
        const totalItems = totalResult.total;
        const totalPages = Math.ceil(totalItems / limitNum) || 1;

        // Consulta de Datos Paginados
        const dataSql = `
            SELECT 
                a.id,
                a.nombre,
                a.descripcion,
                a.sku,
                a.cantidad_disponible,
                a.imagen,
                a.categoria_id,
                c.nombre as categoria_nombre,
                a.fecha_ingreso,
                a.ultima_actualizacion
            FROM articulos a
            JOIN categorias c ON a.categoria_id = c.id
            ${whereSql}
            ORDER BY ${sortColumn} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        
        const articles = db.prepare(dataSql).all(...params, limitNum, offset);

        res.json({
            success: true,
            data: articles,
            pagination: {
                totalItems,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// 2. GET /api/articulos/export/csv - Exportar inventario en formato CSV
// ==========================================
router.get('/export/csv', (req, res, next) => {
    try {
        const sql = `
            SELECT 
                a.id,
                a.sku,
                a.nombre,
                a.descripcion,
                c.nombre as categoria,
                a.cantidad_disponible,
                a.fecha_ingreso,
                a.ultima_actualizacion
            FROM articulos a
            JOIN categorias c ON a.categoria_id = c.id
            ORDER BY a.nombre ASC
        `;
        const rows = db.prepare(sql).all();

        // Encabezados CSV
        let csvContent = 'ID,SKU,Nombre,Descripción,Categoría,Cantidad Disponible,Fecha Ingreso,Última Actualización\n';
        
        rows.forEach(r => {
            const descSanitized = `"${(r.descripcion || '').replace(/"/g, '""')}"`;
            const nombreSanitized = `"${(r.nombre || '').replace(/"/g, '""')}"`;
            csvContent += `${r.id},${r.sku},${nombreSanitized},${descSanitized},"${r.categoria}",${r.cantidad_disponible},"${r.fecha_ingreso}","${r.ultima_actualizacion}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=inventario_almacen_${Date.now()}.csv`);
        res.status(200).send('\uFEFF' + csvContent); // Incluir BOM UTF-8 para compatibilidad Excel
    } catch (error) {
        next(error);
    }
});

// ==========================================
// 3. GET /api/articulos/:id - Obtener un artículo por ID
// ==========================================
router.get('/:id', (req, res, next) => {
    try {
        const { id } = req.params;
        const sql = `
            SELECT 
                a.id,
                a.nombre,
                a.descripcion,
                a.sku,
                a.cantidad_disponible,
                a.imagen,
                a.categoria_id,
                c.nombre as categoria_nombre,
                a.fecha_ingreso,
                a.ultima_actualizacion
            FROM articulos a
            JOIN categorias c ON a.categoria_id = c.id
            WHERE a.id = ?
        `;
        const article = db.prepare(sql).get(id);

        if (!article) {
            return res.status(404).json({
                success: false,
                message: 'El artículo solicitado no existe en el inventario.'
            });
        }

        res.json({
            success: true,
            data: article
        });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// 4. POST /api/articulos - Crear nuevo artículo
// ==========================================
router.post('/', requireAdmin, validateArticle, (req, res, next) => {
    try {
        const { nombre, descripcion, cantidad_disponible, categoria_id } = req.body;

        // Verificar si la categoría existe
        const cat = db.prepare('SELECT id FROM categorias WHERE id = ?').get(categoria_id);
        if (!cat) {
            return res.status(400).json({
                success: false,
                message: 'La categoría seleccionada no existe.'
            });
        }

        // Verificar si el SKU ya existe (solo si fue proporcionado)
        if (req.body.sku) {
            const existingSku = db.prepare('SELECT id FROM articulos WHERE sku = ?').get(req.body.sku);
            if (existingSku) {
                return res.status(400).json({
                    success: false,
                    message: 'El código SKU ingresado ya está registrado para otro artículo.'
                });
            }
        }

        // Autogenerar SKU único si no se envió uno
        let sku = req.body.sku;
        if (!sku) {
            const prefix = nombre.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'ART';
            do {
                sku = `${prefix}-${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
            } while (db.prepare('SELECT id FROM articulos WHERE sku = ?').get(sku));
        }

        const insertSql = `
            INSERT INTO articulos (nombre, descripcion, sku, cantidad_disponible, categoria_id, imagen)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const imagenPath = req.body.imagen ? saveArticleImage(req.body.imagen, sku) : '';
        const result = db.prepare(insertSql).run(nombre, descripcion, sku, cantidad_disponible, categoria_id, imagenPath);

        if (cantidad_disponible > 0) {
            db.prepare(`INSERT INTO movimientos (articulo_id, articulo_nombre, articulo_sku, tipo, cantidad, motivo, usuario) VALUES (?, ?, ?, 'Entrada', ?, ?, ?)`).run(
                result.lastInsertRowid, nombre, sku, cantidad_disponible, 'Alta de inventario', 'Administrador'
            );
        }

        // Obtener el registro recién insertado
        const newArticle = db.prepare(`
            SELECT a.*, c.nombre as categoria_nombre 
            FROM articulos a 
            JOIN categorias c ON a.categoria_id = c.id 
            WHERE a.id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: 'Artículo agregado al almacén correctamente.',
            data: newArticle
        });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// 5. PUT /api/articulos/:id - Actualizar artículo existente
// ==========================================
router.put('/:id', requireAdmin, validateArticle, (req, res, next) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, cantidad_disponible, categoria_id } = req.body;

        // Verificar existencia del artículo
        const existingArticle = db.prepare('SELECT id FROM articulos WHERE id = ?').get(id);
        if (!existingArticle) {
            return res.status(404).json({
                success: false,
                message: 'No se encontró el artículo a actualizar.'
            });
        }

        // Conservar el SKU actual si no se envió uno nuevo
        const currentArticle = db.prepare('SELECT sku, imagen, cantidad_disponible FROM articulos WHERE id = ?').get(id);
        const sku = req.body.sku || currentArticle.sku;

        // Foto del producto: nueva imagen, eliminación (''), o conservar la actual (undefined)
        let imagen = currentArticle.imagen;
        if (req.body.imagen === '') {
            deleteArticleImage(currentArticle.imagen);
            imagen = '';
        } else if (req.body.imagen) {
            const nueva = saveArticleImage(req.body.imagen, sku);
            if (nueva) {
                deleteArticleImage(currentArticle.imagen);
                imagen = nueva;
            }
        }

        // Verificar unicidad de SKU (exceptuando el artículo actual)
        const skuConflict = db.prepare('SELECT id FROM articulos WHERE sku = ? AND id != ?').get(sku, id);
        if (skuConflict) {
            return res.status(400).json({
                success: false,
                message: 'El código SKU ingresado pertenece a otro artículo registrado.'
            });
        }

        // Verificar categoría
        const cat = db.prepare('SELECT id FROM categorias WHERE id = ?').get(categoria_id);
        if (!cat) {
            return res.status(400).json({
                success: false,
                message: 'La categoría seleccionada no existe.'
            });
        }

        const updateSql = `
            UPDATE articulos
            SET nombre = ?,
                descripcion = ?,
                sku = ?,
                cantidad_disponible = ?,
                categoria_id = ?,
                imagen = ?
            WHERE id = ?
        `;
        db.prepare(updateSql).run(nombre, descripcion, sku, cantidad_disponible, categoria_id, imagen || '', id);

        if (cantidad_disponible > currentArticle.cantidad_disponible) {
            const diff = cantidad_disponible - currentArticle.cantidad_disponible;
            db.prepare(`INSERT INTO movimientos (articulo_id, articulo_nombre, articulo_sku, tipo, cantidad, motivo, usuario) VALUES (?, ?, ?, 'Entrada', ?, ?, ?)`).run(
                id, nombre, sku, diff, 'Relleno de stock', 'Administrador'
            );
        }

        const updatedArticle = db.prepare(`
            SELECT a.*, c.nombre as categoria_nombre 
            FROM articulos a 
            JOIN categorias c ON a.categoria_id = c.id 
            WHERE a.id = ?
        `).get(id);

        res.json({
            success: true,
            message: 'Artículo actualizado exitosamente.',
            data: updatedArticle
        });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// 6. DELETE /api/articulos/:id - Eliminar un artículo
// ==========================================
router.delete('/:id', requireAdmin, (req, res, next) => {
    try {
        const { id } = req.params;
        const existingArticle = db.prepare('SELECT nombre, imagen FROM articulos WHERE id = ?').get(id);

        if (!existingArticle) {
            return res.status(404).json({
                success: false,
                message: 'No se encontró el artículo a eliminar.'
            });
        }

        db.prepare('DELETE FROM articulos WHERE id = ?').run(id);
        deleteArticleImage(existingArticle.imagen);

        res.json({
            success: true,
            message: `El artículo '${existingArticle.nombre}' ha sido eliminado del almacén.`
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
module.exports.sweepOrphanImages = sweepOrphanImages;
