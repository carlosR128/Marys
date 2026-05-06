/**
 * Módulo de Selección de Ubicación - GEOGRAFÍA Y VALIDACIÓN DE COBERTURA
 * ---
 * Responsabilidades:
 * - Geolocalización del navegador
 * - Validación si ubicación está dentro de cobertura
 * - Cálculo de distancias
 * - Stored state de ubicación seleccionada
 */

(() => {
    // ===========================
    // CONFIGURACIÓN - ACTUALIZAR AQUÍ
    // ===========================
    
    // Ubicación central para cobertura en Tepeaca (radio amplio)
    const CENTER_POINT = { lat: 18.9450, lng: -97.9160 };
    
    // Radio de cobertura en km para cubrir todo Tepeaca
    const DELIVERY_RADIUS_KM = 20;
    
    // Polígono de ejemplo conservado para referencia, pero actualmente se usa el radio.
    const DELIVERY_COVERAGE_POLYGON = [
        { lat: 18.900, lng: -97.975 },
        { lat: 18.900, lng: -97.850 },
        { lat: 19.000, lng: -97.850 },
        { lat: 19.000, lng: -97.975 }
    ];
    
    // Ubicaciones de sucursales
    const BRANCHES = [
        {
            id: 1,
            name: 'Sucursal Centro',
            address: 'Dirección completa aquí',
            lat: 18.9662384,
            lng: -97.9076921,
            phone: '222-XXX-XXXX',
            hours: 'Lun-Dom: 10am-10pm'
        },
        {
            id: 2,
            name: 'Sucursal Norte',
            address: 'Dirección completa aquí',
            lat: 18.938938,
            lng: -97.8753187,
            phone: '222-XXX-XXXX',
            hours: 'Lun-Dom: 10am-10pm'
        },
        {
            id: 3,
            name: 'Sucursal Oriente',
            address: 'Dirección completa aquí',
            lat: 18.9588905,
            lng: -97.903497,
            phone: '222-XXX-XXXX',
            hours: 'Lun-Dom: 10am-10pm'
        },
        {
            id: 4,
            name: 'Sucursal Sur',
            address: 'Dirección completa aquí',
            lat: 18.9006356,
            lng: -97.9651939,
            phone: '222-XXX-XXXX',
            hours: 'Lun-Dom: 10am-10pm'
        }
    ];

    // ===========================
    // ESTADO LOCAL
    // ===========================
    
    let selectedLocation = {
        type: null,  // 'delivery' o 'pickup'
        lat: null,
        lng: null,
        address: null,
        branchId: null,
        savedToSession: false
    };

    // ===========================
    // UTILIDADES DE GEOLOCALIZACIÓN
    // ===========================

    /**
     * Calcula distancia entre dos puntos en kilómetros (Fórmula de Haversine)
     */
    const calculateDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371; // Radio tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    /**
     * Verifica si un punto está dentro de un polígono (Algoritmo Ray Casting)
     */
    const isPointInPolygon = (point, polygon) => {
        const { lat, lng } = point;
        let inside = false;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lng;
            const yi = polygon[i].lat;
            const xj = polygon[j].lng;
            const yj = polygon[j].lat;

            const intersect = ((yi > lat) !== (yj > lat)) &&
                (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }

        return inside;
    };

    /**
     * Valida si ubicación está en zona de cobertura
     */
    const isInCoverageArea = (lat, lng) => {
        const distance = calculateDistance(CENTER_POINT.lat, CENTER_POINT.lng, lat, lng);
        return distance <= DELIVERY_RADIUS_KM;
    };

    /**
     * Obtiene ubicación actual del usuario
     */
    const getCurrentLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject('Geolocalización no soportada en tu navegador');
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    reject(`Error de geolocalización: ${error.message}`);
                }
            );
        });
    };

    /**
     * Obtén rama más cercana a un punto
     */
    const getNearestBranch = (lat, lng) => {
        let nearest = null;
        let minDistance = Infinity;

        BRANCHES.forEach(branch => {
            const distance = calculateDistance(lat, lng, branch.lat, branch.lng);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = { ...branch, distance: distance.toFixed(2) };
            }
        });

        return nearest;
    };

    /**
     * Obtén todas las ramas con distancia
     */
    const getAllBranchesWithDistance = (lat, lng) => {
        return BRANCHES.map(branch => ({
            ...branch,
            distance: calculateDistance(lat, lng, branch.lat, branch.lng).toFixed(2)
        })).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    };

    // ===========================
    // API PÚBLICA
    // ===========================

    window.LocationService = {
        // Ubicación
        getCurrentLocation,
        setDeliveryLocation: (lat, lng, address) => {
            selectedLocation = { type: 'delivery', lat, lng, address, branchId: null };
            sessionStorage.setItem('deliveryLocation', JSON.stringify(selectedLocation));
            return selectedLocation;
        },
        setPickupBranch: (branchId) => {
            const branch = BRANCHES.find(b => b.id === branchId);
            if (branch) {
                selectedLocation = { 
                    type: 'pickup', 
                    lat: branch.lat,
                    lng: branch.lng,
                    address: branch.address,
                    branchId: branchId
                };
                sessionStorage.setItem('deliveryLocation', JSON.stringify(selectedLocation));
                return selectedLocation;
            }
            return null;
        },
        getSelectedLocation: () => selectedLocation,
        clearLocation: () => {
            selectedLocation = { type: null, lat: null, lng: null, address: null, branchId: null };
            sessionStorage.removeItem('deliveryLocation');
        },

        // Validación de cobertura
        isInCoverageArea,
        validateDeliveryLocation: (lat, lng) => {
            const inCoverage = isInCoverageArea(lat, lng);
            const message = inCoverage 
                ? 'Ubicación dentro de zona de cobertura ✅' 
                : 'Ubicación fuera de zona de cobertura ❌';
            return { inCoverage, message };
        },

        // Datos de sucursales
        getBranches: () => BRANCHES,
        getBranchById: (id) => BRANCHES.find(b => b.id === id),
        getNearestBranch,
        getAllBranchesWithDistance,

        // Distancias
        calculateDistance
    };

    console.log('✅ LocationService cargado correctamente');
})();
