-- ============================================
-- Script Completo de Creacion de Base de Datos
-- Sistema de Restaurante - Version Completa
-- Incluye: Tablas Originales + Modulo de Contabilidad
-- ============================================

-- IMPORTANTE: Este script crea TODAS las tablas del sistema
-- Ejecutar en una base de datos PostgreSQL vacia

-- ============================================
-- PARTE 1: TABLAS ORIGINALES
-- ============================================

-- Eliminar todas las tablas si existen
DROP TABLE IF EXISTS reportes_contables CASCADE;
DROP TABLE IF EXISTS ingresos CASCADE;
DROP TABLE IF EXISTS egresos CASCADE;
DROP TABLE IF EXISTS cortes_caja CASCADE;
DROP TABLE IF EXISTS ventas CASCADE;
DROP TABLE IF EXISTS promociones_productos CASCADE;
DROP TABLE IF EXISTS promociones CASCADE;
DROP TABLE IF EXISTS detalles_pedido CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS ingredientes CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS empleados CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS sucursales CASCADE;

-- 1. SUCURSALES
CREATE TABLE sucursales (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(20),
    email VARCHAR(100),
    horario JSON,
    activo BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sucursales (nombre, direccion, telefono, email, activo)
VALUES
    ('San Hipolito', 'San Hipolito', '222-000-0001', 'sanhipolito@pizzeriaabcg.local', true),
    ('9 Oriente', '9 Oriente', '222-000-0002', '9oriente@pizzeriaabcg.local', true);

-- 2. ROLES
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    permisos JSON,
    activo BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. EMPLEADOS
CREATE TABLE empleados (
    id SERIAL PRIMARY KEY,
    "idSucursal" INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    "idRol" INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(100),
    "fechaContratacion" DATE DEFAULT CURRENT_DATE,
    activo BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. USUARIOS
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    "idEmpleado" INTEGER NOT NULL UNIQUE REFERENCES empleados(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    activo BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. CLIENTES
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    telefono VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100),
    direccion JSON,
    "fechaNacimiento" DATE,
    activo BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. CATEGORIAS
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    "ordenDisplay" INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. PRODUCTOS
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    "idCategoria" INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    imagen VARCHAR(500),
    "tiempoPreparacion" INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. INGREDIENTES
CREATE TABLE ingredientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    "unidadMedida" VARCHAR(20) CHECK ("unidadMedida" IN ('kg', 'g', 'l', 'ml', 'unidad')),
    "costoUnitario" DECIMAL(10, 2) DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. PEDIDOS
CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    "idSucursal" INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    "idCliente" INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo VARCHAR(20) CHECK (tipo IN ('local', 'domicilio', 'para_llevar')),
    estado VARCHAR(20) CHECK (estado IN ('pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado')),
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    descuento DECIMAL(10, 2) DEFAULT 0,
    impuestos DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "metodoPago" VARCHAR(20) CHECK ("metodoPago" IN ('efectivo', 'tarjeta', 'transferencia')),
    "direccionEntrega" JSON,
    notas TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. DETALLES_PEDIDO
CREATE TABLE detalles_pedido (
    id SERIAL PRIMARY KEY,
    "idPedido" INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    "idProducto" INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL DEFAULT 1,
    "precioUnitario" DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    notas TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. PROMOCIONES
CREATE TABLE promociones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(20) CHECK (tipo IN ('porcentaje', 'monto_fijo', '2x1', 'combo')),
    valor DECIMAL(10, 2),
    "fechaInicio" DATE,
    "fechaFin" DATE,
    "diasSemana" JSON,
    "horaInicio" TIME,
    "horaFin" TIME,
    activo BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. PROMOCIONES_PRODUCTOS
CREATE TABLE promociones_productos (
    id SERIAL PRIMARY KEY,
    "idPromocion" INTEGER NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
    "idProducto" INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("idPromocion", "idProducto")
);

-- ============================================
-- PARTE 2: TABLAS DE CONTABILIDAD
-- ============================================

-- 13. VENTAS
CREATE TABLE ventas (
    id SERIAL PRIMARY KEY,
    "pedidoId" INTEGER NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE RESTRICT,
    "sucursalId" INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(10, 2) NOT NULL,
    descuento DECIMAL(10, 2) DEFAULT 0,
    impuestos DECIMAL(10, 2) DEFAULT 0,
    propina DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    "metodoPago" VARCHAR(20) CHECK ("metodoPago" IN ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'mixto')),
    "desglosePago" JSON,
    "numeroTransaccion" VARCHAR(100),
    turno VARCHAR(20) CHECK (turno IN ('matutino', 'vespertino', 'nocturno')),
    "tipoVenta" VARCHAR(20) CHECK ("tipoVenta" IN ('local', 'domicilio', 'para_llevar')),
    "numeroTicket" VARCHAR(50) NOT NULL UNIQUE,
    cancelada BOOLEAN DEFAULT false,
    "motivoCancelacion" TEXT,
    "fechaCancelacion" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. CORTES_CAJA
CREATE TABLE cortes_caja (
    id SERIAL PRIMARY KEY,
    "sucursalId" INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    "usuarioAperturaId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    "usuarioCierreId" INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
    turno VARCHAR(20) CHECK (turno IN ('matutino', 'vespertino', 'nocturno')),
    "fechaApertura" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP,
    estado VARCHAR(20) CHECK (estado IN ('abierto', 'cerrado')) DEFAULT 'abierto',
    "montoInicialEfectivo" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "ventasEfectivo" DECIMAL(10, 2) DEFAULT 0,
    "ventasTarjetaDebito" DECIMAL(10, 2) DEFAULT 0,
    "ventasTarjetaCredito" DECIMAL(10, 2) DEFAULT 0,
    "ventasTransferencia" DECIMAL(10, 2) DEFAULT 0,
    "totalVentas" DECIMAL(10, 2) DEFAULT 0,
    "totalPropinas" DECIMAL(10, 2) DEFAULT 0,
    "numeroVentas" INTEGER DEFAULT 0,
    "totalEgresos" DECIMAL(10, 2) DEFAULT 0,
    "retirosEfectivo" DECIMAL(10, 2) DEFAULT 0,
    "montoEsperadoEfectivo" DECIMAL(10, 2) DEFAULT 0,
    "montoRealEfectivo" DECIMAL(10, 2),
    diferencia DECIMAL(10, 2) DEFAULT 0,
    "arqueoCaja" JSON,
    observaciones TEXT,
    incidencias TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. EGRESOS
CREATE TABLE egresos (
    id SERIAL PRIMARY KEY,
    "sucursalId" INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    "corteCajaId" INTEGER REFERENCES cortes_caja(id) ON DELETE SET NULL,
    "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    categoria VARCHAR(50) CHECK (categoria IN (
        'compra_insumos', 'servicios', 'nomina', 'mantenimiento', 'renta',
        'servicios_publicos', 'marketing', 'transporte', 'limpieza', 'equipo', 'otros'
    )),
    concepto VARCHAR(200) NOT NULL,
    descripcion TEXT,
    monto DECIMAL(10, 2) NOT NULL,
    "metodoPago" VARCHAR(20) CHECK ("metodoPago" IN ('efectivo', 'tarjeta', 'transferencia', 'cheque')),
    proveedor VARCHAR(200),
    "numeroFactura" VARCHAR(100),
    "numeroReferencia" VARCHAR(100),
    comprobante VARCHAR(500),
    autorizado BOOLEAN DEFAULT false,
    "autorizadoPor" INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    "fechaAutorizacion" TIMESTAMP,
    notas TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. INGRESOS
CREATE TABLE ingresos (
    id SERIAL PRIMARY KEY,
    "sucursalId" INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    "corteCajaId" INTEGER REFERENCES cortes_caja(id) ON DELETE SET NULL,
    "usuarioId" INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    categoria VARCHAR(50) CHECK (categoria IN ('venta', 'propina', 'reembolso', 'ajuste_inventario', 'otros')),
    concepto VARCHAR(200) NOT NULL,
    descripcion TEXT,
    monto DECIMAL(10, 2) NOT NULL,
    "metodoPago" VARCHAR(20) CHECK ("metodoPago" IN ('efectivo', 'tarjeta', 'transferencia')),
    "numeroReferencia" VARCHAR(100),
    notas TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. REPORTES_CONTABLES
CREATE TABLE reportes_contables (
    id SERIAL PRIMARY KEY,
    "sucursalId" INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    "tipoReporte" VARCHAR(20) CHECK ("tipoReporte" IN ('diario', 'semanal', 'mensual', 'anual')),
    periodo VARCHAR(50) NOT NULL,
    "fechaInicio" TIMESTAMP NOT NULL,
    "fechaFin" TIMESTAMP NOT NULL,
    "totalIngresos" DECIMAL(12, 2) DEFAULT 0,
    "ventasBrutas" DECIMAL(12, 2) DEFAULT 0,
    "descuentosOtorgados" DECIMAL(12, 2) DEFAULT 0,
    "ventasNetas" DECIMAL(12, 2) DEFAULT 0,
    propinas DECIMAL(12, 2) DEFAULT 0,
    "totalEgresos" DECIMAL(12, 2) DEFAULT 0,
    "compraInsumos" DECIMAL(12, 2) DEFAULT 0,
    nomina DECIMAL(12, 2) DEFAULT 0,
    servicios DECIMAL(12, 2) DEFAULT 0,
    "otrosEgresos" DECIMAL(12, 2) DEFAULT 0,
    "utilidadBruta" DECIMAL(12, 2) DEFAULT 0,
    "margenUtilidad" DECIMAL(5, 2),
    "numeroVentas" INTEGER DEFAULT 0,
    "ticketPromedio" DECIMAL(10, 2) DEFAULT 0,
    "ventasEfectivo" DECIMAL(12, 2) DEFAULT 0,
    "ventasTarjeta" DECIMAL(12, 2) DEFAULT 0,
    "ventasTransferencia" DECIMAL(12, 2) DEFAULT 0,
    "ventasLocal" DECIMAL(12, 2) DEFAULT 0,
    "ventasDomicilio" DECIMAL(12, 2) DEFAULT 0,
    "ventasParaLlevar" DECIMAL(12, 2) DEFAULT 0,
    "topProductos" JSON,
    "datosAnalisis" JSON,
    "generadoPor" INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    "fechaGeneracion" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("sucursalId", "tipoReporte", periodo)
);

-- ============================================
-- INDICES
-- ============================================

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_empleados_sucursal ON empleados("idSucursal");
CREATE INDEX idx_productos_categoria ON productos("idCategoria");
CREATE INDEX idx_pedidos_sucursal ON pedidos("idSucursal");
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_detalles_pedido ON detalles_pedido("idPedido");
CREATE INDEX idx_ventas_sucursal_fecha ON ventas("sucursalId", fecha);
CREATE INDEX idx_cortes_sucursal_fecha ON cortes_caja("sucursalId", "fechaApertura");
CREATE INDEX idx_egresos_sucursal_fecha ON egresos("sucursalId", fecha);
CREATE INDEX idx_reportes_sucursal_tipo ON reportes_contables("sucursalId", "tipoReporte");

-- ============================================
-- DATOS INICIALES
-- ============================================

INSERT INTO roles (nombre, descripcion, permisos) VALUES
('Administrador', 'Acceso total', '{"all": true}'),
('Gerente', 'Gestion sucursal', '{"sucursal": ["read", "write"]}'),
('Cajero', 'Punto de venta', '{"pedidos": ["read", "write"]}');

INSERT INTO sucursales (nombre, direccion, telefono) VALUES
('Sucursal Centro', 'Av. Principal #123', '555-0001');

INSERT INTO categorias (nombre, "ordenDisplay") VALUES
('Pizzas', 1),
('Bebidas', 2),
('Postres', 3);

-- ============================================
-- RESUMEN
-- ============================================

SELECT 'Base de datos creada exitosamente' AS mensaje;
SELECT COUNT(*) AS total_tablas FROM information_schema.tables WHERE table_schema = 'public';