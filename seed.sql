-- ====================================================================
-- DATOS INICIALES - ALMACÉN DE REPUESTOS INDUSTRIALES
-- ====================================================================

-- Insertar Categorías de Repuestos Industriales
INSERT OR IGNORE INTO categorias (id, nombre, descripcion) VALUES
(1, 'Rodamientos', 'Rodamientos de bola, rodillos, cónicos, de agujas y chumaceras para maquinaria industrial'),
(2, 'Sellos y Retenes', 'Sellos mecánicos, retenes, o-rings, kits de sello y empaques para sistemas hidráulicos'),
(3, 'Tornillería y Fijación', 'Tuercas, pernos, tornillos, arandelas y elementos de sujeción industrial'),
(4, 'Componentes Eléctricos', 'Válvulas solenoides, contactores, potenciómetros, switches, conectores y tarjetas electrónicas'),
(5, 'Repuestos de Montacargas', 'Partes y piezas específicas para montacargas y pallet manual: ruedas, ejes, escobillas y kits');

-- Insertar Artículos del Almacén (Repuestos Industriales)
INSERT OR IGNORE INTO articulos (id, nombre, descripcion, sku, cantidad_disponible, categoria_id, imagen) VALUES

-- ═══════════════════════════════════════════════════════════════
-- CATEGORÍA 1: RODAMIENTOS
-- ═══════════════════════════════════════════════════════════════
(1,  'Rodamiento de Bola 6000',         'Rodamiento rígido de bolas 6000 2RS sellado, uso general en ejes y poleas',        'ROD-6000-001', 24, 1, '/img/articulos/product-001-ROD6000001.svg'),
(2,  'Rodamiento de Bola 6002',         'Rodamiento rígido de bolas 6002 2RS sellado para aplicaciones de carga ligera',    'ROD-6002-002', 18, 1, '/img/articulos/product-002-ROD6002002.svg'),
(3,  'Rodamiento de Bola 6004',         'Rodamiento rígido de bolas 6004 2RS para motores y transmisiones',                 'ROD-6004-003', 15, 1, '/img/articulos/product-003-ROD6004003.svg'),
(4,  'Rodamiento de Bola 6006',         'Rodamiento rígido de bolas 6006 2RS de alta velocidad',                            'ROD-6006-004', 12, 1, '/img/articulos/product-004-ROD6006004.svg'),
(5,  'Rodamiento de Bola 6008',         'Rodamiento de bolas profundo 6008 2RS para cargas radiales',                       'ROD-6008-005', 10, 1, '/img/articulos/product-005-ROD6008005.svg'),
(6,  'Rodamiento de Bola 6010',         'Rodamiento de bola sellado 6010 para equipos de transporte',                       'ROD-6010-006', 8,  1, '/img/articulos/product-006-ROD6010006.svg'),
(7,  'Rodamiento de Bola 6012',         'Rodamiento rígido 6012 2RS para aplicaciones de servicio pesado',                  'ROD-6012-007', 6,  1, '/img/articulos/product-007-ROD6012007.svg'),
(8,  'Rodamiento de Bola 6200',         'Rodamiento 6200 2RS serie liviana para ejes pequeños',                             'ROD-6200-008', 20, 1, '/img/articulos/product-008-ROD6200008.svg'),
(9,  'Rodamiento de Bola 6204',         'Rodamiento 6204 2RS de uso frecuente en maquinaria rotativa',                      'ROD-6204-009', 22, 1, '/img/articulos/product-009-ROD6204009.svg'),
(10, 'Rodamiento de Bola 6206',         'Rodamiento rígido de bolas 6206 2RS para ventiladores y bombas',                   'ROD-6206-010', 14, 1, '/img/articulos/product-010-ROD6206010.svg'),
(11, 'Rodamiento de Bola 6208',         'Rodamiento 6208 2RS para transmisiones y cajas reductoras',                        'ROD-6208-011', 10, 1, '/img/articulos/product-011-ROD6208011.svg'),
(12, 'Rodamiento de Bola 6210',         'Rodamiento de bolas profundo 6210 2RS para cargas medias',                         'ROD-6210-012', 8,  1, '/img/articulos/product-012-ROD6210012.svg'),
(13, 'Rodamiento de Bola 6212',         'Rodamiento 6212 2RS para aplicaciones de alta carga radial',                       'ROD-6212-013', 6,  1, '/img/articulos/product-013-ROD6212013.svg'),
(14, 'Rodamiento de Bola 6022',         'Rodamiento rígido 6022 de gran diámetro para ejes principales',                    'ROD-6022-014', 4,  1, '/img/articulos/product-014-ROD6022014.svg'),
(15, 'Rodamiento de Bola 6300',         'Rodamiento 6300 2RS serie reforzada para cargas pesadas',                          'ROD-6300-015', 16, 1, '/img/articulos/product-015-ROD6300015.svg'),
(16, 'Rodamiento de Bola 6302',         'Rodamiento rígido 6302 2RS para motores eléctricos industriales',                  'ROD-6302-016', 14, 1, '/img/articulos/product-016-ROD6302016.svg'),
(17, 'Rodamiento de Bola 6304',         'Rodamiento 6304 2RS serie pesada para maquinaria de producción',                   'ROD-6304-017', 12, 1, '/img/articulos/product-017-ROD6304017.svg'),
(18, 'Rodamiento 22205',                'Rodamiento de rodillos esféricos 22205 para desalineación de ejes',                'ROD-22205-018', 5, 1, '/img/articulos/product-018-ROD22205018.svg'),
(19, 'Rodamiento de Bola 6309',         'Rodamiento 6309 2RS para cajas de engranajes y reductores',                        'ROD-6309-019', 7,  1, '/img/articulos/product-019-ROD6309019.svg'),
(20, 'Rodamiento de Bola 6311',         'Rodamiento rígido 6311 de alta capacidad para ejes principales',                   'ROD-6311-020', 4,  1, '/img/articulos/product-020-ROD6311020.svg'),
(21, 'Rodamiento Y25',                  'Rodamiento tipo Y con prisionero para chumaceras de pie',                          'ROD-Y25-021',  6,  1, '/img/articulos/product-021-RODY25021.svg'),
(22, 'Rodamiento MU206',                'Rodamiento de inserción MU206 para unidades de chumacera',                         'ROD-MU206-022', 8, 1, '/img/articulos/product-022-RODMU206022.svg'),
(23, 'Rodamiento UC208',                'Rodamiento de inserción UC208 con tornillo prisionero',                            'ROD-UC208-023', 10, 1, '/img/articulos/product-023-RODUC208023.svg'),
(24, 'Rodamiento de Bola 2203',         'Rodamiento autoalineable 2203 para ejes con desalineación',                        'ROD-2203-024', 5,  1, '/img/articulos/product-024-ROD2203024.svg'),
(25, 'Rodamiento de Bola 2211',         'Rodamiento autoalineable 2211 de doble hilera',                                    'ROD-2211-025', 3,  1, '/img/articulos/product-025-ROD2211025.svg'),
(26, 'Rodamiento de Bola 6905',         'Rodamiento de sección delgada 6905 para espacios reducidos',                       'ROD-6905-026', 8,  1, '/img/articulos/product-026-ROD6905026.svg'),
(27, 'Rodamiento Cónico 32007',         'Rodamiento de rodillos cónicos 32007 para cargas axiales y radiales',              'ROD-32007-027', 6, 1, '/img/articulos/product-027-ROD32007027.svg'),
(28, 'Rodamiento de Bola 7305',         'Rodamiento de contacto angular 7305 para cargas combinadas',                       'ROD-7305-028', 7,  1, '/img/articulos/product-028-ROD7305028.svg'),
(29, 'Rodamiento de Bola 7205',         'Rodamiento de contacto angular 7205 de alta precisión',                            'ROD-7205-029', 9,  1, '/img/articulos/product-029-ROD7205029.svg'),
(30, 'Rodamiento Axial 51112',          'Rodamiento de bolas axial 51112 para cargas de empuje',                            'ROD-51112-030', 5, 1, '/img/articulos/product-030-ROD51112030.svg'),
(31, 'Rodamiento Cónico 30206',         'Rodamiento cónico 30206 para ejes de transmisión',                                 'ROD-30206-031', 6, 1, '/img/articulos/product-031-ROD30206031.svg'),
(32, 'Rodamiento de Bola 5208',         'Rodamiento de contacto angular doble hilera 5208',                                 'ROD-5208-032', 4,  1, '/img/articulos/product-032-ROD5208032.svg'),
(33, 'Chumacera UCP205',                'Chumacera de pie UCP205 con rodamiento de inserción integrado',                    'ROD-UCP205-033', 8, 1, '/img/articulos/product-033-RODUCP205033.svg'),
(34, 'Chumacera UCT207',                'Chumacera tensora UCT207 para bandas transportadoras',                             'ROD-UCT207-034', 5, 1, '/img/articulos/product-034-RODUCT207034.svg'),
(35, 'Rodamiento de Bola 608',          'Rodamiento miniatura 608 2RS para poleas y ejes pequeños',                         'ROD-608-035', 30, 1, '/img/articulos/product-035-ROD608035.svg'),
(36, 'Rodamiento Cónico 30213',         'Rodamiento de rodillos cónicos 30213 para maquinaria pesada',                      'ROD-30213-036', 4, 1, '/img/articulos/product-036-ROD30213036.svg'),
(37, 'Rodamiento de Bola 6310',         'Rodamiento rígido 6310 de alta capacidad de carga',                                'ROD-6310-037', 6,  1, '/img/articulos/product-037-ROD6310037.svg'),
(38, 'Rodamiento de Motor 6305-2RS',    'Rodamiento 6305-2RS blindado para motores eléctricos de montacargas',              'ROD-6305-038', 12, 1, '/img/articulos/product-038-ROD6305038.svg'),
(39, 'Rodamiento 6305Z RRS700',         'Rodamiento 6305Z específico para modelo RRS700',                                   'ROD-6305Z-039', 8, 1, '/img/articulos/product-039-ROD6305Z039.svg'),
(40, 'Rodamiento de Cilindro RRS700',   'Rodamiento de cilindro para equipo modelo RRS700',                                 'ROD-CIL-040', 5,  1, '/img/articulos/product-040-RODCIL040.svg'),
(41, 'Rodamiento de Bola 0950014-073',  'Rodamiento de bola ref. 0950014-073 para sistema hidráulico',                      'ROD-0950-041', 6,  1, '/img/articulos/product-041-ROD0950041.svg'),
(42, 'Rodamiento de Bola 092061-057',   'Rodamiento de bola ref. 092061-057 para transmisión',                              'ROD-0920-042', 4,  1, '/img/articulos/product-042-ROD0920042.svg'),
(43, 'Rodamiento de Carte R570',        'Rodamiento para cárter modelo R570',                                               'ROD-R570-043', 3,  1, '/img/articulos/product-043-RODR570043.svg'),
(44, 'Rodamiento 6204-2RS Pallet Manual','Rodamiento 6204-2RS para ruedas de pallet manual',                                'ROD-6204PM-044', 10, 1, '/img/articulos/product-044-ROD6204PM044.svg'),
(45, 'Cone Bearing 065045',             'Rodamiento cónico Cone Bearing ref. 065045 para montacargas',                      'ROD-065045-045', 6, 1, '/img/articulos/product-045-ROD065045045.svg'),
(46, 'Thrust Bearing PE450 065045',     'Rodamiento de empuje (thrust bearing) para PE450 ref. 065045',                     'ROD-THR-046', 4,  1, '/img/articulos/product-046-RODTHR046.svg'),
(47, 'Rodamiento 42375',                'Rodamiento cónico serie 42375 Timken para ejes de transmisión',                    'ROD-42375-047', 3, 1, '/img/articulos/product-047-ROD42375047.svg'),
(48, 'Rodamiento 9806917',              'Rodamiento ref. 9806917 para aplicaciones especiales',                             'ROD-9806-048', 2,  1, '/img/articulos/product-048-ROD9806048.svg'),

