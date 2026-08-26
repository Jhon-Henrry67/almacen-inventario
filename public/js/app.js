/**
 * Controlador Principal de la Aplicación (public/js/app.js)
 * Maneja el estado global, la lógica de la UI y los eventos del usuario.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------
    // Estado Global de la Aplicación
    // --------------------------------------------------
    const state = {
        currentView: 'dashboard',
        page: 1,
        limit: 10,
        search: '',
        categoria_id: '',
        estado: '',
        sortBy: 'id',
        order: 'DESC',
        categories: [],
        deletingArticleId: null,
        editingCategoryId: null,
        refillingArticleId: null,
        refillingCurrent: 0,
        role: null,
        myIp: '',
        pedidoCart: [],
        articleImageData: null,
        articleImageExisting: null,
        pedSearchTimeout: null,
        searchTimeout: null,
        pedidosPollTimer: null,
        historialPage: 1,
        lastPedidoStatuses: {},
        lastPedidoCount: 0
    };

    // --------------------------------------------------
    // Inicialización
    // --------------------------------------------------
    initApp();

    async function initApp() {
        setupNavigation();
        setupEventListeners();
        setupKpiClickHandlers();
        setupAccessGate();
        setupPedidoControls();
        setupMobileMenu();

        // Cargar Categorías iniciales
        await loadCategories();

        // Restaurar sesión si existe, sino mostrar Pantalla de Acceso
        const savedRole = sessionStorage.getItem('ap_role');
        if (savedRole === 'personal') {
            applyRole('personal');
        } else if (savedRole === 'admin' && sessionStorage.getItem('ap_session')) {
            applyRole('admin');
        } else {
            sessionStorage.removeItem('ap_role');
            sessionStorage.removeItem('ap_session');
            showGate();
        }
    }

    // --------------------------------------------------
    // Menú móvil (hamburguesa)
    // --------------------------------------------------
    function setupMobileMenu() {
        const btn = document.getElementById('mobile-menu-btn');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('mobile-overlay');
        if (!btn || !sidebar || !overlay) return;

        btn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('show');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        });

        // Cerrar al navegar
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('show');
            });
        });
    }

    // --------------------------------------------------
    // Pantalla de Acceso y Roles (Personal / Administrador)
    // --------------------------------------------------
    function showGate() {
        document.getElementById('access-gate').style.display = 'flex';
    }

    function hideGate() {
        document.getElementById('access-gate').style.display = 'none';
    }

    async function applyRole(role) {
        state.role = role;
        state.lastPedidoStatuses = {};
        state.lastPedidoCount = 0;
        sessionStorage.setItem('ap_role', role);
        document.body.classList.toggle('role-personal', role === 'personal');
        document.body.classList.toggle('role-admin', role === 'admin');

        const pillName = document.getElementById('user-pill-name');
        if (pillName) {
            pillName.textContent = role === 'admin' ? 'Administrador Almacén' : 'Personal de Almacén';
        }

        // Identificar el equipo del personal por su IP para filtrar sus solicitudes
        if (role === 'personal') {
            try {
                const who = await API.getWhoami();
                state.myIp = who.success ? who.ip : '';
            } catch (error) {
                state.myIp = '';
            }
        } else {
            state.myIp = '';
        }

        hideGate();

        // Visibilidad inicial de botones
        const btnPdfWrapper = document.getElementById('dropdown-pdf');
        const btnAddArticle = document.getElementById('btn-open-add-modal');
        if (role === 'personal') {
            if (btnPdfWrapper) btnPdfWrapper.style.display = 'none';
            if (btnAddArticle) btnAddArticle.style.display = 'none';
        } else {
            if (btnPdfWrapper) btnPdfWrapper.style.display = '';
            if (btnAddArticle) btnAddArticle.style.display = 'none';
        }

        // El Personal siempre aterriza en Pedir Artículo
        if (role === 'personal') {
            if (window.location.hash !== '#pedidos') {
                window.location.hash = 'pedidos';
            } else {
                handleHashChange();
            }
        } else {
            handleHashChange();
        }
    }

    function setupAccessGate() {
        // Entrar como Personal (acceso libre y limitado)
        document.getElementById('btn-enter-personal').addEventListener('click', () => {
            applyRole('personal');
        });

        // Mostrar formulario de clave de administrador
        document.getElementById('btn-show-admin').addEventListener('click', () => {
            document.getElementById('gate-options').style.display = 'none';
            document.getElementById('admin-pin-form').style.display = 'flex';
            setTimeout(() => document.getElementById('gate-pin').focus(), 100);
        });

        // Volver a las opciones
        document.getElementById('btn-gate-back').addEventListener('click', () => {
            document.getElementById('admin-pin-form').style.display = 'none';
            document.getElementById('gate-options').style.display = 'block';
            document.getElementById('gate-error').style.display = 'none';
            document.getElementById('gate-pin').value = '';
        });

        // Validar clave contra el servidor
        document.getElementById('admin-pin-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pin = document.getElementById('gate-pin').value.trim();
            const errEl = document.getElementById('gate-error');

            if (pin.length > 200) {
                errEl.textContent = 'Credenciales inválidas.';
                errEl.style.display = 'block';
                return;
            }

            try {
                const res = await API.adminLogin(pin);
                if (res.success && res.sessionToken) {
                    sessionStorage.setItem('ap_session', res.sessionToken);
                    errEl.style.display = 'none';
                    applyRole('admin');
                } else {
                    errEl.textContent = res.message || 'Clave incorrecta. Intenta de nuevo.';
                    errEl.style.display = 'block';
                }
            } catch (error) {
                errEl.textContent = 'Error al conectar con el servidor.';
                errEl.style.display = 'block';
            }
        });

        // Cerrar Sesión: limpiar rol/clave y volver al gate
        document.getElementById('btn-logout').addEventListener('click', async () => {
            clearInterval(state.pedidosPollTimer);
            state.pedidosPollTimer = null;
            state.lastPedidoStatuses = {};
            state.lastPedidoCount = 0;
            try { await API.adminLogout(); } catch (_) {}
            sessionStorage.removeItem('ap_role');
            sessionStorage.removeItem('ap_session');
            window.location.hash = '';
            window.location.reload();
        });
    }

    // --------------------------------------------------
    // Navegación por Hash (SPA Router)
    // --------------------------------------------------
    function setupNavigation() {
        window.addEventListener('hashchange', handleHashChange);
    }

    function handleHashChange() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        switchView(hash);
    }

    function switchView(viewName) {
        const validViews = ['dashboard', 'inventario', 'categorias', 'pedidos', 'admin-pedidos', 'historial'];
        let targetView = validViews.includes(viewName) ? viewName : 'dashboard';

        // El Administrador no pide artículos: su sección es la gestión
        if (state.role === 'admin' && targetView === 'pedidos') {
            targetView = 'dashboard';
            if (window.location.hash !== '#dashboard') {
                window.location.hash = 'dashboard';
                return; // hashchange disparará switchView de nuevo
            }
        }

        // El Personal solo tiene acceso a la vista de Pedidos
        if (state.role === 'personal' && targetView !== 'pedidos') {
            targetView = 'pedidos';
            if (window.location.hash !== '#pedidos') {
                window.location.hash = 'pedidos';
                return; // hashchange disparará switchView de nuevo
            }
        }

        state.currentView = targetView;

        // Botones según la vista activa
        const btnPdfWrapper = document.getElementById('dropdown-pdf');
        const btnAddArticle = document.getElementById('btn-open-add-modal');
        if (btnPdfWrapper) btnPdfWrapper.style.display = (targetView === 'dashboard') ? '' : 'none';
        if (btnAddArticle) btnAddArticle.style.display = (targetView === 'inventario') ? '' : 'none';

        // Polling en tiempo real: vista del personal refresca solicitudes cada 5s
        // Admin-pedidos también se refresca para ver cambios en tiempo real
        clearInterval(state.pedidosPollTimer);
        state.pedidosPollTimer = null;
        if (targetView === 'pedidos' && state.role === 'personal') {
            state.pedidosPollTimer = setInterval(() => { renderMisSolicitudes(); }, 5000);
        } else if (targetView === 'admin-pedidos' && state.role === 'admin') {
            state.pedidosPollTimer = setInterval(() => { loadPedidos(); }, 5000);
        }

        // Actualizar Items del Nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('href') === `#${targetView}`);
        });

        // Actualizar Secciones de Vista
        document.querySelectorAll('.view-section').forEach(section => {
            section.classList.toggle('active', section.id === `section-${targetView}`);
        });

        // Actualizar Título de la Cabecera
        const titleEl = document.getElementById('page-title');
        const subtitleEl = document.getElementById('page-subtitle');

        if (targetView === 'dashboard') {
            titleEl.textContent = 'Dashboard Principal';
            subtitleEl.textContent = 'Resumen ejecutivo y monitoreo del inventario de suministros';
            loadDashboardData();
        } else if (targetView === 'inventario') {
            titleEl.textContent = 'Gestión de Inventario';
            subtitleEl.textContent = 'Consulta, filtrado, búsqueda y control de insumos del almacén';
            loadInventoryData();
        } else if (targetView === 'categorias') {
            titleEl.textContent = 'Gestión de Categorías';
            subtitleEl.textContent = 'Clasificación y administración de grupos de suministros';
            renderCategoriesTable();
        } else if (targetView === 'pedidos') {
            titleEl.textContent = 'Pedir Artículo';
            subtitleEl.textContent = 'Envía tus solicitudes de suministros al almacén';
            loadPedidosView();
        } else if (targetView === 'admin-pedidos') {
            titleEl.textContent = 'Administración de Pedidos';
            subtitleEl.textContent = 'Gestiona las solicitudes entrantes del personal';
            loadPedidos();
        } else if (targetView === 'historial') {
            titleEl.textContent = 'Historial de Movimientos';
            subtitleEl.textContent = 'Registro de entradas y salidas del inventario';
            loadHistorial();
        }
    }



    // --------------------------------------------------
    // Configuración de Event Listeners Globales
    // --------------------------------------------------
    function setupEventListeners() {
        // Botón Abrir Modal Nuevo Artículo
        document.getElementById('btn-open-add-modal').addEventListener('click', () => {
            resetArticleForm();
            document.getElementById('article-modal-title').innerHTML = '<i class="fa-solid fa-box text-primary"></i> Agregar Nuevo Artículo';
            Components.openModal('article-modal');
        });

        // Botón Exportar PDF (dropdown)
        document.getElementById('btn-export-pdf').addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('dropdown-pdf-menu');
            menu.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            document.getElementById('dropdown-pdf-menu').classList.remove('show');
        });

        // Exportar PDF Stock
        document.getElementById('btn-export-stock-pdf').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('dropdown-pdf-menu').classList.remove('show');
            exportToPDF();
        });

        // Exportar PDF Pedidos
        document.getElementById('btn-export-pedidos-pdf').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('dropdown-pdf-menu').classList.remove('show');
            exportPedidosPDF();
        });



        // Botones de incremento/decremento rápido de stock
        document.querySelectorAll('.btn-step').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const step = parseInt(e.target.dataset.step, 10);
                const input = document.getElementById('art-cantidad');
                const val = parseInt(input.value, 10) || 0;
                input.value = Math.max(0, val + step);
            });
        });

        // Submit Formulario Artículo (Crear / Editar)
        document.getElementById('article-form').addEventListener('submit', handleArticleFormSubmit);

        // Foto del Producto: elegir, previsualizar y quitar
        const imgPicker = document.getElementById('art-img-picker');
        const imgRemoveBtn = document.getElementById('art-img-remove');
        const imgInput = document.getElementById('art-imagen-input');
        if (imgPicker && imgRemoveBtn && imgInput) {
            imgPicker.addEventListener('click', (e) => {
                if (e.target.closest('#art-img-remove')) return;
                imgInput.click();
            });
            imgInput.addEventListener('change', () => {
                const file = imgInput.files && imgInput.files[0];
                if (!file) return;
                compressProductImage(file).then(dataUrl => {
                    if (!dataUrl) {
                        Components.showToast('No se pudo procesar la imagen. Usa JPG, PNG o WebP.', 'error');
                        return;
                    }
                    state.articleImageData = dataUrl;
                    renderArticleImagePreview();
                });
                imgInput.value = '';
            });
            imgRemoveBtn.addEventListener('click', () => {
                state.articleImageData = null;
                state.articleImageExisting = null;
                renderArticleImagePreview();
            });
        }

        // Confirmar Eliminación de Artículo
        document.getElementById('btn-confirm-delete-article').addEventListener('click', handleArticleDeleteConfirm);

        // Búsqueda en tiempo real (Debounced)
        const searchInput = document.getElementById('search-input');
        const clearBtn = document.getElementById('search-clear-btn');

        searchInput.addEventListener('input', (e) => {
            state.search = e.target.value;
            clearBtn.style.display = state.search ? 'block' : 'none';
            clearTimeout(state.searchTimeout);
            state.searchTimeout = setTimeout(() => {
                state.page = 1;
                loadInventoryData();
            }, 300);
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            state.search = '';
            clearBtn.style.display = 'none';
            state.page = 1;
            loadInventoryData();
        });

        // Filtro Categoría y Límite Paginación
        document.getElementById('filter-categoria').addEventListener('change', (e) => {
            state.categoria_id = e.target.value;
            state.page = 1;
            loadInventoryData();
        });

        document.getElementById('filter-limit').addEventListener('change', (e) => {
            state.limit = parseInt(e.target.value, 10);
            state.page = 1;
            loadInventoryData();
        });

        // Reset Filtros
        document.getElementById('btn-reset-filters').addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            document.getElementById('filter-categoria').value = '';
            state.search = '';
            state.categoria_id = '';
            state.page = 1;
            loadInventoryData();
        });

        // Ordenamiento por Columnas en Tabla
        document.querySelectorAll('#inventory-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.dataset.sort;
                if (state.sortBy === column) {
                    state.order = state.order === 'ASC' ? 'DESC' : 'ASC';
                } else {
                    state.sortBy = column;
                    state.order = 'ASC';
                }
                loadInventoryData();
            });
        });

        // Submit Formulario Categoría (Crear / Editar)
        document.getElementById('category-form').addEventListener('submit', handleCategoryFormSubmit);
        document.getElementById('cat-cancel-btn').addEventListener('click', resetCategoryForm);

        // Quitar filtro de alertas de stock desde el chip
        document.getElementById('btn-clear-alert-filter').addEventListener('click', () => {
            state.estado = '';
            updateAlertFilterChip();
            state.page = 1;
            loadInventoryData();
        });

        // Clic en una fila de la tabla para abrir el modal de Rellenar Stock
        document.getElementById('inventory-tbody').addEventListener('click', (e) => {
            if (e.target.closest('.btn-edit-article') || e.target.closest('.btn-delete-article')) return;
            const row = e.target.closest('tr.row-clickable');
            if (!row) return;
            openRefillModal(
                row.dataset.id,
                row.dataset.name,
                row.dataset.sku,
                parseInt(row.dataset.cantidad, 10) || 0
            );
        });

        // Vista previa del stock resultante al escribir la cantidad
        document.getElementById('refill-cantidad').addEventListener('input', updateRefillPreview);

        // Botones rápidos +5 / +10 / +25 / +50
        document.querySelectorAll('.btn-refill-step').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById('refill-cantidad');
                input.value = (parseInt(input.value, 10) || 0) + parseInt(btn.dataset.step, 10);
                updateRefillPreview();
            });
        });

        // Confirmar rellenado de stock
        document.getElementById('refill-form').addEventListener('submit', handleRefillSubmit);

        // Registrar nuevo pedido de artículo
        document.getElementById('pedido-form').addEventListener('submit', handlePedidoFormSubmit);

        // Eventos para Cerrar Modales (clic en el fondo oscuro o botones de cierre)
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('close-modal')) {
                    Components.closeModal(modal.id);
                }
            });
        });

        // Listener directo sobre cada botón de cierre para garantizar que la X siempre funcione
        document.querySelectorAll('.modal-overlay .close-modal, .modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const overlay = btn.closest('.modal-overlay');
                if (overlay) Components.closeModal(overlay.id);
            });
        });

        // Cerrar cualquier modal activo con la tecla Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(m => Components.closeModal(m.id));
            }
        });
    }

    // --------------------------------------------------
    // Carga de Categorías
    // --------------------------------------------------
    async function loadCategories() {
        try {
            const res = await API.getCategories();
            if (res.success) {
                state.categories = res.data;
                populateCategorySelects();
            }
        } catch (error) {
            Components.showToast('Error al cargar categorías', 'error');
        }
    }

    function populateCategorySelects() {
        const filterSelect = document.getElementById('filter-categoria');
        const formSelect = document.getElementById('art-categoria');

        const filterOptions = ['<option value="">Todas las Categorías</option>'];
        const formOptions = ['<option value="">-- Seleccionar Categoría --</option>'];

        state.categories.forEach(cat => {
            filterOptions.push(`<option value="${cat.id}">${escapeHtml(cat.nombre)} (${escapeHtml(cat.total_articulos)})</option>`);
            formOptions.push(`<option value="${cat.id}">${escapeHtml(cat.nombre)}</option>`);
        });

        filterSelect.innerHTML = filterOptions.join('');
        formSelect.innerHTML = formOptions.join('');
    }

    // --------------------------------------------------
    // Carga de Datos del Dashboard
    // --------------------------------------------------
    async function loadDashboardData() {
        try {
            const res = await API.getDashboardStats();
            if (res.success) {
                const stats = res.data;
                document.getElementById('kpi-total-articulos').textContent = stats.totalArticulos.toLocaleString();
                document.getElementById('kpi-total-unidades').textContent = stats.totalUnidadesStock.toLocaleString();
                document.getElementById('kpi-total-categorias').textContent = stats.totalCategorias.toLocaleString();
                document.getElementById('kpi-total-alertas').textContent = stats.alertCountTotal.toLocaleString();
                
                document.getElementById('alert-badge-count').textContent = `${stats.alertCountTotal} Alertas`;
                document.getElementById('kpi-alert-detail').textContent = `${stats.stockBajoCount} bajos stock, ${stats.agotadosCount} agotados`;

                // Renderizar Paneles
                Components.renderAlertList('alert-items-list', stats.alertItems);
                Components.renderCategoryBars('category-distribution-bars', stats.distribucionCategorias);
            }
        } catch (error) {
            Components.showToast('Error al cargar métricas del Dashboard', 'error');
        }
    }

    // --------------------------------------------------
    // Chip de Filtro de Alertas de Stock
    // --------------------------------------------------
    function updateAlertFilterChip() {
        const chip = document.getElementById('alert-filter-chip');
        if (!chip) return;
        chip.style.display = state.estado === 'alerta' ? 'flex' : 'none';
    }

    // --------------------------------------------------
    // Carga de Datos de Inventario (Tabla)
    // --------------------------------------------------
    async function loadInventoryData() {
        const tbody = document.getElementById('inventory-tbody');
        const loader = document.getElementById('table-loader');
        const emptyState = document.getElementById('table-empty');

        tbody.innerHTML = '';
        loader.style.display = 'flex';
        emptyState.style.display = 'none';
        updateAlertFilterChip();

        try {
            const res = await API.getArticles({
                page: state.page,
                limit: state.limit,
                search: state.search,
                categoria_id: state.categoria_id,
                estado: state.estado,
                sortBy: state.sortBy,
                order: state.order
            });

            loader.style.display = 'none';

            if (res.success) {
                if (res.data.length === 0) {
                    emptyState.style.display = 'flex';
                    renderPagination({ totalItems: 0, totalPages: 1, currentPage: 1 });
                    return;
                }

                renderInventoryTable(res.data);
                renderPagination(res.pagination);
            }
        } catch (error) {
            loader.style.display = 'none';
            Components.showToast('Error al cargar lista de inventario', 'error');
        }
    }

    function renderInventoryTable(items) {
        const tbody = document.getElementById('inventory-tbody');
        tbody.innerHTML = items.map(item => {
            const e = {
                id: parseInt(item.id, 10),
                nombre: escapeHtml(item.nombre),
                sku: escapeHtml(item.sku),
                cat: escapeHtml(item.categoria_nombre),
                desc: escapeHtml(item.descripcion || ''),
                cant: item.cantidad_disponible.toLocaleString(),
                img: getArtImg(item.imagen)
            };
            const thumbHtml = `<img src="${e.img}" class="m-card-thumb" alt="">`;
            return `
            <tr class="row-clickable" data-id="${e.id}" data-name="${item.nombre}" data-sku="${item.sku}" data-cantidad="${item.cantidad_disponible}" title="Clic para rellenar stock">
                <td><span class="sku-code">${e.sku}</span></td>
                <td>
                    <div class="inv-cell">
                        <img src="${e.img}" class="inv-thumb" alt="">
                        <div class="inv-cell-info">
                            <div style="font-weight: 600;">${e.nombre}</div>
                            <small class="text-muted">${e.desc ? e.desc.substring(0, 60) + '...' : 'Sin descripción'}</small>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-secondary"><i class="fa-solid fa-folder"></i> ${e.cat}</span></td>
                <td class="text-center"><strong>${e.cant}</strong></td>
                <td class="text-center">${Components.renderStockBadge(item.cantidad_disponible)}</td>
                <td><small class="text-muted">${Components.formatDate(item.ultima_actualizacion)}</small></td>
                <td class="text-right">
                    <button class="btn btn-sm btn-outline btn-edit-article" data-id="${e.id}" title="Editar Artículo">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn btn-sm btn-danger btn-delete-article" data-id="${e.id}" data-name="${item.nombre}" data-sku="${item.sku}" title="Eliminar Artículo">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
                <!-- Tarjeta móvil -->
                <td class="m-card">
                    <div class="m-card-top">
                        ${thumbHtml}
                        <div class="m-card-title">
                            <strong>${e.nombre}</strong>
                            <small><span class="sku-code">${e.sku}</span></small>
                        </div>
                    </div>
                    <div class="m-card-meta">
                        <span><i class="fa-solid fa-folder"></i> ${e.cat}</span>
                        <span><strong>${e.cant}</strong> unid.</span>
                        ${Components.renderStockBadge(item.cantidad_disponible)}
                    </div>
                    <div class="m-card-actions">
                        <button class="btn btn-sm btn-outline btn-edit-article" data-id="${e.id}">
                            <i class="fa-solid fa-pen-to-square"></i> Editar
                        </button>
                        <button class="btn btn-sm btn-danger btn-delete-article" data-id="${e.id}" data-name="${item.nombre}" data-sku="${item.sku}">
                            <i class="fa-solid fa-trash"></i> Eliminar
                        </button>
                        <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); document.querySelector('.row-clickable[data-id=\\'${e.id}\\']').click();" style="flex:0.6;">
                            <i class="fa-solid fa-boxes-stacked"></i> Rellenar
                        </button>
                    </div>
                </td>
            </tr>
        `;}).join('');

        // Eventos para Botones de Acción en cada Fila
        document.querySelectorAll('.btn-edit-article').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openEditArticleModal(id);
            });
        });

        document.querySelectorAll('.btn-delete-article').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const name = e.currentTarget.dataset.name;
                const sku = e.currentTarget.dataset.sku;
                openDeleteArticleModal(id, name, sku);
            });
        });
    }

    // --------------------------------------------------
    // Renderizado de Paginación
    // --------------------------------------------------
    function renderPagination(pagination) {
        const infoEl = document.getElementById('pagination-info');
        const controlsEl = document.getElementById('pagination-controls');

        const { totalItems, totalPages, currentPage, limit } = pagination;
        const start = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
        const end = Math.min(currentPage * limit, totalItems);

        infoEl.textContent = `Mostrando ${start} - ${end} de ${totalItems} artículos`;

        let btns = [];

        // Botón Anterior
        btns.push(`
            <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
        `);

        // Botones de Páginas Numéricas
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                btns.push(`
                    <button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>
                `);
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                btns.push(`<span class="page-btn" style="border:none; background:none;">...</span>`);
            }
        }

        // Botón Siguiente
        btns.push(`
            <button class="page-btn" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} data-page="${currentPage + 1}">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        `);

        controlsEl.innerHTML = btns.join('');

        controlsEl.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPage = parseInt(btn.dataset.page, 10);
                if (targetPage && targetPage !== state.page) {
                    state.page = targetPage;
                    loadInventoryData();
                }
            });
        });
    }

    // --------------------------------------------------
    // Foto del Producto (compresión y previsualización)
    // --------------------------------------------------
    function compressProductImage(file, maxSize = 600, quality = 0.82) {
        return new Promise((resolve) => {
            if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return resolve(null);

            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = () => resolve(null);
                img.src = reader.result;
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
    }

    function renderArticleImagePreview() {
        const preview = document.getElementById('art-img-preview');
        const placeholder = document.getElementById('art-img-placeholder');
        const removeBtn = document.getElementById('art-img-remove');
        if (!preview || !placeholder || !removeBtn) return;

        let src = state.articleImageData || state.articleImageExisting;
        if (src) {
            preview.src = src;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
            removeBtn.style.display = 'inline-flex';
        } else {
            preview.src = '';
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
            removeBtn.style.display = 'none';
        }
    }

    // --------------------------------------------------
    // Acciones CRUD de Artículos
    // --------------------------------------------------
    async function handleArticleFormSubmit(e) {
        e.preventDefault();

        const id = document.getElementById('art-id').value;

        const data = {
            nombre: document.getElementById('art-nombre').value.trim(),
            sku: document.getElementById('art-sku').value.trim(),
            categoria_id: parseInt(document.getElementById('art-categoria').value, 10),
            cantidad_disponible: parseInt(document.getElementById('art-cantidad').value, 10),
            descripcion: document.getElementById('art-descripcion').value.trim()
        };

        // Foto del producto: nueva imagen, eliminación (''), o no tocarla
        if (state.articleImageData) {
            data.imagen = state.articleImageData;
        } else if (!state.articleImageExisting) {
            data.imagen = '';
        }

        const submitBtn = document.getElementById('btn-save-article');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            let res;
            if (id) {
                res = await API.updateArticle(id, data);
            } else {
                res = await API.createArticle(data);
            }

            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Guardar Artículo';

            if (res.success) {
                Components.showToast(res.message, 'success');
                Components.closeModal('article-modal');
                resetArticleForm();
                await loadCategories();
                loadInventoryData();
                if (state.currentView === 'dashboard') loadDashboardData();
            } else {
                const msg = res.errors ? res.errors.join(', ') : res.message;
                Components.showToast(msg, 'error');
            }
        } catch (error) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Guardar Artículo';
            Components.showToast('Error al conectar con el servidor', 'error');
        }
    }

    async function openEditArticleModal(id) {
        try {
            const res = await API.getArticleById(id);
            if (res.success) {
                const art = res.data;
                document.getElementById('art-id').value = art.id;
                document.getElementById('art-nombre').value = art.nombre;
                document.getElementById('art-sku').value = art.sku || '';
                document.getElementById('art-categoria').value = art.categoria_id;
                document.getElementById('art-cantidad').value = art.cantidad_disponible;
                document.getElementById('art-descripcion').value = art.descripcion || '';

                // Foto existente del artículo (ruta en el servidor)
                state.articleImageData = null;
                state.articleImageExisting = art.imagen || null;
                renderArticleImagePreview();

                document.getElementById('article-modal-title').innerHTML = '<i class="fa-solid fa-pen-to-square text-primary"></i> Editar Artículo';
                Components.openModal('article-modal');
            }
        } catch (error) {
            Components.showToast('Error al obtener los datos del artículo', 'error');
        }
    }

    function openDeleteArticleModal(id, name, sku) {
        state.deletingArticleId = id;
        document.getElementById('delete-article-name').textContent = name;
        document.getElementById('delete-article-sku').textContent = sku;
        Components.openModal('delete-article-modal');
    }

    async function handleArticleDeleteConfirm() {
        if (!state.deletingArticleId) return;

        try {
            const res = await API.deleteArticle(state.deletingArticleId);
            Components.closeModal('delete-article-modal');

            if (res.success) {
                Components.showToast(res.message, 'success');
                state.deletingArticleId = null;
                await loadCategories();
                loadInventoryData();
                if (state.currentView === 'dashboard') loadDashboardData();
            } else {
                Components.showToast(res.message, 'error');
            }
        } catch (error) {
            Components.showToast('Error al eliminar el artículo', 'error');
        }
    }

    function resetArticleForm() {
        document.getElementById('art-id').value = '';
        document.getElementById('article-form').reset();
        document.getElementById('art-cantidad').value = 0;

        // Limpiar foto del producto
        state.articleImageData = null;
        state.articleImageExisting = null;
        renderArticleImagePreview();
    }

    // --------------------------------------------------
    // Rellenar Stock de un Artículo (clic en la fila)
    // --------------------------------------------------
    function openRefillModal(id, name, sku, cantidad) {
        state.refillingArticleId = id;
        state.refillingCurrent = cantidad;

        document.getElementById('refill-name').textContent = name;
        document.getElementById('refill-sku').textContent = sku;
        document.getElementById('refill-current').textContent = cantidad.toLocaleString();

        const input = document.getElementById('refill-cantidad');
        input.value = 10;
        updateRefillPreview();

        Components.openModal('refill-modal');
        setTimeout(() => { input.focus(); input.select(); }, 150);
    }

    function updateRefillPreview() {
        const agregar = parseInt(document.getElementById('refill-cantidad').value, 10) || 0;
        const resultante = Math.max(0, state.refillingCurrent + agregar);
        document.getElementById('refill-preview').textContent = resultante.toLocaleString();
    }

    async function handleRefillSubmit(e) {
        e.preventDefault();
        const id = state.refillingArticleId;
        if (!id) return;

        const agregar = parseInt(document.getElementById('refill-cantidad').value, 10);
        if (!agregar || agregar <= 0) {
            Components.showToast('Ingresa una cantidad mayor a 0.', 'warning');
            return;
        }

        const btn = document.getElementById('btn-confirm-refill');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Agregando...';

        try {
            const resArt = await API.getArticleById(id);
            if (!resArt.success) {
                Components.showToast(resArt.message || 'No se encontró el artículo.', 'error');
                return;
            }

            const art = resArt.data;
            const nuevoStock = art.cantidad_disponible + agregar;

            const res = await API.updateArticle(id, {
                sku: art.sku,
                nombre: art.nombre,
                categoria_id: art.categoria_id,
                descripcion: art.descripcion || '',
                cantidad_disponible: nuevoStock
            });

            if (res.success) {
                Components.showToast(`Se agregaron ${agregar} unidades a '${art.nombre}'. Stock actual: ${nuevoStock}.`, 'success');
                Components.closeModal('refill-modal');
                await loadCategories();
                loadInventoryData();
                if (state.currentView === 'dashboard') loadDashboardData();
                try {
                    const dashRes = await API.getDashboardStats();
                    if (dashRes.success && dashRes.data.alertCountTotal > 0) {
                        Components.showToast(`Atención: ${dashRes.data.alertCountTotal} artículo(s) requieren reabastecimiento`, 'warning', 5000);
                    }
                } catch (_) {}
            } else {
                Components.showToast(res.message || 'Error al actualizar el stock.', 'error');
            }
        } catch (error) {
            Components.showToast('Error al conectar con el servidor', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-boxes-stacked"></i> Agregar Cantidad';
        }
    }

    // --------------------------------------------------
    // Hacer que las tarjetas KPI del Dashboard sean clickeables
    // --------------------------------------------------
    function setupKpiClickHandlers() {
        document.querySelectorAll('.kpi-clickable').forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
                const targetView = card.dataset.nav;
                if (!targetView) return;

                if (targetView === 'inventario') {
                    // Limpiar filtros previos y aplicar el filtro del KPI (si lo tiene)
                    state.search = '';
                    state.categoria_id = '';
                    document.getElementById('search-input').value = '';
                    document.getElementById('search-clear-btn').style.display = 'none';
                    document.getElementById('filter-categoria').value = '';
                    state.estado = card.dataset.filter || '';
                    updateAlertFilterChip();
                    state.page = 1;
                }

                if (state.currentView === targetView) {
                    if (targetView === 'inventario') loadInventoryData();
                } else {
                    window.location.hash = targetView;
                }
            });
        });
    }

    // --------------------------------------------------
    // Exportar PDF con jsPDF
    // --------------------------------------------------
    async function exportToPDF() {
        try {
            Components.showToast('Generando reporte PDF...', 'success');
            
            const res = await API.getArticles({ page: 1, limit: 1000, sortBy: 'nombre', order: 'ASC' });
            if (!res.success || !res.data.length) {
                Components.showToast('No hay artículos para exportar.', 'warning');
                return;
            }

            const { jsPDF } = window.jspdf || {};
            if (!jsPDF) {
                Components.showToast('No se pudo cargar la librería PDF. Verifica tu conexión a internet y recarga la página.', 'error');
                return;
            }
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            // Título del documento
            doc.setFontSize(18);
            doc.setTextColor(44, 62, 80);
            doc.text('Reporte de Inventario - Monitoreo de Cantidades', 14, 20);

            // Subtítulo con fecha
            doc.setFontSize(10);
            doc.setTextColor(127, 140, 141);
            const now = new Date();
            const fechaStr = now.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            doc.text(`Generado el: ${fechaStr}`, 14, 28);

            // Totales
            const totalArticulos = res.data.length;
            const totalUnidades = res.data.reduce((sum, a) => sum + a.cantidad_disponible, 0);
            doc.setFontSize(11);
            doc.setTextColor(44, 62, 80);
            doc.text(`Total de artículos: ${totalArticulos}  |  Total unidades en stock: ${totalUnidades}`, 14, 36);

            // Preparar datos de la tabla
            const tableBody = res.data.map((item, index) => [
                index + 1,
                item.sku,
                item.nombre,
                item.categoria_nombre,
                item.cantidad_disponible,
                item.cantidad_disponible === 0 ? 'Agotado' : (item.cantidad_disponible <= 10 ? 'Stock Bajo' : 'OK'),
                item.descripcion ? item.descripcion.substring(0, 50) + (item.descripcion.length > 50 ? '...' : '') : '-'
            ]);

            // Generar tabla con autotable
            doc.autoTable({
                startY: 42,
                head: [['#', 'SKU', 'Artículo', 'Categoría', 'Cantidad', 'Estado', 'Descripción']],
                body: tableBody,
                styles: {
                    fontSize: 8,
                    cellPadding: 3,
                    overflow: 'linebreak',
                    font: 'helvetica'
                },
                headStyles: {
                    fillColor: [59, 130, 246],
                    textColor: 255,
                    fontStyle: 'bold',
                    fontSize: 9
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252]
                },
                columnStyles: {
                    0: { cellWidth: 12 },
                    1: { cellWidth: 28 },
                    2: { cellWidth: 55 },
                    3: { cellWidth: 40 },
                    4: { cellWidth: 22, halign: 'center' },
                    5: { cellWidth: 25, halign: 'center' },
                    6: { cellWidth: 80 }
                },
                didParseCell: function(data) {
                    // Colorear estado
                    if (data.section === 'body' && data.column.index === 5) {
                        const val = data.cell.raw;
                        if (val === 'Agotado') {
                            data.cell.styles.textColor = [239, 68, 68];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (val === 'Stock Bajo') {
                            data.cell.styles.textColor = [245, 158, 11];
                            data.cell.styles.fontStyle = 'bold';
                        } else {
                            data.cell.styles.textColor = [16, 185, 129];
                        }
                    }
                    // Colorear cantidad si es 0
                    if (data.section === 'body' && data.column.index === 4) {
                        if (data.cell.raw === 0) {
                            data.cell.styles.textColor = [239, 68, 68];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                },
                margin: { top: 42, right: 14, bottom: 20, left: 14 },
                didDrawPage: function(data) {
                    // Footer en cada página
                    const pageCount = doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text(
                        `Sistema de Gestión de Almacén - Página ${data.pageNumber} de ${pageCount}`,
                        doc.internal.pageSize.getWidth() / 2,
                        doc.internal.pageSize.getHeight() - 8,
                        { align: 'center' }
                    );
                }
            });

            // Guardar PDF
            doc.save(`reporte_inventario_${now.toISOString().slice(0, 10)}.pdf`);
            Components.showToast('Reporte PDF descargado exitosamente.', 'success');

        } catch (error) {
            console.error('Error al generar PDF:', error);
            Components.showToast('Error al generar el reporte PDF.', 'error');
        }
    }

    // --------------------------------------------------
    // Exportar PDF de Pedidos / Solicitudes
    // --------------------------------------------------
    async function exportPedidosPDF() {
        try {
            Components.showToast('Generando reporte de pedidos...', 'success');

            const res = await API.getPedidos();
            if (!res.success || !res.data.length) {
                Components.showToast('No hay pedidos para exportar.', 'warning');
                return;
            }

            const { jsPDF } = window.jspdf || {};
            if (!jsPDF) {
                Components.showToast('No se pudo cargar la librería PDF. Verifica tu conexión a internet y recarga la página.', 'error');
                return;
            }
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            doc.setFontSize(18);
            doc.setTextColor(44, 62, 80);
            doc.text('Reporte de Pedidos - Solicitudes de Artículos', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(127, 140, 141);
            const now = new Date();
            const fechaStr = now.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            doc.text(`Generado el: ${fechaStr}`, 14, 28);

            const totalPedidos = res.data.length;
            const pendientes = res.data.filter(p => p.estado === 'Pendiente').length;
            const enProceso = res.data.filter(p => p.estado === 'En Proceso').length;
            const entregados = res.data.filter(p => p.estado === 'Entregado').length;
            const cancelados = res.data.filter(p => p.estado === 'Cancelado').length;
            doc.setFontSize(11);
            doc.setTextColor(44, 62, 80);
            doc.text(`Total: ${totalPedidos} | Pendientes: ${pendientes} | En proceso: ${enProceso} | Entregados: ${entregados} | Cancelados: ${cancelados}`, 14, 36);

            const tableBody = [];
            let rowNum = 0;
            for (const p of res.data) {
                for (const it of p.items) {
                    rowNum++;
                    tableBody.push([
                        rowNum,
                        it.sku,
                        it.articulo_nombre,
                        p.solicitante || '—',
                        it.cantidad,
                        p.estado,
                        p.fecha_pedido
                    ]);
                }
            }

            doc.autoTable({
                startY: 42,
                head: [['#', 'SKU', 'Artículo', 'Solicitante', 'Cant.', 'Estado', 'Fecha']],
                body: tableBody,
                styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', font: 'helvetica' },
                headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 9 },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 12 },
                    1: { cellWidth: 28 },
                    2: { cellWidth: 55 },
                    3: { cellWidth: 40 },
                    4: { cellWidth: 18, halign: 'center' },
                    5: { cellWidth: 25, halign: 'center' },
                    6: { cellWidth: 55 }
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === 5) {
                        const val = data.cell.raw;
                        if (val === 'Entregado') {
                            data.cell.styles.textColor = [16, 185, 129];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (val === 'Cancelado') {
                            data.cell.styles.textColor = [239, 68, 68];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (val === 'En Proceso') {
                            data.cell.styles.textColor = [59, 130, 246];
                            data.cell.styles.fontStyle = 'bold';
                        } else {
                            data.cell.styles.textColor = [245, 158, 11];
                        }
                    }
                },
                margin: { top: 42, right: 14, bottom: 20, left: 14 },
                didDrawPage: function(data) {
                    const pageCount = doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text(
                        `Sistema de Gestión de Almacén - Página ${data.pageNumber} de ${pageCount}`,
                        doc.internal.pageSize.getWidth() / 2,
                        doc.internal.pageSize.getHeight() - 8,
                        { align: 'center' }
                    );
                }
            });

            doc.save(`reporte_pedidos_${now.toISOString().slice(0, 10)}.pdf`);
            Components.showToast('Reporte de pedidos descargado exitosamente.', 'success');

        } catch (error) {
            console.error('Error al generar PDF de pedidos:', error);
            Components.showToast('Error al generar el reporte de pedidos.', 'error');
        }
    }

    // --------------------------------------------------
    // Acciones CRUD de Categorías
    // --------------------------------------------------
    function renderCategoriesTable() {
        const tbody = document.getElementById('categories-tbody');
        if (!tbody) return;

        tbody.innerHTML = state.categories.map(cat => {
            const e = {
                id: parseInt(cat.id, 10),
                nombre: escapeHtml(cat.nombre),
                desc: escapeHtml(cat.descripcion || ''),
                totalArt: escapeHtml(cat.total_articulos),
                totalUnid: escapeHtml(cat.total_unidades)
            };
            return `
            <tr>
                <td><strong><i class="fa-solid fa-folder text-primary"></i> ${e.nombre}</strong></td>
                <td><small class="text-muted">${e.desc || 'Sin descripción'}</small></td>
                <td class="text-center"><span class="badge badge-secondary">${e.totalArt} artículos</span></td>
                <td class="text-center"><strong>${e.totalUnid} unid.</strong></td>
                <td class="text-right">
                    <button class="btn btn-sm btn-outline btn-edit-cat" data-id="${e.id}" data-name="${cat.nombre}" data-desc="${cat.descripcion || ''}" title="Editar Categoría">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-sm btn-danger btn-delete-cat" data-id="${e.id}" title="Eliminar Categoría">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
                <!-- Tarjeta móvil -->
                <td class="m-card">
                    <div class="m-card-top">
                        <div class="m-card-thumb-empty"><i class="fa-solid fa-folder"></i></div>
                        <div class="m-card-title">
                            <strong>${e.nombre}</strong>
                            <small>${e.desc || 'Sin descripción'}</small>
                        </div>
                    </div>
                    <div class="m-card-meta">
                        <span>${e.totalArt} artículos</span>
                        <span><strong>${e.totalUnid}</strong> unidades</span>
                    </div>
                    <div class="m-card-actions">
                        <button class="btn btn-sm btn-outline btn-edit-cat" data-id="${e.id}" data-name="${cat.nombre}" data-desc="${cat.descripcion || ''}">
                            <i class="fa-solid fa-pen"></i> Editar
                        </button>
                        <button class="btn btn-sm btn-danger btn-delete-cat" data-id="${e.id}">
                            <i class="fa-solid fa-trash"></i> Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `;}).join('');

        document.querySelectorAll('.btn-edit-cat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const name = e.currentTarget.dataset.name;
                const desc = e.currentTarget.dataset.desc;
                
                state.editingCategoryId = id;
                document.getElementById('cat-id').value = id;
                document.getElementById('cat-nombre').value = name;
                document.getElementById('cat-descripcion').value = desc;
                document.getElementById('cat-form-title').innerHTML = '<i class="fa-solid fa-pen text-primary"></i> Editar Categoría';
                document.getElementById('cat-submit-btn').innerHTML = '<i class="fa-solid fa-check"></i> Actualizar Categoría';
                document.getElementById('cat-cancel-btn').style.display = 'inline-block';
            });
        });

        document.querySelectorAll('.btn-delete-cat').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm('¿Está seguro de eliminar esta categoría?')) {
                    try {
                        const res = await API.deleteCategory(id);
                        if (res.success) {
                            Components.showToast(res.message, 'success');
                            await loadCategories();
                            renderCategoriesTable();
                        } else {
                            Components.showToast(res.message, 'error');
                        }
                    } catch (err) {
                        Components.showToast('Error al eliminar categoría', 'error');
                    }
                }
            });
        });
    }

    async function handleCategoryFormSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('cat-id').value;
        const name = document.getElementById('cat-nombre').value.trim();
        const desc = document.getElementById('cat-descripcion').value.trim();

        try {
            let res;
            if (id) {
                res = await API.updateCategory(id, { nombre: name, descripcion: desc });
            } else {
                res = await API.createCategory({ nombre: name, descripcion: desc });
            }

            if (res.success) {
                Components.showToast(res.message, 'success');
                resetCategoryForm();
                await loadCategories();
                renderCategoriesTable();
            } else {
                Components.showToast(res.message, 'error');
            }
        } catch (error) {
            Components.showToast('Error al guardar categoría', 'error');
        }
    }

    function resetCategoryForm() {
        state.editingCategoryId = null;
        document.getElementById('cat-id').value = '';
        document.getElementById('category-form').reset();
        document.getElementById('cat-form-title').innerHTML = '<i class="fa-solid fa-folder-plus text-primary"></i> Nueva Categoría';
        document.getElementById('cat-submit-btn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Categoría';
        document.getElementById('cat-cancel-btn').style.display = 'none';
    }

    // --------------------------------------------------
    // Pedidos de Artículos (Personal + Administración)
    // --------------------------------------------------
    async function loadPedidosView() {
        await fetchPedidoResultados('');
        await renderMisSolicitudes();
    }

    function setupPedidoControls() {
        const buscador = document.getElementById('ped-buscador');
        if (!buscador) return;

        // Buscador con debounce
        buscador.addEventListener('input', () => {
            clearTimeout(state.pedSearchTimeout);
            state.pedSearchTimeout = setTimeout(() => {
                fetchPedidoResultados(buscador.value.trim());
            }, 300);
        });

        // Vaciar lista completa
        document.getElementById('ped-cart-clear').addEventListener('click', () => {
            state.pedidoCart = [];
            renderPedidoCart();
            fetchPedidoResultados(buscador.value.trim());
        });

        // Delegación de eventos dentro de la lista (+/-/quitar)
        document.getElementById('ped-cart-items').addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn || !btn.dataset.id) return;
            const id = parseInt(btn.dataset.id, 10);

            if (btn.classList.contains('ped-ci-mas')) changeCartQty(id, 1);
            else if (btn.classList.contains('ped-ci-menos')) changeCartQty(id, -1);
            else if (btn.classList.contains('ped-ci-del')) removeFromCart(id);
        });
    }

    async function fetchPedidoResultados(query) {
        const cont = document.getElementById('ped-resultados');
        if (!cont) return;

        try {
            const res = await API.getArticles({ search: query || undefined, page: 1, limit: 6, sortBy: 'nombre', order: 'ASC' });
            if (!res.success) throw new Error(res.message);

            if (res.data.length === 0) {
                cont.innerHTML = `<div class="ped-vacio">Sin resultados para "<b>${escapeHtml(query)}</b>"</div>`;
                return;
            }

            cont.innerHTML = res.data.map(a => {
                const enLista = state.pedidoCart.some(x => x.id === a.id);
                const artImg = getArtImg(a.imagen);
                return `
                <button type="button" class="ped-item ${enLista ? 'selected' : ''}" data-id="${a.id}">
                    <span class="ped-item-icon"><img src="${artImg}" alt=""></span>
                    <span class="ped-item-info">
                        <strong>${escapeHtml(a.nombre)}</strong>
                        <small><span class="sku-code">${escapeHtml(a.sku)}</span></small>
                        <small class="ped-item-stock">Stock: ${a.cantidad_disponible}</small>
                    </span>
                </button>
            `;}).join('');

            cont.querySelectorAll('.ped-item').forEach(item => {
                item.addEventListener('click', () => {
                    const art = res.data.find(x => x.id === parseInt(item.dataset.id, 10));
                    if (art) addToPedidoCart(art);
                });
            });
        } catch (error) {
            cont.innerHTML = '';
        }
    }

    function addToPedidoCart(art) {
        if (state.pedidoCart.some(x => x.id === art.id)) {
            Components.showToast(`'${art.nombre}' ya está en tu lista.`, 'warning');
            return;
        }
        state.pedidoCart.push({
            id: art.id,
            nombre: art.nombre,
            sku: art.sku,
            stock: art.cantidad_disponible,
            cantidad: 1
        });
        renderPedidoCart();
        fetchPedidoResultados(document.getElementById('ped-buscador').value.trim());
    }

    function changeCartQty(id, delta) {
        const item = state.pedidoCart.find(x => x.id === id);
        if (!item) return;
        item.cantidad = Math.max(1, item.cantidad + delta);
        renderPedidoCart();
    }

    function removeFromCart(id) {
        state.pedidoCart = state.pedidoCart.filter(x => x.id !== id);
        renderPedidoCart();
        fetchPedidoResultados(document.getElementById('ped-buscador').value.trim());
    }

    // Dibuja la lista de artículos elegidos
    function renderPedidoCart() {
        const wrap = document.getElementById('ped-cart');
        const itemsEl = document.getElementById('ped-cart-items');
        const countEl = document.getElementById('ped-cart-count');
        if (!wrap) return;

        countEl.textContent = state.pedidoCart.length;
        wrap.style.display = state.pedidoCart.length > 0 ? 'block' : 'none';

        itemsEl.innerHTML = state.pedidoCart.map(it => `
            <div class="ped-cart-item">
                <div class="ped-ci-info">
                    <strong>${escapeHtml(it.nombre)}</strong>
                    <small><span class="sku-code">${escapeHtml(it.sku)}</span> · Stock: ${escapeHtml(it.stock)}</small>
                </div>
                <div class="ped-ci-qty">
                    <button type="button" class="ped-ci-menos" data-id="${it.id}"><i class="fa-solid fa-minus"></i></button>
                    <b>${escapeHtml(it.cantidad)}</b>
                    <button type="button" class="ped-ci-mas" data-id="${it.id}"><i class="fa-solid fa-plus"></i></button>
                </div>
                <button type="button" class="ped-ci-del" data-id="${it.id}" title="Quitar"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');
    }

    // Tarjetas de estado de solicitudes (vista del personal, filtradas por IP del equipo)
    async function renderMisSolicitudes() {
        const grid = document.getElementById('mis-solicitudes-grid');
        const empty = document.getElementById('mis-solicitudes-empty');
        if (!grid) return;

        try {
            const res = await API.getPedidos({ ip: state.myIp });
            if (!res.success) throw new Error(res.message);

            if (res.data.length === 0) {
                grid.innerHTML = `
                    <div class="ped-vacio" style="padding: 30px 10px;">
                        <i class="fa-solid fa-inbox fa-2x" style="display:block; margin-bottom:10px;"></i>
                        Aún no has enviado solicitudes desde este equipo.<br>
                        Envía una con el formulario.
                    </div>`;
                empty.style.display = 'none';
                return;
            }
            empty.style.display = 'none';

            const meta = {
                'Pendiente': { cls: 'b-espera', icon: 'fa-hourglass-half', label: 'En espera' },
                'En Proceso': { cls: 'b-proceso', icon: 'fa-clock', label: 'En proceso' },
                'Entregado': { cls: 'b-ok', icon: 'fa-circle-check', label: 'Aceptada' },
                'Cancelado': { cls: 'b-no', icon: 'fa-circle-xmark', label: 'Cancelada' }
            };

            const recientes = [...res.data]
                .sort((a, b) => new Date(b.fecha_pedido.replace(' ', 'T')) - new Date(a.fecha_pedido.replace(' ', 'T')))
                .slice(0, 9);

            const isFirstLoad = Object.keys(state.lastPedidoStatuses).length === 0;

            for (const p of recientes) {
                const prevEstado = state.lastPedidoStatuses[p.id];
                if (!isFirstLoad && prevEstado && prevEstado !== p.estado) {
                    if (p.estado === 'En Proceso') {
                        Components.showToast(`Tu pedido #${p.id} está en proceso`, 'info');
                    } else if (p.estado === 'Entregado') {
                        Components.showToast(`¡Tu pedido #${p.id} fue entregado!`, 'success');
                    } else if (p.estado === 'Cancelado') {
                        Components.showToast(`Tu pedido #${p.id} fue cancelado`, 'warning');
                    }
                }
                state.lastPedidoStatuses[p.id] = p.estado;
            }

            grid.innerHTML = recientes.map(p => {
                const m = meta[p.estado] || meta['Pendiente'];
                const itemsHtml = p.items.map(it => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-color);">
                        <img src="${getArtImg(it.imagen)}" style="width:32px;height:32px;border-radius:6px;object-fit:cover;border:1px solid var(--border-color);flex-shrink:0;" alt="">
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:0.88rem;font-weight:600;">${escapeHtml(it.articulo_nombre)}</div>
                            <small><span class="sku-code">${escapeHtml(it.sku)}</span></small>
                        </div>
                        <span style="font-size:0.82rem;font-weight:700;color:var(--text-secondary);">x${it.cantidad}</span>
                    </div>
                `).join('');

                const cancelBtn = p.estado === 'Pendiente' ? `
                    <button class="btn btn-sm btn-outline btn-cancel-mi-pedido" data-id="${p.id}" title="Cancelar pedido">
                        <i class="fa-solid fa-ban"></i> Cancelar
                    </button>` : '';

                return `
                    <div class="sol-card">
                        <div class="sol-top" style="display:flex;align-items:center;gap:10px;">
                            <span class="sol-badge ${m.cls}"><i class="fa-solid ${m.icon}"></i> ${m.label}</span>
                            <small style="margin-left:auto;color:var(--text-muted);">${Components.formatDate(p.fecha_pedido)}</small>
                        </div>
                        <div style="margin-top:6px;">${itemsHtml}</div>
                        <div class="sol-meta" style="margin-top:6px;">
                            <span><i class="fa-solid fa-user"></i> ${escapeHtml(p.solicitante) || '—'}</span>
                            <span><i class="fa-solid fa-layer-group"></i> ${p.items.length} artículo(s)</span>
                        </div>
                        ${cancelBtn ? `<div style="margin-top:8px;">${cancelBtn}</div>` : ''}
                    </div>
                `;
            }).join('');

            grid.querySelectorAll('.btn-cancel-mi-pedido').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    if (!confirm('¿Cancelar este pedido?')) return;
                    try {
                        const res = await API.cancelPedidoPersonal(id);
                        Components.showToast(res.message, res.success ? 'success' : 'error');
                        if (res.success) renderMisSolicitudes();
                    } catch (err) {
                        Components.showToast('Error al cancelar el pedido', 'error');
                    }
                });
            });
        } catch (error) {
            Components.showToast('Error al cargar tus solicitudes', 'error');
        }
    }

    // Tabla de administración con acciones sobre cada pedido
    async function loadPedidos() {
        const tbody = document.getElementById('admin-pedidos-tbody');
        const empty = document.getElementById('admin-pedidos-empty');

        try {
            const res = await API.getPedidos();
            if (!res.success) throw new Error(res.message);

            if (res.data.length === 0) {
                tbody.innerHTML = '';
                empty.style.display = 'flex';
                state.lastPedidoCount = 0;
                return;
            }

            empty.style.display = 'none';
            tbody.innerHTML = res.data.map(p => {
                const badgeClass = p.estado === 'Pendiente' ? 'badge-warning'
                    : p.estado === 'En Proceso' ? 'badge-info'
                    : p.estado === 'Entregado' ? 'badge-success' : 'badge-danger';
                const badgeHtml = `<span class="badge ${badgeClass}"><i class="fa-solid fa-circle-info"></i> ${escapeHtml(p.estado)}</span>`;

                const itemsListHtml = p.items.map(it => {
                    const itImg = getArtImg(it.imagen);
                    return `
                        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
                            <img src="${itImg}" style="width:28px;height:28px;border-radius:5px;object-fit:cover;border:1px solid var(--border-color);flex-shrink:0;" alt="">
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:0.85rem;font-weight:600;">${escapeHtml(it.articulo_nombre)}</div>
                                <small><span class="sku-code">${escapeHtml(it.sku)}</span></small>
                            </div>
                            <span style="font-size:0.82rem;font-weight:700;color:var(--text-secondary);">x${it.cantidad}</span>
                        </div>`;
                }).join('');

                const firstImg = p.items.length > 0 ? getArtImg(p.items[0].imagen) : '';
                const photo = firstImg ? `<img src="${firstImg}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;border:1px solid var(--border-color);margin-right:10px;vertical-align:middle;" alt="">` : '';

                let actionsHtml = '';
                let mActionsHtml = '';

                if (p.estado === 'Pendiente') {
                    actionsHtml = `
                        <button class="btn btn-sm btn-warning btn-process-pedido" data-id="${p.id}" title="Marcar en proceso">
                            <i class="fa-solid fa-clock"></i>
                        </button>
                        <button class="btn btn-sm btn-outline btn-cancel-pedido" data-id="${p.id}" title="Cancelar pedido">
                            <i class="fa-solid fa-ban"></i>
                        </button>`;
                    mActionsHtml = `
                        <button class="btn btn-sm btn-warning btn-process-pedido" data-id="${p.id}">
                            <i class="fa-solid fa-clock"></i> En Proceso
                        </button>
                        <button class="btn btn-sm btn-outline btn-cancel-pedido" data-id="${p.id}">
                            <i class="fa-solid fa-ban"></i> Cancelar
                        </button>`;
                } else if (p.estado === 'En Proceso') {
                    actionsHtml = `
                        <button class="btn btn-sm btn-success btn-deliver-pedido" data-id="${p.id}" title="Entregar pedido">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-outline btn-cancel-pedido" data-id="${p.id}" title="Cancelar pedido">
                            <i class="fa-solid fa-ban"></i>
                        </button>`;
                    mActionsHtml = `
                        <button class="btn btn-sm btn-success btn-deliver-pedido" data-id="${p.id}">
                            <i class="fa-solid fa-check"></i> Entregar
                        </button>
                        <button class="btn btn-sm btn-outline btn-cancel-pedido" data-id="${p.id}">
                            <i class="fa-solid fa-ban"></i> Cancelar
                        </button>`;
                }

                return `
                    <tr>
                        <td>
                            <div style="font-weight: 600; display:flex; align-items:center;">
                                ${photo}
                                <div>
                                    <div>${escapeHtml(p.solicitante) || '<span class="text-muted">—</span>'}</div>
                                    <small style="color:var(--text-muted);">${p.items.length} artículo(s)</small>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div style="max-width:320px;">${itemsListHtml}</div>
                        </td>
                        <td class="text-center">${badgeHtml}</td>
                        <td><small class="text-muted">${Components.formatDate(p.fecha_pedido)}</small></td>
                        <td class="text-right">
                            ${actionsHtml}
                            <button class="btn btn-sm btn-danger btn-delete-pedido" data-id="${p.id}" title="Eliminar pedido">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                        <!-- Tarjeta móvil -->
                        <td class="m-card">
                            <div class="m-card-top">
                                ${firstImg ? `<img src="${firstImg}" class="m-card-thumb" alt="">` : ''}
                                <div class="m-card-title">
                                    <strong>${escapeHtml(p.solicitante) || '—'}</strong>
                                    <small>${p.items.length} artículo(s)</small>
                                </div>
                                ${badgeHtml}
                            </div>
                            <div style="padding:6px 0;">
                                ${itemsListHtml}
                            </div>
                            <div class="sol-meta">
                                <span><i class="fa-regular fa-clock"></i> ${Components.formatDate(p.fecha_pedido)}</span>
                            </div>
                            <div class="m-card-actions">
                                ${mActionsHtml}
                                <button class="btn btn-sm btn-danger btn-delete-pedido" data-id="${p.id}">
                                    <i class="fa-solid fa-trash"></i> Eliminar
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            bindPedidoRowEvents();

            const pendienteCount = res.data.filter(p => p.estado === 'Pendiente').length;
            if (pendienteCount > state.lastPedidoCount && state.lastPedidoCount > 0) {
                const nuevoPedido = res.data.find(p => p.estado === 'Pendiente');
                const solicitante = nuevoPedido ? (escapeHtml(nuevoPedido.solicitante) || 'Desconocido') : '';
                Components.showToast(`Nuevo pedido recibido de ${solicitante}`, 'info', 5000);
            }
            state.lastPedidoCount = pendienteCount;
        } catch (error) {
            Components.showToast('Error al cargar los pedidos', 'error');
        }
    }

    function bindPedidoRowEvents() {
        document.querySelectorAll('.btn-process-pedido').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm('¿Marcar este pedido como "En Proceso"?' )) return;
                try {
                    const res = await API.updatePedidoEstado(id, 'En Proceso');
                    Components.showToast(res.message, res.success ? 'success' : 'error');
                    if (res.success) loadPedidos();
                } catch (err) {
                    Components.showToast('Error al actualizar el pedido', 'error');
                }
            });
        });

        document.querySelectorAll('.btn-deliver-pedido').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm(`¿Confirmas la entrega de este pedido? Se descontarán todos los artículos del inventario.`)) return;
                try {
                    const res = await API.updatePedidoEstado(id, 'Entregado');
                    Components.showToast(res.message, res.success ? 'success' : 'error');
                    if (res.success) {
                        await loadCategories();
                        await loadPedidos();
                        if (state.currentView === 'inventario') loadInventoryData();
                        if (state.currentView === 'dashboard') loadDashboardData();
                        try {
                            const dashRes = await API.getDashboardStats();
                            if (dashRes.success && dashRes.data.alertCountTotal > 0) {
                                Components.showToast(`Atención: ${dashRes.data.alertCountTotal} artículo(s) requieren reabastecimiento`, 'warning', 5000);
                            }
                        } catch (_) {}
                    }
                } catch (err) {
                    Components.showToast('Error al entregar el pedido', 'error');
                }
            });
        });

        document.querySelectorAll('.btn-cancel-pedido').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('¿Cancelar este pedido?')) return;
                try {
                    const res = await API.updatePedidoEstado(btn.dataset.id, 'Cancelado');
                    Components.showToast(res.message, res.success ? 'success' : 'error');
                    if (res.success) loadPedidos();
                } catch (err) {
                    Components.showToast('Error al cancelar el pedido', 'error');
                }
            });
        });

        document.querySelectorAll('.btn-delete-pedido').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('¿Eliminar este pedido del registro? Esta acción no se puede deshacer.')) return;
                try {
                    const res = await API.deletePedido(btn.dataset.id);
                    Components.showToast(res.message, res.success ? 'success' : 'error');
                    if (res.success) loadPedidos();
                } catch (err) {
                    Components.showToast('Error al eliminar el pedido', 'error');
                }
            });
        });
    }

    async function handlePedidoFormSubmit(e) {
        e.preventDefault();

        const solicitante = document.getElementById('ped-solicitante').value.trim();

        if (!solicitante) {
            Components.showToast('Escribe tu nombre o área en el paso 2.', 'warning');
            return;
        }

        if (state.pedidoCart.length === 0) {
            Components.showToast('Agrega al menos un artículo a tu lista.', 'warning');
            return;
        }

        try {
            const items = state.pedidoCart.map(item => ({
                articulo_id: item.id,
                cantidad: item.cantidad
            }));
            const res = await API.createPedido({ items, solicitante });
            Components.showToast(res.message, res.success ? 'success' : 'error');
            if (res.success) {
                document.getElementById('pedido-form').reset();
                state.pedidoCart = [];
                renderPedidoCart();
                fetchPedidoResultados('');
                await renderMisSolicitudes();
            }
        } catch (error) {
            Components.showToast('Error al registrar el pedido', 'error');
        }
    }

    // --------------------------------------------------
    // Historial de Movimientos
    // --------------------------------------------------
    async function loadHistorial(page = 1) {
        state.historialPage = page;
        const tbody = document.getElementById('historial-tbody');
        const empty = document.getElementById('historial-empty');
        if (!tbody) return;

        try {
            const res = await API.getMovimientos({ page, limit: 20 });
            if (!res.success || res.data.length === 0) {
                tbody.innerHTML = '';
                empty.style.display = 'flex';
                renderHistorialPagination({ totalItems: 0, totalPages: 1, currentPage: 1, limit: 20 });
                return;
            }

            empty.style.display = 'none';
            tbody.innerHTML = res.data.map(m => {
                const tipoClass = m.tipo === 'Entrada' ? 'badge-success' : 'badge-danger';
                const tipoIcon = m.tipo === 'Entrada' ? 'fa-arrow-down' : 'fa-arrow-up';
                return `
                    <tr>
                        <td><small class="text-muted">${Components.formatDate(m.fecha_movimiento)}</small></td>
                        <td>
                            <div style="font-weight:600;">${escapeHtml(m.articulo_nombre)}</div>
                            <small><span class="sku-code">${escapeHtml(m.articulo_sku)}</span></small>
                        </td>
                        <td class="text-center">
                            <span class="badge ${tipoClass}"><i class="fa-solid ${tipoIcon}"></i> ${escapeHtml(m.tipo)}</span>
                        </td>
                        <td class="text-center"><strong>${m.cantidad}</strong></td>
                        <td><small>${escapeHtml(m.motivo)}</small></td>
                        <td><small>${escapeHtml(m.usuario)}</small></td>
                    </tr>
                `;
            }).join('');

            renderHistorialPagination(res.pagination);
        } catch (error) {
            Components.showToast('Error al cargar historial de movimientos', 'error');
        }
    }

    function renderHistorialPagination(pagination) {
        const infoEl = document.getElementById('historial-pagination-info');
        const controlsEl = document.getElementById('historial-pagination-controls');
        if (!infoEl || !controlsEl) return;

        const { totalItems, totalPages, currentPage, limit } = pagination;
        const start = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
        const end = Math.min(currentPage * limit, totalItems);

        infoEl.textContent = `Mostrando ${start} - ${end} de ${totalItems} movimientos`;

        let btns = [];
        btns.push(`<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}"><i class="fa-solid fa-chevron-left"></i></button>`);

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                btns.push(`<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`);
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                btns.push(`<span class="page-btn" style="border:none;background:none;">...</span>`);
            }
        }

        btns.push(`<button class="page-btn" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} data-page="${currentPage + 1}"><i class="fa-solid fa-chevron-right"></i></button>`);

        controlsEl.innerHTML = btns.join('');

        controlsEl.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPage = parseInt(btn.dataset.page, 10);
                if (targetPage) loadHistorial(targetPage);
            });
        });
    }
});
