/**
 * Servidor Principal - Sistema de Gestión de Almacén e Inventario General
 * Express HTTP Server & API Entry Point
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./config/database');

const articulosRoutes = require('./routes/articulos');
const categoriasRoutes = require('./routes/categorias');
const dashboardRoutes = require('./routes/dashboard');
const pedidosRoutes = require('./routes/pedidos');
const authRoutes = require('./routes/auth');
const movimientosRoutes = require('./routes/movimientos');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

const allowedOrigin = process.env.ALLOWED_ORIGIN || process.env.RENDER_EXTERNAL_URL || null;
app.use(cors({
    origin: allowedOrigin ? [allowedOrigin] : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-session-token'],
    credentials: true
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (/\.(html|js|css)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

app.use('/api/articulos', articulosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/movimientos', movimientosRoutes);

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(errorHandler);

require('./routes/articulos').sweepOrphanImages();

setInterval(() => {
    try {
        const grupos = db.prepare("SELECT id FROM pedido_grupo WHERE estado != 'Pendiente' AND fecha_actualizacion < datetime('now', '-10 minutes')").all();
        if (grupos.length > 0) {
            const ids = grupos.map(g => g.id);
            const placeholders = ids.map(() => '?').join(',');
            db.prepare(`DELETE FROM pedido_detalle WHERE grupo_id IN (${placeholders})`).run(...ids);
            db.prepare(`DELETE FROM pedido_grupo WHERE id IN (${placeholders})`).run(...ids);
            console.log(`Limpieza: ${grupos.length} pedido(s) resuelto(s) eliminado(s).`);
        }
    } catch (err) {
        console.error('Error en limpieza de pedidos:', err.message);
    }
}, 60000);

function iniciarServidor(puerto, intentos = 10) {
    const server = app.listen(puerto, () => {
        console.log(`Servidor activo en puerto ${puerto} [${process.env.NODE_ENV || 'development'}]`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && intentos > 0) {
            iniciarServidor(puerto + 1, intentos - 1);
        } else {
            console.error('No se pudo iniciar el servidor:', err.message);
            process.exit(1);
        }
    });
}

iniciarServidor(parseInt(process.env.PORT, 10) || 5000);

module.exports = app;
