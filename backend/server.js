/**
 * Servidor backend para el sitio web de Pizzeria ABCG
 *
 * Este archivo implementa un servidor Express.js que maneja:
 * - Recepción de pedidos desde el frontend web
 * - Validación de datos de pedidos
 * - Almacenamiento en base de datos PostgreSQL
 * - Gestión de sucursales y contexto web
 *
 * Tecnologías: Node.js, Express, PostgreSQL, libphonenumber-js
 * Arquitectura: API REST con operaciones CRUD para pedidos
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { Pool } = require('pg');

// Configuración del servidor Express
const app = express();
const port = Number(process.env.PORT || 3000);

// Configuración de conexión a PostgreSQL
const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'pizzeriaabcg',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres'
});

// Constantes de configuración para pedidos web
const WEB_SUCURSAL_NAME = process.env.WEB_SUCURSAL_NAME || 'Sucursal Web';
const WEB_USER_EMAIL = process.env.WEB_USER_EMAIL || 'pedidos-web@pizzeriaabcg.local';
const WEB_USER_NAME = process.env.WEB_USER_NAME || 'Pedidos Web';
const ORDER_SOURCE = 'sitio_web';

// Sucursales requeridas que deben existir en la base de datos
const REQUIRED_BRANCHES = [
    {
        nombre: 'San Hipolito',
        direccion: 'San Hipolito',
        telefono: '222-000-0001',
        email: 'sanhipolito@pizzeriaabcg.local'
    },
    {
        nombre: '9 Oriente',
        direccion: '9 Oriente',
        telefono: '222-000-0002',
        email: '9oriente@pizzeriaabcg.local'
    }
];

// Middleware de Express
app.use(cors()); // Habilita CORS para requests desde el frontend
app.use(express.json({ limit: '1mb' })); // Parsea JSON con límite de 1MB

/**
 * Función utilitaria para limpiar y validar texto
 * @param {any} value - Valor a limpiar
 * @returns {string} Texto limpio y recortado
 */
const cleanText = value => String(value || '').trim();

/**
 * Función para normalizar números de teléfono removiendo caracteres no numéricos
 * @param {any} value - Número de teléfono a normalizar
 * @returns {string} Teléfono normalizado
 */
const normalizePhone = value => cleanText(value).replace(/[^\d+]/g, '');

/**
 * Función para validar y convertir a entero positivo
 * @param {any} value - Valor a convertir
 * @returns {number|null} Entero positivo o null si inválido
 */
const normalizeInteger = value => {
    const numericValue = Number(value);
    return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
};

/**
 * Función para convertir valores a formato monetario válido
 * @param {any} value - Valor a convertir
 * @returns {number} Valor numérico finito, 0 por defecto
 */
const toMoney = value => {
    const numericValue = Number(value || 0);
    return Number.isFinite(numericValue) ? numericValue : 0;
};

const roundMoney = value => Number(toMoney(value).toFixed(2));

/**
 * Función para validar y parsear números de teléfono mexicanos
 * @param {string} value - Número de teléfono a validar
 * @returns {object|null} Objeto con formatos del teléfono o null si inválido
 */
const getValidMexicanPhone = value => {
    const cleanedValue = normalizePhone(value);
    if (!cleanedValue) {
        return null;
    }

    const parsedPhone = cleanedValue.startsWith('+')
        ? parsePhoneNumberFromString(cleanedValue)
        : parsePhoneNumberFromString(cleanedValue, 'MX');

    if (!parsedPhone || !parsedPhone.isValid() || parsedPhone.country !== 'MX') {
        return null;
    }

    return {
        e164: parsedPhone.number,
        national: parsedPhone.nationalNumber,
        international: parsedPhone.formatInternational()
    };
};

/**
 * Función para mapear tipos de pedido válidos
 * @param {string} value - Tipo de pedido recibido
 * @returns {string} Tipo de pedido normalizado
 */
const mapOrderType = value => {
    const normalized = cleanText(value).toLowerCase();
    if (normalized === 'domicilio' || normalized === 'local' || normalized === 'para_llevar') {
        return normalized;
    }
    return 'para_llevar';
};

/**
 * Función para mapear métodos de pago válidos
 * @param {string} value - Método de pago recibido
 * @returns {string} Método de pago normalizado
 */
const mapPaymentMethod = value => {
    const normalized = cleanText(value).toLowerCase();
    if (normalized === 'efectivo' || normalized === 'tarjeta' || normalized === 'transferencia') {
        return normalized;
    }
    return 'efectivo';
};

