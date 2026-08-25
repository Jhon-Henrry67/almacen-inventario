-- ====================================================================
-- SISTEMA DE GESTIÓN DE ALMACÉN E INVENTARIO GENERAL (SUMINISTROS INTERNOS)
-- ESQUEMA DE BASE DE DATOS SQL (SQLite / PostgreSQL Compatible)
-- ====================================================================

-- Habilitar soporte de claves foráneas
PRAGMA foreign_keys = ON;

-- --------------------------------------------------------------------
-- Tabla: categorias
-- Almacena las categorías de suministros y materiales del almacén
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- Tabla: articulos
-- Almacena los artículos y materiales del almacén de suministros internos
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articulos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    sku TEXT NOT NULL UNIQUE,
    cantidad_disponible INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
    categoria_id INTEGER NOT NULL,
    imagen TEXT DEFAULT '',
    fecha_ingreso DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultima_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- --------------------------------------------------------------------
-- Tabla: pedidos
-- Registro de solicitudes de artículos del almacén (pedidos internos)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    articulo_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    solicitante TEXT DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Entregado', 'Cancelado')),
    fecha_pedido DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (articulo_id) REFERENCES articulos(id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- Índices para optimizar búsquedas frecuentes
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_articulos_categoria ON articulos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_articulos_sku ON articulos(sku);
CREATE INDEX IF NOT EXISTS idx_articulos_nombre ON articulos(nombre);
CREATE INDEX IF NOT EXISTS idx_pedidos_articulo ON pedidos(articulo_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);

-- --------------------------------------------------------------------
-- Trigger para actualizar automáticamente 'ultima_actualizacion' al modificar un artículo
-- --------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS update_articulos_timestamp
AFTER UPDATE ON articulos
FOR EACH ROW
BEGIN
    UPDATE articulos 
    SET ultima_actualizacion = CURRENT_TIMESTAMP 
    WHERE id = OLD.id;
END;
