/**
 * Script para re-inicializar la base de datos con los nuevos artículos industriales.
 * ADVERTENCIA: Esto BORRA todos los datos existentes y recrea desde cero.
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPathResolved = process.env.DB_PATH || './database/almacen.sqlite';
const fullDbPath = path.resolve(__dirname, '..', dbPathResolved);

// Eliminar base de datos existente
if (fs.existsSync(fullDbPath)) {
    fs.unlinkSync(fullDbPath);
    console.log('🗑️  Base de datos anterior eliminada.');
}

// Eliminar archivos WAL y SHM si existen
[fullDbPath + '-wal', fullDbPath + '-shm'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
});

// Eliminar fotos de artículos anteriores
const imgDir = path.resolve(__dirname, '..', 'public', 'img', 'articulos');
if (fs.existsSync(imgDir)) {
    for (const file of fs.readdirSync(imgDir)) {
        fs.unlinkSync(path.join(imgDir, file));
    }
    console.log('🗑️  Fotos de artículos anteriores eliminadas.');
}

// Recrear base de datos
console.log('🔧 Creando nueva base de datos...');
const db = new Database(fullDbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Ejecutar schema
const schemaPath = path.resolve(__dirname, '..', 'schema.sql');
if (fs.existsSync(schemaPath)) {
    db.exec(fs.readFileSync(schemaPath, 'utf8'));
    console.log('✅ Esquema creado.');
}

// Ejecutar migraciones necesarias
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
    );
    CREATE INDEX IF NOT EXISTS idx_movimientos_articulo ON movimientos(articulo_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha_movimiento);

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
console.log('✅ Migraciones aplicadas.');

// Ejecutar seed
const seedPath = path.resolve(__dirname, '..', 'seed.sql');
if (fs.existsSync(seedPath)) {
    db.exec(fs.readFileSync(seedPath, 'utf8'));
    console.log('✅ Seed ejecutado con éxito.');
}

// Registrar movimientos de entrada inicial para todos los artículos
const articulos = db.prepare('SELECT id, nombre, sku, cantidad_disponible FROM articulos').all();
const insertMov = db.prepare(`INSERT INTO movimientos (articulo_id, articulo_nombre, articulo_sku, tipo, cantidad, motivo, usuario) VALUES (?, ?, ?, 'Entrada', ?, ?, ?)`);
const crearMovimientos = db.transaction(() => {
    for (const art of articulos) {
        if (art.cantidad_disponible > 0) {
            insertMov.run(art.id, art.nombre, art.sku, art.cantidad_disponible, 'Alta de inventario', 'Administrador');
        }
    }
});
crearMovimientos();

db.close();

const total = articulos.length;
console.log(`\n🎉 Base de datos re-inicializada con ${total} artículos industriales.`);
console.log('   Categorías: Rodamientos, Sellos y Retenes, Tornillería, Componentes Eléctricos, Repuestos de Montacargas');
console.log('\n🚀 Reinicia el servidor con: npm start');