/**
 * Función para inferir nombre de categoría basado en tipo de producto
 * @param {object} item - Item del pedido con propiedades category y productType
 * @returns {string} Nombre de la categoría
 */
const inferCategoryName = item => {
    const explicitCategory = cleanText(item.category);
    if (explicitCategory) {
        return explicitCategory;
    }

    const productType = cleanText(item.productType).toLowerCase();
    const categoryMap = {
        pizza: 'Pizzas',
        pizzas: 'Pizzas',
        pastas: 'Pastas',
        calzones: 'Calzones',
        alitas: 'Alitas',
        alitas_y_cryspy: 'Alitas',
        bebidas: 'Bebidas',
        hamburguesas: 'Hamburguesas',
        hotdog: 'Hot Dog',
        ensaladas: 'Ensaladas',
        snacks: 'Snacks',
        postres: 'Postres',
        promos: 'Promociones'
    };

    return categoryMap[productType] || 'General';
};

/**
 * Función para construir notas detalladas de un item del pedido
 * @param {object} item - Item con propiedades size, crust, sauce, halfAndHalf, secondHalf
 * @returns {string|null} Notas del item o null si no hay detalles
 */
const buildItemNotes = item => {
    const notes = [];

    if (cleanText(item.size)) {
        notes.push(`Tamano: ${cleanText(item.size)}`);
    }

    if (cleanText(item.crust)) {
        notes.push(`Detalle: ${cleanText(item.crust)}`);
    }

    if (cleanText(item.sauce)) {
        notes.push(`Salsa: ${cleanText(item.sauce)}`);
    }

    if (item.halfAndHalf) {
        notes.push(`Mitad y mitad: ${cleanText(item.secondHalf) || 'Si'}`);
    }

    return notes.join(' | ') || null;
};

/**
 * Función para construir notas completas del pedido
 * @param {object} params - Parámetros del pedido
 * @returns {string} Notas formateadas del pedido
 */
const buildOrderNotes = ({ notes, items, source, paymentMethod, orderType, branchName, customerPhone, customerUserId }) => {
    const lines = [];

    if (cleanText(notes)) {
        lines.push(cleanText(notes));
    }

    lines.push(`Origen: ${source}`);
    lines.push(`Sucursal: ${branchName}`);
    lines.push(`Tipo: ${orderType}`);
    lines.push(`Pago: ${paymentMethod}`);
    lines.push(`ClienteId: ${customerUserId}`);
    lines.push(`Telefono: ${customerPhone}`);
    lines.push(`Articulos: ${items.length}`);

    return lines.join(' | ');
};

/**
 * Función para construir objeto de dirección de entrega
 * @param {object} params - Tipo de pedido y dirección JSON
 * @returns {object} Objeto de dirección formateado
 */
const buildDeliveryAddress = ({ orderType, addressJson }) => {
    if (orderType !== 'domicilio') {
        return { tipo: orderType, capturadoDesde: 'web' };
    }

    return {
        ...(addressJson || {}),
        tipo: orderType,
        capturadoDesde: 'web'
    };
};

/**
 * Función para construir fila de pedido para inserción en BD
 * @param {object} params - Todos los datos necesarios para el pedido
 * @returns {object} Objeto con datos del pedido listos para INSERT
 */
const buildPedidoRow = ({ branch, context, customerId, orderType, paymentMethod, notes, items, addressJson, customerPhone, customerUserId }) => {
    const subtotal = roundMoney(items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0));
    const descuento = 0;
    const impuestos = 0;
    const total = roundMoney(subtotal - descuento + impuestos);

    return {
        idSucursal: branch.id,
        idCliente: customerId,
        usuarioId: context.usuarioId,
        tipo: orderType,
        estado: 'pendiente',
        subtotal,
        descuento,
        impuestos,
        total,
        metodoPago: paymentMethod,
        direccionEntrega: buildDeliveryAddress({ orderType, addressJson }),
        notas: buildOrderNotes({
            notes,
            items,
            source: ORDER_SOURCE,
            paymentMethod,
            orderType,
            branchName: branch.nombre,
            customerPhone,
            customerUserId
        })
    };
};

/**
 * Función para asegurar que las sucursales requeridas existan en la base de datos
 * @param {object} client - Cliente de PostgreSQL
 */
