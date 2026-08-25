/**
 * Script independiente para ejecutar el Seeding de Datos de Prueba
 */

require('dotenv').config();
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

console.log('🌱 Ejecutando re-inicialización y seed de base de datos...');

const seedPath = path.resolve(__dirname, '../seed.sql');
if (fs.existsSync(seedPath)) {
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    db.exec(seedSql);
    console.log('✅ Seed ejecutado con éxito.');
} else {
    console.error('❌ No se encontró el archivo seed.sql');
}
