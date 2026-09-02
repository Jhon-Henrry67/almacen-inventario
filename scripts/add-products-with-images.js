/**
 * Script: Agrega productos faltantes desde las fotos y genera imágenes únicas (SVG)
 * para cada producto del almacén.
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './database/almacen.sqlite');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const IMG_DIR = path.resolve(__dirname, '..', 'public', 'img', 'articulos');
fs.mkdirSync(IMG_DIR, { recursive: true });

// ============================================================
// 1. Colores y estilos por categoría
// ============================================================
const categoryStyles = {
    1: { // Rodamientos
        bg: '#1a3a5c', accent: '#4fc3f7', icon: '⚙️', label: 'RODAMIENTO',
        colors: ['#1565c0', '#1e88e5', '#2196f3', '#42a5f5', '#0d47a1']
    },
    2: { // Sellos y Retenes
        bg: '#1b5e20', accent: '#81c784', icon: '🔵', label: 'SELLO',
        colors: ['#2e7d32', '#388e3c', '#43a047', '#4caf50', '#1b5e20']
    },
    3: { // Tornillería y Fijación
        bg: '#4a148c', accent: '#ce93d8', icon: '🔩', label: 'Fijación',
        colors: ['#6a1b9a', '#7b1fa2', '#8e24aa', '#9c27b0', '#4a148c']
    },
    4: { // Componentes Eléctricos
        bg: '#b71c1c', accent: '#ef9a9a', icon: '⚡', label: 'ELÉCTRICO',
        colors: ['#c62828', '#d32f2f', '#e53935', '#f44336', '#b71c1c']
    },
    5: { // Repuestos de Montacargas
        bg: '#e65100', accent: '#ffcc80', icon: '🏗️', label: 'MONTACARGAS',
        colors: ['#ef6c00', '#f57c00', '#fb8c00', '#ff9800', '#e65100']
    }
};

// ============================================================
// 2. Generar imagen SVG única para cada producto
// ============================================================
function generateProductSVG(product) {
    const style = categoryStyles[product.categoria_id] || categoryStyles[1];
    const colorIndex = product.id % style.colors.length;
    const bgColor = style.colors[colorIndex];
    const sku = product.sku || 'N/A';
    const nombre = product.nombre || 'Sin nombre';
    
    // Truncar nombre largo para SVG
    const maxLen = 28;
    const displayName = nombre.length > maxLen ? nombre.substring(0, maxLen) + '…' : nombre;
    
    // Patrón de fondo único por producto
    const patternId = `pat-${product.id}`;
    const patternAngle = (product.id * 37) % 360;
    
    // Icono decorativo basado en tipo
    let decorIcon = '⚙️';
    if (product.categoria_id === 1) decorIcon = '⚙️';
    else if (product.categoria_id === 2) decorIcon = '🔵';
    else if (product.categoria_id === 3) decorIcon = '🔩';
    else if (product.categoria_id === 4) decorIcon = '⚡';
    else if (product.categoria_id === 5) decorIcon = '🏗️';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="bg-${product.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#000;stop-opacity:0.6"/>
    </linearGradient>
    <pattern id="${patternId}" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(${patternAngle})">
      <rect width="20" height="20" fill="transparent"/>
      <circle cx="10" cy="10" r="1.5" fill="rgba(255,255,255,0.08)"/>
    </pattern>
    <filter id="shadow-${product.id}">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Fondo -->
  <rect width="400" height="300" fill="url(#bg-${product.id})"/>
  <rect width="400" height="300" fill="url(#${patternId})"/>
  
  <!-- Borde decorativo -->
  <rect x="8" y="8" width="384" height="284" rx="12" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
  
  <!-- Icono grande centrado -->
  <text x="200" y="120" font-size="60" text-anchor="middle" fill="rgba(255,255,255,0.12)">${decorIcon}</text>
  
  <!-- Barra de categoría -->
  <rect x="0" y="0" width="400" height="40" fill="${bgColor}" opacity="0.9"/>
  <text x="20" y="27" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white">${style.label}</text>
  <text x="380" y="27" font-family="Arial, sans-serif" font-size="12" fill="rgba(255,255,255,0.7)" text-anchor="end">#${String(product.id).padStart(3,'0')}</text>
  
  <!-- Nombre del producto -->
  <text x="200" y="180" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle" filter="url(#shadow-${product.id})">${displayName}</text>
  
  <!-- SKU -->
  <rect x="${200 - sku.length * 5.5 - 12}" y="195" width="${sku.length * 11 + 24}" height="28" rx="14" fill="rgba(0,0,0,0.4)"/>
  <text x="200" y="214" font-family="monospace" font-size="13" fill="${style.accent}" text-anchor="middle" font-weight="bold">${sku}</text>
  
  <!-- Línea decorativa -->
  <line x1="60" y2="245" x2="340" y2="245" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
  
  <!-- Footer -->
  <text x="200" y="270" font-family="Arial, sans-serif" font-size="10" fill="rgba(255,255,255,0.4)" text-anchor="middle">Freebuff Almacén</text>
</svg>`;
    
    return svg;
}

// ============================================================
// 3. Productos faltantes a agregar desde las fotos
// ============================================================
const newProducts = [
    {
        nombre: 'Rodamiento de Bola 065081-070',
        descripcion: 'Rodamiento de bola de alta precisión 065081-070, visto en estante azul - imagen 1',
        sku: 'ROD-065081-070',
        cantidad_disponible: 5,
        categoria_id: 1
    },
    {
        nombre: 'Corona 076048-001',
        descripcion: 'Corona industrial 076048-001, vista en estante rojo - imagen 2',
        sku: 'COR-076048-001',
        cantidad_disponible: 3,
        categoria_id: 3
    },
    {
        nombre: 'Kit Rollo de Giro',
        descripcion: 'Kit de repuesto para rollo de giro, visto en estante rojo - imagen 2',
        sku: 'KIT-ROLLO-GIRO',
        cantidad_disponible: 2,
        categoria_id: 5
    },
    {
        nombre: 'Conector de Drive',
        descripcion: 'Conector para unidad de drive/motor, visto en estante azul - imagen 2',
        sku: 'CON-DRIVE-001',
        cantidad_disponible: 4,
        categoria_id: 4
    }
];

// ============================================================
// 4. Ejecutar inserciones y generación de imágenes
// ============================================================
const insertProduct = db.prepare(`
    INSERT INTO articulos (nombre, descripcion, sku, cantidad_disponible, categoria_id, imagen)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const updateImage = db.prepare('UPDATE articulos SET imagen = ? WHERE id = ?');

console.log('🔧 Iniciando proceso de agregar productos y generar imágenes...\n');

// Fase 1: Agregar productos faltantes
console.log('📦 Fase 1: Agregando productos faltantes...');
const addedIds = [];

const addProducts = db.transaction(() => {
    for (const product of newProducts) {
        // Verificar si el SKU ya existe
        const existing = db.prepare('SELECT id FROM articulos WHERE sku = ?').get(product.sku);
        if (existing) {
            console.log(`  ⏭️  SKU ${product.sku} ya existe (ID: ${existing.id}), saltando...`);
            continue;
        }
        
        const result = insertProduct.run(
            product.nombre,
            product.descripcion,
            product.sku,
            product.cantidad_disponible,
            product.categoria_id,
            '' // Imagen se asigna después
        );
        
        const newId = result.lastInsertRowid;
        addedIds.push(newId);
        console.log(`  ✅ Agregado: ${product.nombre} (ID: ${newId}, SKU: ${product.sku})`);
    }
});

addProducts();
console.log(`\n📊 Total productos nuevos agregados: ${addedIds.length}\n`);

// Fase 2: Generar imágenes SVG únicas para TODOS los productos
console.log('🎨 Fase 2: Generando imágenes únicas para cada producto...');

const allProducts = db.prepare('SELECT id, nombre, sku, categoria_id FROM articulos ORDER BY id').all();
let imagesGenerated = 0;

const generateAllImages = db.transaction(() => {
    for (const product of allProducts) {
        const svg = generateProductSVG(product);
        const fileName = `product-${String(product.id).padStart(3, '0')}-${product.sku.replace(/[^a-zA-Z0-9]/g, '')}.svg`;
        const filePath = path.join(IMG_DIR, fileName);
        
        // Escribir SVG
        fs.writeFileSync(filePath, svg, 'utf8');
        
        // Actualizar en BD
        const imagePath = `/img/articulos/${fileName}`;
        updateImage.run(imagePath, product.id);
        
        imagesGenerated++;
    }
});

generateAllImages();
console.log(`  ✅ ${imagesGenerated} imágenes SVG generadas y asignadas\n`);

// Fase 3: Registrar movimientos de entrada para productos nuevos
console.log('📋 Fase 3: Registrando movimientos de entrada...');
const insertMovement = db.prepare(`
    INSERT INTO movimientos (articulo_id, articulo_nombre, articulo_sku, tipo, cantidad, motivo, usuario)
    VALUES (?, ?, ?, 'Entrada', ?, ?, ?)
`);

const registerMovements = db.transaction(() => {
    for (const id of addedIds) {
        const product = db.prepare('SELECT nombre, sku, cantidad_disponible FROM articulos WHERE id = ?').get(id);
        if (product && product.cantidad_disponible > 0) {
            insertMovement.run(
                id,
                product.nombre,
                product.sku,
                product.cantidad_disponible,
                'Alta de inventario desde fotos',
                'Administrador'
            );
            console.log(`  📥 Movimiento registrado: ${product.nombre} (+${product.cantidad_disponible})`);
        }
    }
});

registerMovements();

// ============================================================
// 5. Resumen final
// ============================================================
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN FINAL');
console.log('='.repeat(60));

const totalProducts = db.prepare('SELECT COUNT(*) as total FROM articulos').get();
const totalImages = db.prepare("SELECT COUNT(*) as total FROM articulos WHERE imagen LIKE '/img/articulos/%'").get();
const categories = db.prepare('SELECT c.nombre, COUNT(a.id) as count FROM categorias c LEFT JOIN articulos a ON c.id = a.categoria_id GROUP BY c.id').all();

console.log(`\n  📦 Total productos en BD: ${totalProducts.total}`);
console.log(`  🖼️  Productos con imagen: ${totalImages.total}`);
console.log(`  🆕 Productos nuevos agregados: ${addedIds.length}`);
console.log(`  🎨 Imágenes SVG generadas: ${imagesGenerated}`);

console.log('\n  📂 Distribución por categoría:');
categories.forEach(cat => {
    console.log(`     • ${cat.nombre}: ${cat.count} productos`);
});

console.log('\n  📁 Archivos de imagen en: public/img/articulos/');
const imageFiles = fs.readdirSync(IMG_DIR).filter(f => f.endsWith('.svg'));
console.log(`     Total archivos SVG: ${imageFiles.length}`);

console.log('\n' + '='.repeat(60));
console.log('✅ Proceso completado exitosamente');
console.log('='.repeat(60));

db.close();
