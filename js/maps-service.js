/**
 * Módulo de Mapas - INTEGRACIÓN CON GOOGLE MAPS API
 * ---
 * Responsabilidades:
 * - Inicializar y renderizar mapas
 * - Mostrar sucursales como marcadores
 * - Permitir seleccionar ubicación por click
 * - Búsqueda de direcciones
 * - Mostrar área de cobertura
 */

(() => {
    let maps = {
        deliveryMap: null,
        pickupMap: null
    };

    const mapConfig = {
        zoom: 14,
        defaultCenter: { lat: 19.1456, lng: -97.5859 }
    };

    // ===========================
    // INITIALIZACION DE MAPAS
    // ===========================

    /**
     * Inicializa el mapa de domicilio
     */
    const initDeliveryMap = (containerElementId) => {
        if (!window.google || !window.google.maps) {
            console.error('❌ Google Maps API no cargada. Verifica tu API Key');
            return null;
        }

        const container = document.getElementById(containerElementId);
        if (!container) {
            console.error(`❌ Elemento con ID "${containerElementId}" no encontrado`);
            return null;
        }

        const map = new google.maps.Map(container, {
            zoom: mapConfig.zoom,
            center: mapConfig.defaultCenter,
            mapTypeControl: true,
            fullscreenControl: true,
            streetViewControl: false
        });

        // Marcador seleccionable
        let selectedMarker = null;

        // Click en mapa para seleccionar ubicación
        map.addListener('click', (event) => {
            const lat = event.latLng.lat();
            const lng = event.latLng.lng();

            // Eliminar marcador anterior
            if (selectedMarker) selectedMarker.setMap(null);

            // Crear nuevo marcador
            selectedMarker = new google.maps.Marker({
                position: { lat, lng },
                map: map,
                title: 'Tu ubicación seleccionada',
                animation: google.maps.Animation.DROP
            });

            // Validar cobertura
            if (window.LocationService) {
                const validation = window.LocationService.validateDeliveryLocation(lat, lng);
                
                // Cambiar color del marcador según cobertura
                selectedMarker.setIcon({
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: validation.inCoverage ? '#4CAF50' : '#F44336',
                    fillOpacity: 0.8,
                    strokeColor: 'white',
                    strokeWeight: 2
                });

                // Disparar evento
                document.dispatchEvent(new CustomEvent('location:selected', {
                    detail: { lat, lng, inCoverage: validation.inCoverage }
                }));
            }
        });

        // Mostrar área de cobertura (polígono)
        if (window.LocationService && window.LocationService.getDeliveryCoverage) {
            const polygon = new google.maps.Polygon({
                paths: window.LocationService.getDeliveryCoverage(),
                strokeColor: '#FF9800',
                strokeOpacity: 0.5,
                strokeWeight: 2,
                fillColor: '#FF9800',
                fillOpacity: 0.15,
                map: map
            });
        }

        maps.deliveryMap = map;
        console.log('✅ Mapa de domicilio inicializado');
        return map;
    };

    /**
     * Inicializa el mapa de sucursales
     */
    const initPickupMap = (containerElementId) => {
        if (!window.google || !window.google.maps) {
            console.error('❌ Google Maps API no cargada. Verifica tu API Key');
            return null;
        }

        const container = document.getElementById(containerElementId);
        if (!container) {
            console.error(`❌ Elemento con ID "${containerElementId}" no encontrado`);
            return null;
        }

        const map = new google.maps.Map(container, {
            zoom: mapConfig.zoom,
            center: mapConfig.defaultCenter,
            mapTypeControl: true,
            fullscreenControl: true,
            streetViewControl: false
        });

        // Mostrar todas las sucursales como marcadores
        if (window.LocationService) {
            const branches = window.LocationService.getBranches();
            
            branches.forEach(branch => {
                const marker = new google.maps.Marker({
                    position: { lat: branch.lat, lng: branch.lng },
                    map: map,
                    title: branch.name,
                    animation: google.maps.Animation.DROP
                });

                // Info window con detalles
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="padding: 10px; font-family: Arial;">
                            <strong>${branch.name}</strong><br>
                            ${branch.address}<br>
                            <small>${branch.hours}</small><br>
                            <button id="btn-select-branch-${branch.id}" 
                                    style="margin-top: 10px; padding: 5px 10px; background: #ff6b6b; color: white; border: none; border-radius: 3px; cursor: pointer;">
                                Seleccionar sucursal
                            </button>
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(map, marker);
                });

                marker.addListener('infowindow_closeclick', () => infoWindow.close());
            });
        }

        maps.pickupMap = map;
        console.log('✅ Mapa de sucursales inicializado');
        return map;
    };

    /**
     * Centra mapa en punto específico
     */
    const centerMapOn = (mapType, lat, lng, zoom = mapConfig.zoom) => {
        const map = mapType === 'delivery' ? maps.deliveryMap : maps.pickupMap;
        if (map) {
            map.setCenter({ lat, lng });
            map.setZoom(zoom);
        }
    };

    /**
     * Agrega marcador en mapa
     */
    const addMarker = (mapType, lat, lng, title = 'Ubicación') => {
        const map = mapType === 'delivery' ? maps.deliveryMap : maps.pickupMap;
        if (!map) return null;

        return new google.maps.Marker({
            position: { lat, lng },
            map: map,
            title: title
        });
    };

    // ===========================
    // BÚSQUEDA DE DIRECCIONES (Geocoding)
    // ===========================

    /**
     * Geocodifica dirección a coordenadas
     */
    const geocodeAddress = (address) => {
        return new Promise((resolve, reject) => {
            if (!window.google || !window.google.maps) {
                reject('Google Maps no cargada');
                return;
            }

            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address }, (results, status) => {
                if (status === 'OK') {
                    const result = results[0];
                    resolve({
                        lat: result.geometry.location.lat(),
                        lng: result.geometry.location.lng(),
                        formattedAddress: result.formatted_address,
                        addressComponents: result.address_components
                    });
                } else {
                    reject(`Geocodificación fallida: ${status}`);
                }
            });
        });
    };

    const buildAddressFromComponents = (address) => {
        const parts = [];
        if (address.road) parts.push(address.road);
        if (address.house_number) parts.push(address.house_number);
        if (address.neighbourhood) parts.push(address.neighbourhood);
        if (address.suburb) parts.push(address.suburb);
        if (address.city) parts.push(address.city);
        if (address.town && !address.city) parts.push(address.town);
        if (address.state) parts.push(address.state);
        if (address.country) parts.push(address.country);
        return parts.join(', ');
    };

    let reverseGeocodePromise = null;

    const reverseGeocodeCoordinates = async (lat, lng) => {
        if (reverseGeocodePromise) {
            return reverseGeocodePromise;
        }

        const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&accept-language=es&addressdetails=1`;

        reverseGeocodePromise = fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`Nominatim respondió con status ${response.status}`);
            }

            const data = await response.json();
            if (!data) {
                return {
                    formattedAddress: null,
                    addressComponents: null
                };
            }

            const formattedAddress = data.display_name || buildAddressFromComponents(data.address || {});
            return {
                formattedAddress: formattedAddress || null,
                addressComponents: data.address || null
            };
        })
        .catch((error) => {
            throw new Error(`No se pudo obtener la dirección: ${error.message || error}`);
        })
        .finally(() => {
            reverseGeocodePromise = null;
        });

        return reverseGeocodePromise;
    };

    // ===========================
    // API PÚBLICA
    // ===========================

    window.MapsService = {
        // Inicialización
        initDeliveryMap,
        initPickupMap,
        
        // Manipulación
        centerMapOn,
        addMarker,
        
        // Búsqueda
        geocodeAddress,
        reverseGeocodeCoordinates,
        
        // Estado
        getMaps: () => maps,
        getDeliveryMap: () => maps.deliveryMap,
        getPickupMap: () => maps.pickupMap
    };

    console.log('✅ MapsService cargado correctamente');
})();
