/**
 * Middleware Centralizado de Manejo de Errores HTTP y SQLite
 */

function errorHandler(err, req, res, next) {
    console.error('🔥 Error detectado:', err);

    // Errores específicos de SQLite
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({
            success: false,
            message: 'Violación de unicidad: Ya existe un registro con ese valor (ej. SKU o Nombre de categoría duplicado).'
        });
    }

    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        return res.status(400).json({
            success: false,
            message: 'Violación de clave foránea: La categoría especificada no existe o no se puede eliminar por tener artículos vinculados.'
        });
    }

    if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
        return res.status(400).json({
            success: false,
            message: 'Violación de restricción: Los valores numéricos no cumplen con las reglas del almacén (ej. stock negativo).'
        });
    }

    // Error por defecto de servidor
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Error interno del servidor. Intente nuevamente.'
    });
}

module.exports = errorHandler;
