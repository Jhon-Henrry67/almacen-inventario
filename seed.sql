-- ====================================================================
-- DATOS INICIALES DE PRUEBA (SEED) PARA EL ALMACÉN DE SUMINISTROS
-- ====================================================================

-- Insertar Categorías Internas
INSERT OR IGNORE INTO categorias (id, nombre, descripcion) VALUES
(1, 'Oficina y Papelería', 'Materiales de escritura, papel, carpetas y artículos de oficina'),
(2, 'Equipos de Protección (EPP)', 'Cascos, guantes, chalecos reflejantes, gafas de seguridad y mascarillas'),
(3, 'Herramientas y Ferretería', 'Herramientas manuales, tornillería, cintas de embalaje y repuestos'),
(4, 'Tecnología e Informática', 'Cables, teclados, ratones, adaptadores, tóner y periféricos de trabajo'),
(5, 'Limpieza y Mantenimiento', 'Productos de limpieza industrial, desinfectantes, toallas y bolsas');

-- Insertar Artículos de Suministro
INSERT OR IGNORE INTO articulos (id, nombre, descripcion, sku, cantidad_disponible, categoria_id) VALUES
(1, 'Papel Bond A4 (Caja 5 Reamas)', 'Caja de 5 reamas de papel blanco 75g A4 para impresión corporativa', 'OF-PAP-001', 45, 1),
(2, 'Bolígrafos Tintafina Azul (Caja 50u)', 'Bolígrafos retractiles de tinta azul para uso diario en oficinas', 'OF-BOL-002', 120, 1),
(3, 'Casco de Seguridad Industrial Blanco', 'Casco dieléctrico de polietileno de alta densidad con arnés de 4 puntos', 'EPP-CAS-001', 18, 2),
(4, 'Guantes Nitrilo Recubierto (Par - Talla L)', 'Guantes de trabajo antideslizantes para manipulación de carga', 'EPP-GUA-002', 8, 2), -- Stock Bajo (<10)
(5, 'Cinta Embalaje Transparente 48mm', 'Rollo de cinta adhesiva reforzada para sellado de cajas y paquetes', 'FER-CIN-001', 65, 3),
(6, 'Juego de Destornilladores Aislados (6 pzs)', 'Set de destornilladores de precisión dieléctricos hasta 1000V', 'FER-HER-002', 5, 3), -- Stock Bajo (<10)
(7, 'Mouse Óptico USB Ergonómico', 'Mouse de cable USB plug & play para puestos de trabajo informáticos', 'TEC-MOU-001', 25, 4),
(8, 'Teclado Estándar Español USB', 'Teclado QWERTY con teclado numérico y resistencia a derrames', 'TEC-TEC-002', 14, 4),
(9, 'Cable Ethernet Cat6 Patch Cord 3m', 'Cable de red utp con conectores rj45 moldeados en color azul', 'TEC-CAB-003', 30, 4),
(10, 'Tóner Láser Negro HP 85A', 'Cartucho de tóner de alto rendimiento para impresoras departamento', 'TEC-TON-004', 3, 4), -- Stock Bajo (<10)
(11, 'Desinfectante Multiusos 5 Litros', 'Bidón de desinfectante concentrado para superficies de almacén', 'LIM-DES-001', 12, 5),
(12, 'Toallas de Papel Interdobladas (Caja 20u)', 'Caja con 20 paquetes de toallas absorbentes para dispensador', 'LIM-TOA-002', 0, 5); -- Agotado (0)
