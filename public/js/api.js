/**
 * Módulo del Cliente API (public/js/api.js)
 * Encapsula la comunicación HTTP con el Servidor REST Backend
 */

const API_BASE = '/api';

const getSessionHeaders = () => {
    const headers = {};
    const token = sessionStorage.getItem('ap_session');
    if (token) headers['x-session-token'] = token;
    return headers;
};

const API = {
    async getDashboardStats() {
        const response = await fetch(`${API_BASE}/dashboard/stats`);
        return await response.json();
    },

    async getArticles(params = {}) {
        const query = new URLSearchParams();
        if (params.search) query.append('search', params.search);
        if (params.categoria_id) query.append('categoria_id', params.categoria_id);
        if (params.estado) query.append('estado', params.estado);
        if (params.page) query.append('page', params.page);
        if (params.limit) query.append('limit', params.limit);
        if (params.sortBy) query.append('sortBy', params.sortBy);
        if (params.order) query.append('order', params.order);

        const response = await fetch(`${API_BASE}/articulos?${query.toString()}`);
        return await response.json();
    },

    async getArticleById(id) {
        const response = await fetch(`${API_BASE}/articulos/${parseInt(id, 10)}`);
        return await response.json();
    },

    async createArticle(data) {
        const response = await fetch(`${API_BASE}/articulos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getSessionHeaders() },
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    async updateArticle(id, data) {
        const response = await fetch(`${API_BASE}/articulos/${parseInt(id, 10)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getSessionHeaders() },
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    async deleteArticle(id) {
        const response = await fetch(`${API_BASE}/articulos/${parseInt(id, 10)}`, {
            method: 'DELETE',
            headers: getSessionHeaders()
        });
        return await response.json();
    },

    async getCategories() {
        const response = await fetch(`${API_BASE}/categorias`);
        return await response.json();
    },

    async createCategory(data) {
        const response = await fetch(`${API_BASE}/categorias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getSessionHeaders() },
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    async updateCategory(id, data) {
        const response = await fetch(`${API_BASE}/categorias/${parseInt(id, 10)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getSessionHeaders() },
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    async deleteCategory(id) {
        const response = await fetch(`${API_BASE}/categorias/${parseInt(id, 10)}`, {
            method: 'DELETE',
            headers: getSessionHeaders()
        });
        return await response.json();
    },

    async getPedidos(params = {}) {
        const query = new URLSearchParams();
        if (params.ip) query.append('ip', params.ip);
        const response = await fetch(`${API_BASE}/pedidos?${query.toString()}`);
        return await response.json();
    },

    async createPedido(data) {
        const response = await fetch(`${API_BASE}/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getSessionHeaders() },
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    async updatePedidoEstado(id, estado) {
        const response = await fetch(`${API_BASE}/pedidos/${parseInt(id, 10)}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getSessionHeaders() },
            body: JSON.stringify({ estado })
        });
        return await response.json();
    },

    async deletePedido(id) {
        const response = await fetch(`${API_BASE}/pedidos/${parseInt(id, 10)}`, {
            method: 'DELETE',
            headers: getSessionHeaders()
        });
        return await response.json();
    },

    async adminLogin(clave) {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clave })
        });
        return await response.json();
    },

    async adminLogout() {
        const token = sessionStorage.getItem('ap_session');
        const response = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-session-token': token || '' }
        });
        return await response.json();
    },

    async getWhoami() {
        const response = await fetch(`${API_BASE}/auth/whoami`);
        return await response.json();
    }
};