-- ═══════════════════════════════════════════════════════════════
-- CATEGORÍA 2: SELLOS Y RETENES
-- ═══════════════════════════════════════════════════════════════
(49, 'Sello 30x42x7 NBR',              'Sello de labio 30x42x7mm en material NBR para ejes rotativos',                     'SEL-3042-049', 20, 2, '/img/articulos/product-049-SEL3042049.svg'),
(50, 'Kit de Sello PE 4500',            'Kit completo de sellos de reparación para montacargas PE 4500',                    'SEL-KIT4500-050', 6, 2, '/img/articulos/product-050-SELKIT4500050.svg'),
(51, 'Felt Seal 082641',                'Sello de fieltro ref. 082641 para protección contra polvo',                        'SEL-FELT-051', 15, 2, '/img/articulos/product-051-SELFELT051.svg'),
(52, 'Kit Sello de Dino',               'Kit de sellos hidráulicos marca Dino para cilindros',                              'SEL-DINO-052', 8, 2, '/img/articulos/product-052-SELDINO052.svg'),
(53, 'Retenedor de Transmisión PE4500', 'Retén de transmisión para montacargas eléctrico PE4500',                           'SEL-RET-053', 5,  2, '/img/articulos/product-053-SELRET053.svg'),
(54, 'Casquillo de Pino 092224',        'Casquillo/buje de bronce ref. 092224 para ejes de dirección',                      'SEL-CASQ-054', 10, 2, '/img/articulos/product-054-SELCASQ054.svg'),
(55, 'Tapones Transmisión PE4500',      'Tapones de sello para transmisión de montacargas PE4500',                          'SEL-TAP-055', 12, 2, '/img/articulos/product-055-SELTAP055.svg'),

