/**
 * Middleware de Validaciones para Artículos y Categorías
 * Garantiza que la información ingresada cumpla con las reglas del negocio.
 */

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_SKU_LENGTH = 50;
const MAX_SOLICITANTE_LENGTH = 100;
const MAX_ARTICLE_QTY = 100000;

function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim();
}

function validateArticle(req, res, next) {
    const { nombre, sku, cantidad_disponible, categoria_id } = req.body;
    const errors = [];

    if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
        errors.push('El nombre del artículo es obligatorio y no puede estar en blanco.');
    } else if (nombre.trim().length > MAX_NAME_LENGTH) {
        errors.push(`El nombre no puede exceder ${MAX_NAME_LENGTH} caracteres.`);
    }

    if (sku !== undefined && sku !== null && String(sku).trim() !== '') {
        const skuStr = String(sku).trim();
        if (skuStr.length > MAX_SKU_LENGTH) {
            errors.push(`El SKU no puede exceder ${MAX_SKU_LENGTH} caracteres.`);
        } else if (!/^[a-zA-Z0-9\-_]+$/.test(skuStr)) {
            errors.push('El SKU solo debe contener letras, números, guiones y guiones bajos.');
        }
    }

    if (req.body.descripcion !== undefined && req.body.descripcion !== null) {
        if (typeof req.body.descripcion === 'string' && req.body.descripcion.length > MAX_DESCRIPTION_LENGTH) {
            errors.push(`La descripción no puede exceder ${MAX_DESCRIPTION_LENGTH} caracteres.`);
        }
    }

    if (cantidad_disponible === undefined || cantidad_disponible === null || isNaN(Number(cantidad_disponible))) {
        errors.push('La cantidad disponible debe ser un número entero válido.');
    } else {
        const cant = Number(cantidad_disponible);
        if (!Number.isInteger(cant) || cant < 0) {
            errors.push('La cantidad disponible no puede ser un número negativo ni decimal.');
        } else if (cant > MAX_ARTICLE_QTY) {
            errors.push(`La cantidad no puede exceder ${MAX_ARTICLE_QTY.toLocaleString()} unidades.`);
        }
    }

    if (!categoria_id || isNaN(Number(categoria_id)) || Number(categoria_id) <= 0) {
        errors.push('Debe seleccionar una categoría válida.');
    }

    if (req.body.imagen !== undefined && req.body.imagen !== null && req.body.imagen !== '') {
        const img = String(req.body.imagen);
        if (!/^data:image\/(png|jpe?g|webp);base64,/.test(img)) {
            errors.push('La foto del producto debe ser una imagen PNG, JPG o WebP.');
        } else if (img.length > 2000000) {
            errors.push('La foto del producto es demasiado grande (máximo ~1.5MB).');
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Error de validación en los datos enviados',
            errors
        });
    }

    req.body.nombre = sanitizeString(nombre);
    req.body.descripcion = req.body.descripcion ? sanitizeString(req.body.descripcion) : '';
    req.body.sku = (sku && String(sku).trim() !== '') ? String(sku).trim().toUpperCase() : undefined;
    req.body.cantidad_disponible = parseInt(cantidad_disponible, 10);
    req.body.categoria_id = parseInt(categoria_id, 10);

    next();
}

function validateCategory(req, res, next) {
    const { nombre } = req.body;
    const errors = [];

    if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
        errors.push('El nombre de la categoría es obligatorio y no puede estar en blanco.');
    } else if (nombre.trim().length > MAX_NAME_LENGTH) {
        errors.push(`El nombre no puede exceder ${MAX_NAME_LENGTH} caracteres.`);
    }

    if (req.body.descripcion !== undefined && req.body.descripcion !== null) {
        if (typeof req.body.descripcion === 'string' && req.body.descripcion.length > MAX_DESCRIPTION_LENGTH) {
            errors.push(`La descripción no puede exceder ${MAX_DESCRIPTION_LENGTH} caracteres.`);
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Error de validación en la categoría',
            errors
        });
    }

    req.body.nombre = sanitizeString(nombre);
    req.body.descripcion = req.body.descripcion ? sanitizeString(req.body.descripcion) : '';

    next();
}

module.exports = {
    validateArticle,
    validateCategory
};