async function ensureRequiredBranches(client) {
    for (const branch of REQUIRED_BRANCHES) {
        const existing = await client.query(
            'SELECT id_sucursal AS id FROM sucursales WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
            [branch.nombre]
        );

        if (existing.rows[0]) {
            await client.query(
                `UPDATE sucursales
                 SET direccion = COALESCE(NULLIF(direccion, ''), $2),
                     telefono = COALESCE(NULLIF(telefono, ''), $3),
                     activa = true
                 WHERE id_sucursal = $1`,
                [existing.rows[0].id, branch.direccion, branch.telefono]
            );
            continue;
        }

        await client.query(
            'INSERT INTO sucursales (nombre, direccion, telefono, ciudad, estado, activa) VALUES ($1, $2, $3, $4, $5, true)',
            [branch.nombre, branch.direccion, branch.telefono, 'Puebla', 'Puebla']
        );
    }
}

/**
 * Función para normalizar direcciones de entrega
 * @param {any} address - Dirección en diversos formatos
 * @returns {object|null} Dirección normalizada o null
 */
const normalizeAddress = address => {
    if (!address) {
        return null;
    }

    if (typeof address === 'string') {
        const text = cleanText(address);
        return text ? { texto: text } : null;
    }

    if (typeof address === 'object') {
        const normalized = {};
        Object.entries(address).forEach(([key, value]) => {
            const cleanValue = cleanText(value);
            if (cleanValue) {
                normalized[key] = cleanValue;
            }
        });

        return Object.keys(normalized).length ? normalized : null;
    }

    return null;
};

/**
 * Función para normalizar items del pedido
 * @param {array} items - Array de items del pedido
 * @returns {array} Items normalizados y validados
 */
const normalizeItems = items => {
    if (!Array.isArray(items)) {
        return [];
    }

    return items
        .map(item => ({
            name: cleanText(item.name) || 'Producto',
            qty: Math.max(1, Number(item.qty || 1)),
            unitPrice: toMoney(item.unitPrice || item.total || item.price),
            size: cleanText(item.size),
            crust: cleanText(item.crust),
            sauce: cleanText(item.sauce),
            halfMode: cleanText(item.halfMode) || 'complete',
            halfAndHalf: Boolean(item.halfAndHalf),
            secondHalf: cleanText(item.secondHalf),
            category: cleanText(item.category),
            productType: cleanText(item.productType)
        }))
        .filter(item => item.name && item.qty > 0);
};

/**
 * Función para asegurar el contexto web (sucursal, rol y usuario para pedidos web)
 * @param {object} client - Cliente de PostgreSQL
 * @returns {object} Objeto con IDs de sucursal y usuario web
 */
async function ensureWebContext(client) {
    await ensureRequiredBranches(client);
    await ensureSchemaCompatibility(client);

    let result = await client.query('SELECT id_sucursal AS id FROM sucursales WHERE nombre = $1 LIMIT 1', [WEB_SUCURSAL_NAME]);
    let sucursalId = result.rows[0] ? result.rows[0].id : null;

    if (!sucursalId) {
        result = await client.query(
            'INSERT INTO sucursales (nombre, direccion, telefono, ciudad, estado, activa) VALUES ($1, $2, $3, $4, $5, true) RETURNING id_sucursal AS id',
            [WEB_SUCURSAL_NAME, 'Pedidos capturados desde sitio web', 'N/A', 'Web', 'Web']
        );
        sucursalId = result.rows[0].id;
    }

    result = await client.query('SELECT id_rol AS id FROM roles WHERE nombre_rol = $1 LIMIT 1', ['Web']);
    let roleId = result.rows[0] ? result.rows[0].id : null;

    if (!roleId) {
        result = await client.query(
            'INSERT INTO roles (nombre_rol, descripcion) VALUES ($1, $2) RETURNING id_rol AS id',
            ['Web', 'Captura automatica de pedidos web']
        );
        roleId = result.rows[0].id;
    }

    result = await client.query('SELECT id_usuario AS id, id_empleado FROM usuarios WHERE username = $1 LIMIT 1', ['pedidos_web']);
    if (result.rows[0]) {
        return {
            sucursalId,
            usuarioId: result.rows[0].id
        };
    }

    const employeeResult = await client.query(
        'INSERT INTO empleados (id_sucursal, id_rol, nombre, telefono, correo, activo) VALUES ($1, $2, $3, $4, $5, true) RETURNING id_empleado AS id',
        [sucursalId, roleId, WEB_USER_NAME, 'N/A', WEB_USER_EMAIL]
    );

    const userResult = await client.query(
        'INSERT INTO usuarios (username, password_hash, id_empleado, activo) VALUES ($1, $2, $3, true) RETURNING id_usuario AS id',
        ['pedidos_web', 'web-placeholder-password', employeeResult.rows[0].id]
    );

    return {
        sucursalId,
        usuarioId: userResult.rows[0].id
    };
}