-- ═══════════════════════════════════════════════════════════════
-- CATEGORÍA 3: TORNILLERÍA Y FIJACIÓN
-- ═══════════════════════════════════════════════════════════════
(56, 'Tuerca Hexagonal M36',            'Tuerca hexagonal métrica M36 grado 8 de acero al carbono',                         'TOR-M36-056', 25, 3, '/img/articulos/product-056-TORM36056.svg'),
(57, 'Corona 8762048-001',              'Corona dentada ref. 8762048-001 para sistema de transmisión',                      'TOR-COR-057', 3,  3, '/img/articulos/product-057-TORCOR057.svg'),

-- ═══════════════════════════════════════════════════════════════
-- CATEGORÍA 4: COMPONENTES ELÉCTRICOS
-- ═══════════════════════════════════════════════════════════════
(58, 'Válvula Solenoide SI 08434004',   'Válvula solenoide de control hidráulico ref. 08434004',                            'ELE-VAL-058', 4,  4, '/img/articulos/product-058-ELEVAL058.svg'),
(59, 'Solenoid Switch 24V',             'Interruptor solenoide de 24V para arranque de montacargas',                        'ELE-SOL-059', 6,  4, '/img/articulos/product-059-ELESOL059.svg'),
(60, 'Potenciómetro 133457',            'Potenciómetro de acelerador ref. 133457 para montacargas eléctrico',               'ELE-POT-060', 3,  4, '/img/articulos/product-060-ELEPOT060.svg'),
(61, 'Tarjeta de Alimentación FC4500',  'Tarjeta electrónica de alimentación para controlador FC4500',                      'ELE-TAR-061', 2,  4, '/img/articulos/product-061-ELETAR061.svg'),
(62, 'Contactor de Línea 10613-001',    'Contactor de potencia de línea ref. 10613-001 para montacargas',                   'ELE-CON-062', 4,  4, '/img/articulos/product-062-ELECON062.svg'),
(63, 'Switch de Freno PE450 13890',     'Interruptor de freno ref. 13890 para montacargas PE450',                           'ELE-SWF-063', 5,  4, '/img/articulos/product-063-ELESWF063.svg'),
(64, 'Conector 4V 18A Litio',           'Conector de batería 4 vías 18A para sistemas de litio',                            'ELE-CNT-064', 8,  4, '/img/articulos/product-064-ELECNT064.svg'),

