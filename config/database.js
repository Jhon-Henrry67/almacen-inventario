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

        // Migración: tabla de movimientos de stock
        db.exec(`
            CREATE TABLE IF NOT EXISTS movimientos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                articulo_id INTEGER NOT NULL,
                articulo_nombre TEXT NOT NULL DEFAULT '',
                articulo_sku TEXT NOT NULL DEFAULT '',
                tipo TEXT NOT NULL CHECK(tipo IN ('Entrada', 'Salida')),
                cantidad INTEGER NOT NULL,
                motivo TEXT NOT NULL DEFAULT '',
                usuario TEXT NOT NULL DEFAULT '',
                fecha_movimiento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (articulo_id) REFERENCES articulos(id) ON DELETE CASCADE
            )
        `);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_movimientos_articulo ON movimientos(articulo_id);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha_movimiento);`);
        console.log('🛠️ Migración aplicada: tabla movimientos creada/verificada.');

        // Migración: tablas pedido_grupo y pedido_detalle
        const hasGrupoTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pedido_grupo'").get();
        if (!hasGrupoTable) {
            db.exec(`
                CREATE TABLE IF NOT EXISTS pedido_grupo (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    solicitante TEXT NOT NULL DEFAULT '',
                    ip TEXT NOT NULL DEFAULT '',
                    estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK(estado IN ('Pendiente', 'En Proceso', 'Entregado', 'Cancelado')),
                    fecha_pedido DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS pedido_detalle (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    grupo_id INTEGER NOT NULL,
                    articulo_id INTEGER NOT NULL,
                    cantidad INTEGER NOT NULL CHECK(cantidad > 0),
                    FOREIGN KEY (grupo_id) REFERENCES pedido_grupo(id) ON DELETE CASCADE,
                    FOREIGN KEY (articulo_id) REFERENCES articulos(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_pedido_grupo_estado ON pedido_grupo(estado);
                CREATE INDEX IF NOT EXISTS idx_pedido_detalle_grupo ON pedido_detalle(grupo_id);
            `);
            console.log('🛠️ Migración aplicada: tablas pedido_grupo y pedido_detalle creadas.');

            // Migrar pedidos existentes a la nueva estructura
            const oldPedidos = db.prepare("SELECT * FROM pedidos WHERE estado = 'Pendiente'").all();
            if (oldPedidos.length > 0) {
                const insertGrupo = db.prepare("INSERT INTO pedido_grupo (solicitante, ip, estado, fecha_pedido) VALUES (?, ?, ?, ?)");
                const insertDetalle = db.prepare("INSERT INTO pedido_detalle (grupo_id, articulo_id, cantidad) VALUES (?, ?, ?)");
                const migrate = db.transaction(() => {
                    for (const p of oldPedidos) {
                        const g = insertGrupo.run(p.solicitante, p.ip, p.estado, p.fecha_pedido);
                        insertDetalle.run(g.lastInsertRowid, p.articulo_id, p.cantidad);
                    }
                });
                migrate();
                console.log(`🛠️ Migrados ${oldPedidos.length} pedidos existentes.`);
            }
        }

        // Migración: agregar 'En Proceso' al CHECK constraint de pedido_grupo
        const grupoCheck = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pedido_grupo'").get();
        if (grupoCheck && !grupoCheck.sql.includes("'En Proceso'")) {
            db.exec(`
                CREATE TABLE pedido_grupo_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    solicitante TEXT NOT NULL DEFAULT '',
                    ip TEXT NOT NULL DEFAULT '',
                    estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK(estado IN ('Pendiente', 'En Proceso', 'Entregado', 'Cancelado')),
                    fecha_pedido DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO pedido_grupo_new SELECT id, solicitante, ip, estado, fecha_pedido, fecha_actualizacion FROM pedido_grupo;
                DROP TABLE pedido_grupo;
                ALTER TABLE pedido_grupo_new RENAME TO pedido_grupo;
                CREATE INDEX IF NOT EXISTS idx_pedido_grupo_estado ON pedido_grupo(estado);
            `);
            console.log('🛠️ Migración aplicada: pedido_grupo CHECK constraint actualizado con "En Proceso".');
        }

        // Verificar si la tabla categorias tiene registros; si no, ejecutar seed
        const catCount = db.prepare('SELECT COUNT(*) as count FROM categorias').get();
        if (catCount.count === 0 && fs.existsSync(seedPath)) {
            console.log('🌱 Inicializando datos de prueba (Seed)...');
            const seedSql = fs.readFileSync(seedPath, 'utf8');
            db.exec(seedSql);
            console.log('✅ Base de datos inicializada con éxito.');
        }

        // Migración: Reemplazar datos viejos de oficina con productos industriales
        const oldCat = db.prepare("SELECT id FROM categorias WHERE id = 1 AND nombre LIKE '%Oficina%'").get();
        if (oldCat && fs.existsSync(seedPath)) {
            console.log('🔄 Migración: Reemplazando productos viejos con productos industriales...');
            db.exec('DELETE FROM pedido_detalle');
            db.exec('DELETE FROM pedido_grupo');
            db.exec('DELETE FROM movimientos');
            db.exec('DELETE FROM articulos');
            db.exec('DELETE FROM categorias');
            db.exec('DELETE FROM sessions');
            const seedSql = fs.readFileSync(seedPath, 'utf8');
            db.exec(seedSql);
            console.log('✅ Migración completada: Productos industriales cargados.');
        }
    } catch (error) {
        console.error('❌ Error inicializando la base de datos:', error.message);
        throw error;
    }
}

// Ejecutar inicialización al requerir el módulo
initDatabase();

module.exports = db;
