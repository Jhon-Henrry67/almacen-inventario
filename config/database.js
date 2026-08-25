/**
 * Módulo de Configuración e Inicialización de Base de Datos SQLite
 * Maneja la conexión, creación del esquema y seeding automático.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno
const dbPathResolved = process.env.DB_PATH || './database/almacen.sqlite';
const fullDbPath = path.resolve(__dirname, '..', dbPathResolved);

// Asegurar que exista el directorio contenedor
const dbDir = path.dirname(fullDbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Inicializar conexión SQLite con mejor rendimiento en lectura/escritura (WAL mode)
const db = new Database(fullDbPath, {
    verbose: process.env.NODE_ENV === 'development' ? null : null
});

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
// Evita errores "SQLITE_BUSY/database is locked" cuando hay varias instancias abiertas
db.pragma('busy_timeout = 4000');

/**
 * Inicializa las tablas ejecutando schema.sql y seed.sql si la base de datos está vacía.
 */
function initDatabase() {
    try {
        const schemaPath = path.resolve(__dirname, '../schema.sql');
        const seedPath = path.resolve(__dirname, '../seed.sql');

        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            db.exec(schemaSql);
        }

        // Migración ligera: columna ip en pedidos (para filtrar solicitudes por equipo)
        const pedCols = db.prepare("PRAGMA table_info(pedidos)").all();
        if (pedCols.length > 0 && !pedCols.some(c => c.name === 'ip')) {
            db.exec("ALTER TABLE pedidos ADD COLUMN ip TEXT NOT NULL DEFAULT ''");
            console.log('🛠️ Migración aplicada: columna pedidos.ip agregada.');
        }

        // Migración ligera: columna imagen en articulos (foto del producto)
        const artCols = db.prepare("PRAGMA table_info(articulos)").all();
        if (artCols.length > 0 && !artCols.some(c => c.name === 'imagen')) {
            db.exec("ALTER TABLE articulos ADD COLUMN imagen TEXT DEFAULT ''");
            console.log('🛠️ Migración aplicada: columna articulos.imagen agregada.');
        }

        // Verificar si la tabla categorias tiene registros; si no, ejecutar seed
        const catCount = db.prepare('SELECT COUNT(*) as count FROM categorias').get();
        if (catCount.count === 0 && fs.existsSync(seedPath)) {
            console.log('🌱 Inicializando datos de prueba (Seed)...');
            const seedSql = fs.readFileSync(seedPath, 'utf8');
            db.exec(seedSql);
            console.log('✅ Base de datos inicializada con éxito.');
        }
    } catch (error) {
        console.error('❌ Error inicializando la base de datos:', error.message);
        throw error;
    }
}

// Ejecutar inicialización al requerir el módulo
initDatabase();

module.exports = db;
