/**
 * Utilidad: obtener la IP real del cliente (normalizada)
 * Valida formato y protege contra spoofing.
 */

function getClientIp(req) {
    let ip = '';
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
        ip = String(forwarded.split(',')[0].trim());
    }
    if (!ip) {
        ip = (req.socket && req.socket.remoteAddress) || '';
    }

    if (ip.startsWith('::ffff:')) ip = ip.slice(7);
    if (ip === '::1') ip = '127.0.0.1';

    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^[0-9a-fA-F:]+$/;

    if (!ipv4.test(ip) && !ipv6.test(ip) && ip !== '127.0.0.1') {
        return '0.0.0.0';
    }

    if (ipv4.test(ip)) {
        const octets = ip.split('.');
        const valid = octets.every(o => {
            const n = parseInt(o, 10);
            return !isNaN(n) && n >= 0 && n <= 255;
        });
        if (!valid) return '0.0.0.0';
    }

    return ip;
}

module.exports = { getClientIp };
