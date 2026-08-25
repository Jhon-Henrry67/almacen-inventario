/**
 * Utilidad: obtener la IP real del cliente (normalizada)
 */

function getClientIp(req) {
    let ip = String((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '')
        || (req.socket && req.socket.remoteAddress) || '';

    if (ip.startsWith('::ffff:')) ip = ip.slice(7);
    if (ip === '::1') ip = '127.0.0.1';

    return ip;
}

module.exports = { getClientIp };
