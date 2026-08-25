/**
 * Middleware de Validaciones para Artículos y Categorías
 * Garantiza que la información ingresada cumpla con las reglas del negocio.
 */

function validateArticle(req, res, next) {
    const { nombre, sku, cantidad_disponible, categoria_id } = req.body;
    const errors = [];

    // Validar Nombre
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
        errors.push('El nombre del artículo es obligatorio y no puede estar en blanco.');
    }

    // Validar SKU (opcional: se autogenera en el servidor si no se envía)
    if (sku !== undefined && sku !== null && String(sku).trim() !== '') {
        if (!/^[a-zA-Z0-9\-_]+$/.test(String(sku).trim())) {
            errors.push('El SKU solo debe contener letras, números, guiones y guiones bajos.');
        }
    }

    // Validar Cantidad Disponible (No permitir números negativos)
    if (cantidad_disponible === undefined || cantidad_disponible === null || isNaN(Number(cantidad_disponible))) {
        errors.push('La cantidad disponible debe ser un número entero válido.');
    } else {
        const cant = Number(cantidad_disponible);
        if (!Number.isInteger(cant) || cant < 0) {
            errors.push('La cantidad disponible no puede ser un número negativo ni decimal.');
        }
    }

    // Validar Categoría
    if (!categoria_id || isNaN(Number(categoria_id)) || Number(categoria_id) <= 0) {
        errors.push('Debe seleccionar una categoría válida.');
    }

    // Validar Imagen (opcional): debe ser un data URL de imagen y pesar máximo ~1.5MB
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
            errors: errors
        });
    }

    // Sanitizar strings
    req.body.nombre = nombre.trim();
    req.body.descripcion = req.body.descripcion ? req.body.descripcion.trim() : '';
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
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Error de validación en la categoría',
            errors: errors
        });
    }

    req.body.nombre = nombre.trim();
    req.body.descripcion = req.body.descripcion ? req.body.descripcion.trim() : '';

    next();
}

module.exports = {
    validateArticle,
    validateCategory
};
