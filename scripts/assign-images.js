/**
 * Asigna las imágenes generadas a los artículos correspondientes en la BD.
 */
require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './database/almacen.sqlite');
const db = new Database(dbPath);

// Mapeo de imágenes por categoría/tipo de artículo
const imageAssignments = [
    // Rodamientos de bola abiertos (ball-bearing.jpg) - artículos que muestran bolas visibles
    { image: '/img/articulos/ball-bearing.jpg', ids: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,19,20,24,25,26,35,37] },
    
    // Sello NBR (oil-seal.jpg) - sellos y retenes
    { image: '/img/articulos/oil-seal.jpg', ids: [49,50,51,52,53,54,55] },
    
    // Tuerca hexagonal (hex-nut.jpg) - tornillería
    { image: '/img/articulos/hex-nut.jpg', ids: [56,57] },
    
    // Válvula solenoide (solenoid-valve.jpg) - componentes eléctricos
    { image: '/img/articulos/solenoid-valve.jpg', ids: [58,59,60,61,62,63,64] },
    
    // Chumacera (pillow-block.jpg) - chumaceras y rodamientos de inserción
    { image: '/img/articulos/pillow-block.jpg', ids: [21,22,23,33,34,68] },
    
    // Rodamientos especiales usan ball-bearing también
    { image: '/img/articulos/ball-bearing.jpg', ids: [18,27,28,29,30,31,32,36,38,39,40,41,42,43,44,45,46,47,48,67] },
    
    // Repuestos de montacargas - usar solenoid-valve para los eléctricos
    { image: '/img/articulos/pillow-block.jpg', ids: [65,66] },
];

const updateStmt = db.prepare('UPDATE articulos SET imagen = ? WHERE id = ?');

const assign = db.transaction(() => {
    let count = 0;
    for (const group of imageAssignments) {
        for (const id of group.ids) {
            const result = updateStmt.run(group.image, id);
            if (result.changes > 0) count++;
        }
    }
    return count;
});

const total = assign();
db.close();

console.log(`✅ ${total} artículos actualizados con imágenes.`);
