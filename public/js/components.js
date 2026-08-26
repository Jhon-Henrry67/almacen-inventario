/**
 * Componentes de Interfaz y Ayudantes de Renderizado (public/js/components.js)
 */

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;' };
    return s.replace(/[&<>"'/]/g, c => map[c]);
}

const DEFAULT_IMG = '/img/default-product.svg';

function getArtImg(img) {
    return img || DEFAULT_IMG;
}

const Components = {
    showToast(message, type = 'success', duration = 3500) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-circle-xmark';
        if (type === 'warning') icon = 'fa-triangle-exclamation';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i>`;
        const span = document.createElement('span');
        span.textContent = String(message);
        toast.appendChild(span);

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return '-';
        }
    },

    renderStockBadge(stock, threshold = 10) {
        if (stock === 0) {
            return `<span class="badge badge-danger"><i class="fa-solid fa-ban"></i> Agotado</span>`;
        } else if (stock <= threshold) {
            return `<span class="badge badge-warning"><i class="fa-solid fa-triangle-exclamation"></i> Stock Bajo</span>`;
        } else {
            return `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> En Stock</span>`;
        }
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    renderAlertList(containerId, items) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="table-state-box" style="padding: 20px;">
                    <i class="fa-solid fa-shield-halved text-primary" style="font-size: 2rem;"></i>
                    <p>Todos los suministros están en niveles óptimos de stock.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="alert-item ${item.cantidad_disponible === 0 ? 'agotado' : ''}">
                <div class="alert-item-info">
                    <span class="alert-item-title">${escapeHtml(item.nombre)}</span>
                    <span class="alert-item-sku">SKU: ${escapeHtml(item.sku)} • Categoría: ${escapeHtml(item.categoria_nombre)}</span>
                </div>
                <div class="alert-item-stock">
                    <span class="badge ${item.cantidad_disponible === 0 ? 'badge-danger' : 'badge-warning'}">
                        ${escapeHtml(item.cantidad_disponible)} unid. (${escapeHtml(item.estado_alerta)})
                    </span>
                </div>
            </div>
        `).join('');
    },

    renderCategoryBars(containerId, categories) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!categories || categories.length === 0) {
            container.innerHTML = `<p class="text-muted">No hay datos de categorías disponibles.</p>`;
            return;
        }

        const maxUnits = Math.max(...categories.map(c => c.total_unidades), 1);

        container.innerHTML = categories.map(cat => {
            const percentage = Math.round((cat.total_unidades / maxUnits) * 100);
            return `
                <div class="dist-bar-item">
                    <div class="dist-bar-header">
                        <span><i class="fa-solid fa-folder text-primary"></i> ${escapeHtml(cat.categoria)}</span>
                        <span><strong>${escapeHtml(cat.total_unidades)}</strong> unid. (${escapeHtml(cat.total_articulos)} tipos)</span>
                    </div>
                    <div class="dist-bar-track">
                        <div class="dist-bar-fill" style="width: ${percentage}%;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
};
