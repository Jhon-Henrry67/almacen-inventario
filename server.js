/**
 * Servidor Principal - Sistema de Gestión de Almacén e Inventario General
 * Express HTTP Server & API Entry Point
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Inicializar conexión a la base de datos
const db = require('./config/database');

// Importar rutas de la API
const articulosRoutes = require('./routes/articulos');
const categoriasRoutes = require('./routes/categorias');
const dashboardRoutes = require('./routes/dashboard');
const pedidosRoutes = require('./routes/pedidos');
const authRoutes = require('./routes/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del Frontend
// El código (html/js/css) siempre se revalida para que el navegador nunca use versiones viejas en caché
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (/\.(html|js|css)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Registrar Endpoints de la API REST
app.use('/api/articulos', articulosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/auth', authRoutes);

// Ruta por defecto para la SPA
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware Centralizado de Manejo de Errores
app.use(errorHandler);

// Iniciar Servidor HTTP (si el puerto está ocupado, prueba con el siguiente)
const PORT_BASE = parseInt(process.env.PORT, 10) || 5000;

// Limpia fotos de artículos que ya no están referenciadas en la base de datos
require('./routes/articulos').sweepOrphanImages();

function iniciarServidor(puerto, intentos = 10) {
    const server = app.listen(puerto, () => {
        console.log(`=======================================================`);
        console.log(`📦 SISTEMA DE GESTIÓN DE ALMACÉN E INVENTARIO GENERAL`);
        console.log(`🚀 Servidor ejecutándose en: http://localhost:${puerto}`);
        console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
        console.log(`=======================================================`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && intentos > 0) {
            console.log(`⚠️  El puerto ${puerto} está ocupado. Probando con ${puerto + 1}...`);
            iniciarServidor(puerto + 1, intentos - 1);
        } else {
            console.error('❌ No se pudo iniciar el servidor:', err.message);
            process.exit(1);
        }
    });
}

iniciarServidor(PORT_BASE);

module.exports = app;