/**
 * Función para obtener sucursales disponibles para pedidos
 * @param {object} client - Cliente de PostgreSQL
 * @returns {array} Array de sucursales activas
 */
async function getAvailableBranches(client) {
    await ensureRequiredBranches(client);

    const result = await client.query(
        `SELECT id_sucursal AS id, nombre, direccion, telefono
         FROM sucursales
         WHERE activa = true AND nombre <> $1
         ORDER BY nombre ASC`,
        [WEB_SUCURSAL_NAME]
    );

    return result.rows;
}

/**
 * Función para resolver una sucursal por ID
 * @param {object} client - Cliente de PostgreSQL
 * @param {number} branchId - ID de la sucursal
 * @returns {object|null} Datos de la sucursal o null si no existe
 */
async function resolveBranch(client, branchId) {
    await ensureRequiredBranches(client);

    const normalizedBranchId = normalizeInteger(branchId);
    if (!normalizedBranchId) {
        return null;
    }

    const result = await client.query(
        `SELECT id_sucursal AS id, nombre, direccion, telefono
         FROM sucursales
         WHERE id_sucursal = $1 AND activa = true
         LIMIT 1`,
        [normalizedBranchId]
    );

    return result.rows[0] || null;
}

async function upsertCustomer(client, customerName, customerPhone, addressJson) {
    const name = cleanText(customerName);
    const phone = normalizePhone(customerPhone);

    if (!name && !phone && !addressJson) {
        return null;
    }

    let result = await client.query('SELECT id_cliente AS id FROM clientes WHERE telefono = $1 LIMIT 1', [phone]);

    if (result.rows[0]) {
        await client.query(
            'UPDATE clientes SET nombre = $2, telefono = $3, correo = COALESCE($4, correo) WHERE id_cliente = $1',
            [result.rows[0].id, name, phone, WEB_USER_EMAIL]
        );
        return result.rows[0].id;
    }

    result = await client.query(
        'INSERT INTO clientes (nombre, telefono, correo) VALUES ($1, $2, $3) RETURNING id_cliente AS id',
        [name, phone, WEB_USER_EMAIL]
    );

    return result.rows[0].id;
}

async function ensureCategory(client, categoryName) {
    let result = await client.query('SELECT id_categoria AS id FROM categorias WHERE LOWER(nombre_categoria) = LOWER($1) LIMIT 1', [categoryName]);
    if (result.rows[0]) {
        return result.rows[0].id;
    }

    result = await client.query(
        'INSERT INTO categorias (nombre_categoria) VALUES ($1) RETURNING id_categoria AS id',
        [categoryName]
    );
    return result.rows[0].id;
}

async function ensureProduct(client, categoryId, item) {
    let result = await client.query(
        'SELECT id FROM productos WHERE id_categoria = $1 AND LOWER(nombre) = LOWER($2) LIMIT 1',
        [categoryId, item.name]
    );

    if (result.rows[0]) {
        return result.rows[0].id;
    }

    result = await client.query(
        'INSERT INTO productos (id_categoria, nombre, descripcion, precio, activo) VALUES ($1, $2, $3, $4, true) RETURNING id',
        [
            categoryId,
            item.name,
            buildItemNotes(item) || `Producto creado automaticamente desde ${item.productType || 'web'}`,
            item.unitPrice
        ]
    );

    return result.rows[0].id;
}

async function ensureSchemaCompatibility(client) {
    await client.query('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS direccion_entrega JSON');
    await client.query('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS notas TEXT');
}

/**
 * Endpoint GET /api/health - Verifica la conectividad con la base de datos
 * @returns {object} Estado de salud del servicio
 */
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'No se pudo conectar a PostgreSQL.' });
    }
});

/**
 * Endpoint GET /api/branches - Obtiene lista de sucursales disponibles
 * @returns {object} Lista de sucursales activas
 */
app.get('/api/branches', async (req, res) => {
    const client = await pool.connect();

    try {
        const branches = await getAvailableBranches(client);
        res.json({ ok: true, branches });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'No se pudieron cargar las sucursales.' });
    } finally {
        client.release();
    }
});

