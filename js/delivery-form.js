/**
 * Módulo de Gestión de Pedidos - ARQUITECTURA DE DOS FASES
 * ---
 * FASE 1: Selección de ubicación (SIN carrito requerido)
 *   - Domicilio: seleccionar ubicación en mapa
 *   - Sucursal: seleccionar sucursal de 3 disponibles
 * 
 * FASE 2: Completar pedido (Desde carrito)
 *   - Nombre, teléfono, observaciones
 *   - Usar ubicación seleccionada en FASE 1
 */

(() => {
    const API_BASE = window.ABCG_API_BASE || 'http://localhost:3000';

    const DELIVERY_DIALOG_TEMPLATE = `
        <dialog id="dialog-delivery" class="location-dialog">
            <div class="dialog-header">
                <h2>📍 Selecciona tu ubicación</h2>
                <button class="dialog-close" data-close="dialog-delivery" aria-label="Cerrar">&times;</button>
            </div>
            <div class="dialog-content">
                <div id="current-tab" class="tab-content active">
                    <button id="btn-use-current-location" class="btn btn-primary">Usar mi ubicación</button>
                    <div id="current-location-form" class="current-location-form" style="display: none; margin-top: 16px;">
                        <p id="current-location-status" class="location-status"></p>
                        <input type="text" id="detected-address" class="address-input" readonly placeholder="Dirección detectada" />
                        <div id="current-location-link" class="location-link"></div>
                    </div>
                </div>
                <div id="location-confirmation" class="location-confirmation" style="display: none;">
                    <div class="confirm-header">
                        <h3>📍 Ubicación del cliente</h3>
                    </div>
                    <div class="confirm-body">
                        <!-- Bloque de dirección -->
                        <div class="location-block">
                            <p class="location-label">Dirección</p>
                            <p class="location-value" id="confirm-address"></p>
                        </div>

                        <!-- Bloque de coordenadas -->
                        <div class="location-block">
                            <p class="location-label">Coordenadas</p>
                            <p class="location-value location-secondary" id="confirm-coords"></p>
                        </div>

                        <!-- Bloque de cobertura -->
                        <div class="location-block">
                            <p class="location-label">Estado de cobertura</p>
                            <span id="confirm-coverage" class="coverage-badge"></span>
                        </div>

                        <!-- Nota de cobertura si está fuera -->
                        <p id="coverage-note" class="coverage-note" style="display: none; margin-top: 12px; padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; color: #856404;"></p>

                        <!-- Referencia para el repartidor -->
                        <div class="location-block">
                            <label for="delivery-reference" class="location-label">Referencia para el repartidor</label>
                            <textarea 
                                id="delivery-reference" 
                                class="delivery-reference-input"
                                placeholder="Ejemplo: Casa blanca con portón negro, junto a una tienda"
                                rows="3"
                            ></textarea>
                        </div>

                        <!-- Link a Google Maps -->
                        <div id="confirm-location-link" class="location-link" style="margin-top: 12px;"></div>
                    </div>
                    <div class="confirm-footer">
                        <button id="btn-confirm-location" class="btn btn-primary">Confirmar ubicación</button>
                    </div>
                </div>
            </div>
        </dialog>
        <dialog id="dialog-pickup" class="location-dialog">
            <div class="dialog-header">
                <h2>🏪 Selecciona tu sucursal</h2>
                <button class="dialog-close" data-close="dialog-pickup" aria-label="Cerrar">&times;</button>
            </div>
            <div class="dialog-content">
                <div id="pickup-map" class="map-container"></div>
                <div id="branches-list" class="branches-list"></div>
            </div>
        </dialog>
        <div id="delivery-toast" class="delivery-toast"></div>
    `;

    const injectDeliveryUIIfNeeded = () => {
        // Botones ahora están estáticos en todas las páginas
        // Solo inyectamos los diálogos si no existen
        if (!document.getElementById('dialog-delivery') || !document.getElementById('dialog-pickup')) {
            document.body.insertAdjacentHTML('beforeend', DELIVERY_DIALOG_TEMPLATE);
        }
    };

    injectDeliveryUIIfNeeded();

    let refs = null;
    const getRefs = () => ({
        btnDomicilio: document.getElementById('btn-domicilio'),
        btnSucursal: document.getElementById('btn-sucursal'),
        dialogDelivery: document.getElementById('dialog-delivery'),
        dialogPickup: document.getElementById('dialog-pickup'),
        toast: document.getElementById('delivery-toast'),
        deliveryMap: document.getElementById('delivery-map'),
        pickupMap: document.getElementById('pickup-map'),
        branchesList: document.getElementById('branches-list'),
        searchAddress: document.getElementById('search-address'),
        searchResults: document.getElementById('search-results'),
        btnUseCurrentLocation: document.getElementById('btn-use-current-location'),
        currentLocationStatus: document.getElementById('current-location-status'),
        currentLocationLink: document.getElementById('current-location-link'),
        currentLocationForm: document.getElementById('current-location-form'),
        detectedAddress: document.getElementById('detected-address'),
        locationConfirmation: document.getElementById('location-confirmation'),
        confirmAddress: document.getElementById('confirm-address'),
        confirmCoords: document.getElementById('confirm-coords'),
        confirmCoverage: document.getElementById('confirm-coverage'),
        confirmLocationLink: document.getElementById('confirm-location-link'),
        coverageNote: document.getElementById('coverage-note'),
        deliveryReference: document.getElementById('delivery-reference'),
        btnConfirmLocation: document.getElementById('btn-confirm-location')
    });

    refs = getRefs();


    // ===========================
    // ESTADO LOCAL
    // ===========================

    let currentPhase = null; // 'delivery' o 'pickup'
    let selectedLocation = null;
    let currentLocationCoordinates = { lat: null, lng: null, mapsUrl: null };
    let currentLocationQueryInProgress = false;

    // ===========================
    // UTILIDADES
    // ===========================

    /**
     * Muestra un toast con mensaje
     */
    const showToast = (message, type = 'success') => {
        if (!refs.toast) return;
        
        refs.toast.textContent = message;
        refs.toast.className = `delivery-toast ${type === 'success' ? '' : type}`;
        refs.toast.classList.add('show');
        
        if (type !== 'loading') {
            setTimeout(() => {
                refs.toast.classList.remove('show');
            }, 3000);
        }
    };

    /**
     * Abre un dialog
     */
    const openDialog = (dialogElement) => {
        if (!dialogElement) return;
        if (dialogElement.showModal) {
            dialogElement.showModal();
        } else {
            dialogElement.style.display = 'block';
        }
    };

    /**
     * Cierra un dialog
     */
    const closeDialog = (dialogElement) => {
        if (!dialogElement) return;
        if (dialogElement.close) {
            dialogElement.close();
        } else {
            dialogElement.style.display = 'none';
        }
    };

    /**
     * Cambia entre pestañas
     */
    const switchTab = (tabName) => {
        // Ocultar todas las pestañas
        document.querySelectorAll('.tab-content').forEach(tab => {
            if (tab) tab.classList.remove('active');
        });

        // Desactivar todos los botones
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn) btn.classList.remove('active');
        });

        // Mostrar la pestaña seleccionada
        const selectedTab = document.getElementById(tabName);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }

        // Activar el botón correspondiente
        if (event && event.target) {
            event.target.classList.add('active');
        }
    };

    // ===========================
    // FASE 1: SELECCIÓN DE UBICACIÓN (DOMICILIO)
    // ===========================

    /**
     * Abre el diálogo de selección de domicilio
     */
    const openDeliveryDialog = () => {
        currentPhase = 'delivery';
        openDialog(refs.dialogDelivery);

        if (refs.btnUseCurrentLocation) {
            refs.btnUseCurrentLocation.style.display = '';
        }
        if (refs.currentLocationStatus) {
            refs.currentLocationStatus.innerHTML = '';
        }
        if (refs.currentLocationLink) {
            refs.currentLocationLink.innerHTML = '';
        }
        if (refs.currentLocationForm) {
            refs.currentLocationForm.style.display = 'none';
        }
        if (refs.detectedAddress) {
            refs.detectedAddress.value = '';
        }
        if (refs.locationConfirmation) {
            refs.locationConfirmation.style.display = 'none';
        }
        if (refs.confirmLocationLink) {
            refs.confirmLocationLink.innerHTML = '';
        }
        if (refs.coverageNote) {
            refs.coverageNote.textContent = '';
        }
    };

    /**
     * Abre el diálogo de selección de sucursal
     */
    const openPickupDialog = () => {
        currentPhase = 'pickup';
        openDialog(refs.dialogPickup);

        if (refs.btnUseCurrentLocation) {
            refs.btnUseCurrentLocation.style.display = 'none';
        }

        // Inicializar mapa de sucursales si está disponible
        if (window.MapsService && !window.MapsService.getPickupMap()) {
            setTimeout(() => {
                window.MapsService.initPickupMap('pickup-map');
                renderBranchesList();
            }, 100);
        } else {
            renderBranchesList();
        }
    };

    /**
     * Renderiza lista de sucursales
     */
    const renderBranchesList = () => {
        if (!window.LocationService || !refs.branchesList) return;

        const branches = window.LocationService.getBranches();
        refs.branchesList.innerHTML = '';
        
        // Obtener sucursal seleccionada actualmente
        const savedPickupData = JSON.parse(localStorage.getItem('pickupData') || '{}');
        const selectedBranchId = savedPickupData.branchId;

        branches.forEach(branch => {
            const branchElement = document.createElement('div');
            const isSelected = branch.id === selectedBranchId;
            branchElement.className = `branch-item${isSelected ? ' selected' : ''}`;
            branchElement.innerHTML = `
                <div class="branch-info">
                    <h3>${branch.name}</h3>
                    <p>${branch.address}</p>
                    <p class="branch-details">
                        <small>${branch.phone} | ${branch.hours}</small>
                    </p>
                </div>
                <button class="btn btn-select-branch" data-branch-id="${branch.id}">
                    ${isSelected ? '✓ Seleccionada' : 'Seleccionar sucursal'}
                </button>
            `;

            const selectBtn = branchElement.querySelector('.btn-select-branch');
            selectBtn.addEventListener('click', () => {
                selectBranch(branch.id, branch.name);
            });

            refs.branchesList.appendChild(branchElement);
        });
    };

    /**
     * Selecciona una sucursal
     */
    const selectBranch = (branchId, branchName) => {
        if (window.LocationService) {
            selectedLocation = window.LocationService.setPickupBranch(branchId);
            
            // Guardar en localStorage con estructura pickupData
            const pickupData = {
                branchId: branchId,
                branchName: branchName,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('pickupData', JSON.stringify(pickupData));
            
            showToast(`✅ Sucursal "${branchName}" seleccionada`, 'success');
            
            // Re-renderizar para mostrar estado seleccionado
            renderBranchesList();
            
            closeDialog(refs.dialogPickup);
        }
    };

    // ===========================
    // BÚSQUEDA DE DIRECCIONES
    // ===========================

    /**
     * Búsqueda de dirección por texto
     */
    const searchAddress = async () => {
        const address = refs.searchAddress.value.trim();
        if (!address) {
            refs.searchResults.innerHTML = '<p class="error">Ingresa una dirección</p>';
            return;
        }

        showToast('Buscando ubicación...', 'loading');
        
        try {
            if (window.MapsService) {
                const result = await window.MapsService.geocodeAddress(address);
                
                // Validar cobertura
                let inCoverage = false;
                if (window.LocationService) {
                    const validation = window.LocationService.validateDeliveryLocation(result.lat, result.lng);
                    inCoverage = validation.inCoverage;
                }

                // Mostrar resultado
                refs.searchResults.innerHTML = `
                    <div class="search-result">
                        <p><strong>Ubicación encontrada:</strong></p>
                        <p>${result.formattedAddress}</p>
                        <p class="coverage-status ${inCoverage ? 'in-coverage' : 'out-coverage'}">
                            ${inCoverage ? '✅ Dentro de zona de cobertura' : '❌ Fuera de zona de cobertura'}
                        </p>
                        <button class="btn btn-select-location" data-lat="${result.lat}" data-lng="${result.lng}">
                            Seleccionar esta ubicación
                        </button>
                    </div>
                `;

                // Agregar event listener al botón
                const selectBtn = refs.searchResults.querySelector('.btn-select-location');
                selectBtn.addEventListener('click', (e) => {
                    const lat = parseFloat(e.target.dataset.lat);
                    const lng = parseFloat(e.target.dataset.lng);
                    selectDeliveryLocation(lat, lng, result.formattedAddress);
                });

                showToast('Ubicación encontrada', 'success');
            }
        } catch (error) {
            showToast(`Error: ${error}`, 'error');
            refs.searchResults.innerHTML = '<p class="error">No se encontró la ubicación</p>';
        }
    };

    /**
     * Usa la ubicación actual del navegador
     */
    const useCurrentLocation = async () => {
        if (currentLocationQueryInProgress) {
            showToast('Espere un momento, ya se está obteniendo la dirección...', 'loading');
            return;
        }

        if (!window.LocationService) {
            console.error('Servicio de ubicación no disponible');
            return;
        }

        currentLocationQueryInProgress = true;
        if (refs.btnUseCurrentLocation) {
            refs.btnUseCurrentLocation.disabled = true;
        }
        if (refs.currentLocationStatus) {
            refs.currentLocationStatus.innerHTML = '<p>Obteniendo dirección...</p>';
        }
        if (refs.currentLocationForm) {
            refs.currentLocationForm.style.display = 'block';
        }

        try {
            const location = await window.LocationService.getCurrentLocation();
            currentLocationCoordinates.lat = location.lat;
            currentLocationCoordinates.lng = location.lng;
            currentLocationCoordinates.mapsUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}`;

            let detectedAddress = `Lat ${location.lat.toFixed(6)}, Lng ${location.lng.toFixed(6)}`;
            let reverseResult = null;

            if (window.MapsService && typeof window.MapsService.reverseGeocodeCoordinates === 'function') {
                try {
                    reverseResult = await window.MapsService.reverseGeocodeCoordinates(location.lat, location.lng);
                    if (reverseResult && reverseResult.formattedAddress) {
                        detectedAddress = reverseResult.formattedAddress;
                    } else {
                        detectedAddress = 'Dirección no disponible';
                    }
                } catch (geocodeError) {
                    detectedAddress = 'No se pudo obtener la dirección';
                    console.warn('Reverse geocode failed:', geocodeError);
                }
            }

            if (refs.currentLocationStatus) {
                refs.currentLocationStatus.innerHTML = `
                    <p class="success">📍 Dirección detectada: <strong>${detectedAddress}</strong></p>
                    <p>Coordenadas: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}</p>
                `;
            }
            if (refs.currentLocationLink) {
                refs.currentLocationLink.innerHTML = `
                    <p>Se usará tu ubicación actual para entregar el pedido.</p>
                    <p><a href="${currentLocationCoordinates.mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Ver ubicación en Google Maps</a></p>
                `;
            }
            if (refs.detectedAddress) {
                refs.detectedAddress.value = detectedAddress;
            }
            if (refs.btnUseCurrentLocation) {
                refs.btnUseCurrentLocation.style.display = 'none';
            }

            selectDeliveryLocation(location.lat, location.lng, detectedAddress);
        } catch (error) {
            if (refs.currentLocationStatus) {
                refs.currentLocationStatus.innerHTML = `<p class="error">No se pudo obtener tu ubicación. Permite el acceso al GPS y vuelve a intentarlo.</p>`;
            }
            if (refs.currentLocationLink) {
                refs.currentLocationLink.innerHTML = '';
            }
        } finally {
            currentLocationQueryInProgress = false;
            if (refs.btnUseCurrentLocation && refs.btnUseCurrentLocation.style.display !== 'none') {
                refs.btnUseCurrentLocation.disabled = false;
            }
        }
    };

    /**
     * Selecciona una ubicación de domicilio
     */
    const selectDeliveryLocation = (lat, lng, address) => {
        if (window.LocationService) {
            selectedLocation = window.LocationService.setDeliveryLocation(lat, lng, address);
            
            // Mostrar confirmación - dirección
            if (refs.confirmAddress) refs.confirmAddress.textContent = address;
            
            // Mostrar coordenadas
            if (refs.confirmCoords) {
                refs.confirmCoords.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            }
            
            // Validar cobertura
            const validation = window.LocationService.validateDeliveryLocation(lat, lng);
            const coverageBadge = refs.confirmCoverage;
            if (coverageBadge) {
                if (validation.inCoverage) {
                    coverageBadge.textContent = '✅ En zona de cobertura';
                    coverageBadge.className = 'coverage-badge in-coverage';
                } else {
                    coverageBadge.textContent = '❌ Fuera de zona de cobertura';
                    coverageBadge.className = 'coverage-badge out-coverage';
                }
            }

            if (refs.confirmLocationLink) {
                refs.confirmLocationLink.innerHTML = currentLocationCoordinates.mapsUrl
                    ? `<a href="${currentLocationCoordinates.mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Ver ubicación en Google Maps</a>`
                    : '';
            }

            // Mostrar nota de cobertura si es necesario
            if (refs.coverageNote) {
                if (validation.inCoverage) {
                    refs.coverageNote.style.display = 'none';
                } else {
                    refs.coverageNote.style.display = 'block';
                    refs.coverageNote.textContent = 'Tu dirección está fuera de la zona de entrega configurada. Si estás cerca de la sucursal, revisa que el GPS esté ubicándote correctamente.';
                }
            }

            // Cargar referencia guardada si existe
            if (refs.deliveryReference) {
                const savedDeliveryData = JSON.parse(localStorage.getItem('deliveryData') || '{}');
                refs.deliveryReference.value = savedDeliveryData.reference || '';
            }

            // Mostrar confirmación
            if (refs.locationConfirmation) {
                refs.locationConfirmation.style.display = 'block';
            }
        }
    };

    // ===========================
    // EVENT LISTENERS
    // ===========================

    // Botones principales
    if (refs.btnDomicilio) {
        refs.btnDomicilio.addEventListener('click', openDeliveryDialog);
    }
    if (refs.btnSucursal) {
        refs.btnSucursal.addEventListener('click', openPickupDialog);
    }

    // Cerrar dialogs
    document.querySelectorAll('.dialog-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dialogId = e.target.dataset.close;
            const dialog = document.getElementById(dialogId);
            closeDialog(dialog);
        });
    });

    // Tabs en diálogo de entrega (si existen)
    refs.dialogDelivery?.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    // Búsqueda
    if (refs.searchAddress) {
        refs.searchAddress.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchAddress();
            }
        });
    }

    // Ubicación actual
    if (refs.btnUseCurrentLocation) {
        refs.btnUseCurrentLocation.addEventListener('click', useCurrentLocation);
    }

    // Confirmación
    if (refs.btnConfirmLocation) {
        refs.btnConfirmLocation.addEventListener('click', () => {
            // Guardar referencia del repartidor
            if (refs.deliveryReference && refs.deliveryReference.value.trim()) {
                const deliveryData = JSON.parse(localStorage.getItem('deliveryData') || '{}');
                deliveryData.reference = refs.deliveryReference.value.trim();
                localStorage.setItem('deliveryData', JSON.stringify(deliveryData));
            }
            
            showToast('✅ Ubicación confirmada. Ahora agrega productos al carrito.', 'success');
            closeDialog(refs.dialogDelivery);
            if (refs.locationConfirmation) {
                refs.locationConfirmation.style.display = 'none';
            }
        });
    }

    // Guardar referencia automáticamente mientras se escribe
    if (refs.deliveryReference) {
        refs.deliveryReference.addEventListener('blur', () => {
            const deliveryData = JSON.parse(localStorage.getItem('deliveryData') || '{}');
            deliveryData.reference = refs.deliveryReference.value.trim();
            localStorage.setItem('deliveryData', JSON.stringify(deliveryData));
        });
    }

    // ===========================
    // API PÚBLICA
    // ===========================

    window.DeliveryForm = {
        openDeliveryDialog,
        openPickupDialog,
        getSelectedLocation: () => selectedLocation,
        saveSelectedLocation: () => {
            if (selectedLocation) {
                sessionStorage.setItem('selectedLocation', JSON.stringify(selectedLocation));
                return true;
            }
            return false;
        }
    };

    console.log('✅ DeliveryForm cargado - Arquitectura de dos fases lista');
})();
