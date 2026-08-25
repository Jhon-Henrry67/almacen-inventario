/**
 * Middleware Centralizado de Manejo de Errores HTTP y SQLite
 * No expone detalles internos en producción.
 */

function errorHandler(err, req, res, next) {
    const isProduction = process.env.NODE_ENV === 'production';

    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({
            success: false,
            message: 'Ya existe un registro con ese valor (SKU o nombre duplicado).'
        });
    }

    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        return res.status(400).json({
            success: false,
            message: 'Referencia inválida: la categoría especificada no existe o tiene artículos vinculados.'
        });
    }

    if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
        return res.status(400).json({
            success: false,
            message: 'Los valores numéricos no cumplen con las reglas del almacén.'
        });
    }

    const status = err.status || 500;

    if (!isProduction && status === 500) {
        console.error('Error no controlado:', err.message);
    }

    res.status(status).json({
        success: false,
        message: 'Error interno del servidor. Intente nuevamente.'
    });
}

module.exports = errorHandler;