/**
 * Endpoint POST /api/orders - Crea un nuevo pedido desde el sitio web
 * @param {object} req.body - Datos del pedido
 * @param {array} req.body.items - Items del pedido
 * @param {string} req.body.customerName - Nombre del cliente
 * @param {string} req.body.customerPhone - Teléfono del cliente
 * @param {string} req.body.orderType - Tipo de pedido (pickup/delivery)
 * @param {string} req.body.paymentMethod - Método de pago
 * @param {string} req.body.notes - Notas del pedido
 * @param {number} req.body.branchId - ID de la sucursal
 * @param {object} req.body.deliveryAddress - Dirección de entrega (opcional)
 * @returns {object} Confirmación del pedido creado
 */
app.post('/api/orders', async (req, res) => {
    const items = normalizeItems(req.body.items);
    const customerName = cleanText(req.body.customerName);
    const customerPhone = cleanText(req.body.customerPhone);
    const orderType = mapOrderType(req.body.orderType);
    const paymentMethod = mapPaymentMethod(req.body.paymentMethod);
    const notes = cleanText(req.body.notes);
    const branchId = normalizeInteger(req.body.branchId);
    const addressJson = orderType === 'domicilio'
        ? normalizeAddress(req.body.deliveryAddress)
        : null;
    const validMexicanPhone = getValidMexicanPhone(customerPhone);
    const customerUserId = validMexicanPhone ? validMexicanPhone.national : '';

    if (!items.length) {
        return res.status(400).json({ error: 'El pedido no contiene productos.' });
    }

    if (!customerName) {
        return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
    }

    if (!validMexicanPhone) {
        return res.status(400).json({ error: 'El telefono debe ser valido y corresponder a Mexico.' });
    }

    if (!branchId) {
        return res.status(400).json({ error: 'La sucursal es obligatoria.' });
    }

    if (!notes) {
        return res.status(400).json({ error: 'Las notas o referencias del pedido son obligatorias.' });
    }

    if (orderType === 'domicilio' && !addressJson) {
        return res.status(400).json({ error: 'La direccion de entrega es obligatoria para domicilio.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const context = await ensureWebContext(client);
        const branch = await resolveBranch(client, branchId);

        if (!branch) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'La sucursal seleccionada no existe o no esta activa.' });
        }

        const customerId = await upsertCustomer(client, customerName, validMexicanPhone.national, addressJson);
        const pedidoRow = buildPedidoRow({
            branch,
            context,
            customerId,
            orderType,
            paymentMethod,
            notes,
            items,
            addressJson,
            customerPhone: validMexicanPhone.international,
            customerUserId
        });

        const orderResult = await client.query(
            `INSERT INTO pedidos (
                id_sucursal, id_cliente, usuario_id, tipo, estado,
                subtotal, descuento, impuestos, total, metodo_pago, direccion_entrega, notas,
                "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::json, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id, "createdAt"`,
            [
                pedidoRow.idSucursal,
                pedidoRow.idCliente,
                pedidoRow.usuarioId,
                pedidoRow.tipo,
                pedidoRow.estado,
                pedidoRow.subtotal,
                pedidoRow.descuento,
                pedidoRow.impuestos,
                pedidoRow.total,
                pedidoRow.metodoPago,
                JSON.stringify(pedidoRow.direccionEntrega),
                pedidoRow.notas
            ]
        );

        const orderId = orderResult.rows[0].id;

        for (const item of items) {
            const categoryId = await ensureCategory(client, inferCategoryName(item));
            const productId = await ensureProduct(client, categoryId, item);
            const lineSubtotal = item.unitPrice * item.qty;

            await client.query(
                `INSERT INTO detalle_pedidos (
                    id_pedido, id_producto, cantidad, precio_unitario, subtotal, notas
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [orderId, productId, item.qty, item.unitPrice, lineSubtotal, buildItemNotes(item)]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            ok: true,
            orderId,
            customerUserId,
            createdAt: orderResult.rows[0].createdAt
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al guardar pedido:', error);
        res.status(500).json({
            error: 'No se pudo guardar el pedido en la base de datos.',
            detail: error.message
        });
    } finally {
        client.release();
    }
});

app.use(express.static(path.join(__dirname, '..')));

app.listen(port, () => {
    console.log(`Servidor listo en http://localhost:${port}`);
});