-- ═══════════════════════════════════════════════════════════════
-- CATEGORÍA 5: REPUESTOS DE MONTACARGAS
-- ═══════════════════════════════════════════════════════════════
(65, 'Escobilla Bomba PE4500',          'Escobilla de carbón para motor de bomba hidráulica PE4500',                        'MON-ESC-065', 10, 5, '/img/articulos/product-065-MONESC065.svg'),
(66, 'Eje Goma de Carga Pallet Manual', 'Eje con rueda de goma para sistema de carga de pallet manual',                     'MON-EJE-066', 7,  5, '/img/articulos/product-066-MONEJE066.svg'),
(67, 'Rodamiento MG-M257',              'Rodamiento de mástil ref. MG-M257 para montacargas de almacén',                    'MON-MGM-067', 4,  5, '/img/articulos/product-067-MONMGM067.svg'),
(68, 'Chumacera UC208-24',              'Chumacera de inserción UC208-24 para ejes de montacargas',                         'MON-UC208-068', 5, 5, '/img/articulos/product-068-MONUC208068.svg'),

-- ═══════════════════════════════════════════════════════════════
-- PRODUCTOS NUEVOS (DE FOTOS)
-- ═══════════════════════════════════════════════════════════════
(69, 'Rodamiento de Bola 065081-070',   'Rodamiento de bola de alta precisión 065081-070, visto en estante azul',            'ROD-065081-070', 5, 1, '/img/articulos/product-069-ROD065081070.svg'),
(70, 'Corona 076048-001',               'Corona industrial 076048-001, vista en estante rojo',                              'COR-076048-001', 3, 3, '/img/articulos/product-070-COR076048001.svg'),
(71, 'Kit Rollo de Giro',               'Kit de repuesto para rollo de giro, visto en estante rojo',                         'KIT-ROLLO-GIRO', 2, 5, '/img/articulos/product-071-KITROLLOGIRO.svg'),
(72, 'Conector de Drive',               'Conector para unidad de drive/motor, visto en estante azul',                        'CON-DRIVE-001', 4, 4, '/img/articulos/product-072-CONDRIVE001.svg');
