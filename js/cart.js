// Este archivo maneja toda la funcionalidad del carrito de compras.
// Incluye agregar productos, calcular totales, guardar en localStorage y procesar pedidos.

(() => {
    // Clave para guardar el carrito en el navegador
    const STORAGE_KEY = 'abcg-cart-items';
    // URL base para las llamadas a la API
    const API_BASE = window.ABCG_API_BASE || 'http://localhost:3000';

    // Función segura para convertir texto JSON en un array, devuelve vacío si hay error
    const safeParse = value => {
        try {
            const parsed = JSON.parse(value || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    };

    // Obtiene el nombre de la página actual desde la URL
    const getCurrentPageKey = () => (window.location.pathname.split('/').pop() || '').replace('.html', '').toLowerCase();

    // Convierte el nombre de la página en la categoría del menú correspondiente
    const getCategoryFromPage = () => {
        const categoryMap = {
            pizzas: 'Pizzas',
            pastas: 'Pastas',
            calzones: 'Calzones',
            alitas_y_cryspy: 'Alitas',
            hamburguesas: 'Hamburguesas',
            hotdog: 'Hot Dog',
            ensaladas: 'Ensaladas',
            snacks: 'Snacks',
            postres: 'Postres',
            bebidas: 'Bebidas',
            promos: 'Promociones'
        };

        return categoryMap[getCurrentPageKey()] || 'General';
    };

    // Asegura que los items del carrito tengan los tipos de datos correctos
    const normalizeCartItems = items => items.map(item => {
        const qty = Math.max(1, Number(item.qty || 1));
        const unitPrice = Number(item.unitPrice || item.total || item.price || 0);
        return {
            id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            name: item.name || 'Producto',
            category: item.category || '',
            productType: item.productType || '',
            size: item.size || '',
            crust: item.crust || '',
            sauce: item.sauce || '',
            halfMode: item.halfMode || 'complete',
            halfAndHalf: Boolean(item.halfAndHalf),
            secondHalf: item.secondHalf || '',
            qty: qty,
            unitPrice: unitPrice,
            total: unitPrice * qty
        };
    });

    // Items actuales del carrito, cargados desde localStorage
    let cartItems = normalizeCartItems(safeParse(window.localStorage.getItem(STORAGE_KEY)));
    let cartRefs = null;
    let toastRef = null;
    let isSubmittingOrder = false;
    let availableBranches = [];

    // Formatea un número como precio con símbolo de dólar
    const formatPrice = value => `$${Number(value || 0).toFixed(0)}`;

    // Obtiene el precio unitario de un producto
    const getItemUnitPrice = item => Number(item.unitPrice || item.total || item.price || 0);

    // Calcula el total para una línea de producto (precio × cantidad)
    const getItemLineTotal = item => getItemUnitPrice(item) * Number(item.qty || 1);

    // Calcula el total de todo el carrito sumando todas las líneas
    const getTotal = () => cartItems.reduce((sum, item) => sum + getItemLineTotal(item), 0);

    /**
     * Estructura los pies de tarjeta de productos para mejor UX
     */
    const wrapCardFooters = () => {
        document.querySelectorAll('.item-info:not([data-card-structured])').forEach(info => {
            const price = info.querySelector(':scope > .item-price');
            const btn = info.querySelector(':scope > .btn-add');
            if (!btn) {
                return;
            }

            const footer = document.createElement('div');
            footer.className = 'item-footer';
            info.appendChild(footer);

            if (price) {
                footer.appendChild(price);
            }

            footer.appendChild(btn);
            info.setAttribute('data-card-structured', '1');
        });
    };

    /**
     * Muestra un mensaje toast temporal en la interfaz
     * @param {string} message - Mensaje a mostrar
     */
    const showToast = message => {
        if (!toastRef) {
            return;
        }

        toastRef.textContent = message;
        toastRef.classList.add('show');

        window.clearTimeout(showToast.timeoutId);
        showToast.timeoutId = window.setTimeout(() => {
            toastRef.classList.remove('show');
        }, 2200);
    };

    /**
     * Guarda el estado actual del carrito en localStorage
     */
    const saveCart = () => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    };

    /**
     * Construye metadatos descriptivos de un item del carrito
     * @param {object} item - Item del carrito
     * @returns {array} Array de líneas descriptivas del item
     */
    const buildItemMeta = item => {
        const lines = [];

        if (item.size) {
            lines.push(`Tamaño: ${item.size}`);
        }

        if (item.crust) {
            lines.push(`Orilla: ${item.crust}`);
        }

        if (item.sauce) {
            lines.push(`Salsa: ${item.sauce}`);
        }

        if (item.halfAndHalf) {
            lines.push(`Mitad y mitad: ${item.secondHalf ? item.secondHalf : 'Sí'}`);
        }

        return lines;
    };

    /**
     * Actualiza los indicadores del carrito en la navegación
     */
    const updateCartTriggers = () => {
        const triggers = Array.from(document.querySelectorAll('.nav-carrito'));
        const count = cartItems.reduce((sum, item) => sum + Number(item.qty || 1), 0);

        triggers.forEach(trigger => {
            trigger.setAttribute('data-cart-count', String(count));
            trigger.setAttribute('aria-label', `Abrir carrito (${count} productos)`);
            trigger.classList.toggle('has-items', count > 0);
        });
    };

    /**
     * Parsea un precio desde texto eliminando caracteres no numéricos
     * @param {string} text - Texto que contiene un precio
     * @returns {number} Valor numérico del precio
     */
    const parsePrice = text => {
        if (!text) {
            return 0;
        }

        const normalized = String(text).replace(/,/g, '.');
        const match = normalized.match(/\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : 0;
    };

    /**
     * Determina si se debe omitir la adición automática de items al carrito
     * @param {Element} addButton - Botón de agregar al carrito
     * @returns {boolean} True si se debe omitir la adición automática
     */
    const shouldSkipAutoAdd = addButton => {
        if (!addButton) {
            return true;
        }

        if (addButton.hasAttribute('data-item-id')) {
            return true;
        }

        const hasPizzaModal = Boolean(document.getElementById('pizza-config-form'));
        const hasPizzaTabs = Boolean(document.querySelector('.pizza-tabs'));
        if (hasPizzaModal && hasPizzaTabs) {
            return true;
        }

        return false;
    };

    /**
     * Construye detalles de un item desde la información de la tarjeta del menú
     * @param {Element} addButton - Botón que activó la adición
     * @returns {object|null} Detalles del item o null si no se puede construir
     */
    const buildDetailFromCard = addButton => {
        const card = addButton.closest('.menu-item');
        if (!card) {
            return null;
        }

        const titleEl = card.querySelector('.item-info h3');
        const priceEl = card.querySelector('.item-price');
        const selectEls = Array.from(card.querySelectorAll('.item-select'));

        const selectedOptionText = selectEls
            .map(selectEl => {
                if (!selectEl || !selectEl.options || selectEl.selectedIndex < 0) {
                    return '';
                }

                const label = card.querySelector(`label[for="${selectEl.id}"]`);
                const optionText = selectEl.options[selectEl.selectedIndex].textContent.trim();
                return label ? `${label.textContent.trim()}: ${optionText}` : optionText;
            })
            .filter(Boolean)
            .join(' | ');

        return {
            name: titleEl ? titleEl.textContent.trim() : 'Producto',
            category: getCategoryFromPage(),
            productType: getCurrentPageKey(),
            size: selectedOptionText,
            crust: '',
            sauce: '',
            halfMode: 'complete',
            halfAndHalf: false,
            secondHalf: '',
            total: parsePrice(priceEl ? priceEl.textContent : '')
        };
    };

    /**
     * Obtiene los datos del formulario de pedido desde las referencias del DOM
     * @returns {object} Datos del formulario de pedido
     */
    const getOrderFormData = () => {
        if (!cartRefs) {
            return {
                customerName: '',
                customerPhone: '',
                branchId: '',
                orderType: 'para_llevar',
                paymentMethod: 'efectivo',
                deliveryAddress: '',
                notes: ''
            };
        }

        return {
            customerName: cartRefs.customerName ? cartRefs.customerName.value.trim() : '',
            customerPhone: cartRefs.customerPhone ? cartRefs.customerPhone.value.trim() : '',
            branchId: cartRefs.branchId ? cartRefs.branchId.value : '',
            orderType: cartRefs.orderType ? cartRefs.orderType.value : 'para_llevar',
            paymentMethod: cartRefs.paymentMethod ? cartRefs.paymentMethod.value : 'efectivo',
            deliveryAddress: cartRefs.deliveryAddress ? cartRefs.deliveryAddress.value.trim() : '',
            notes: cartRefs.notes ? cartRefs.notes.value.trim() : ''
        };
    };

    /**
     * Valida los datos del formulario de pedido
     * @param {object} formData - Datos del formulario a validar
     * @returns {string} Mensaje de error o cadena vacía si es válido
     */
    const validateOrderForm = formData => {
        return '';
    };

    /**
     * Construye el payload completo del pedido para enviar al API
     * @param {object} formData - Datos validados del formulario
     * @returns {object} Payload del pedido listo para API
     */
    const buildOrderPayload = formData => ({
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        branchId: Number(formData.branchId),
        orderType: formData.orderType,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
        deliveryAddress: formData.orderType === 'domicilio'
            ? { texto: formData.deliveryAddress }
            : null,
        items: cartItems.map(item => ({
            name: item.name,
            category: item.category || getCategoryFromPage(),
            productType: item.productType || getCurrentPageKey(),
            size: item.size,
            crust: item.crust,
            sauce: item.sauce,
            halfMode: item.halfMode,
            halfAndHalf: item.halfAndHalf,
            secondHalf: item.secondHalf,
            qty: Number(item.qty || 1),
            unitPrice: getItemUnitPrice(item),
            total: getItemLineTotal(item)
        }))
    });

    /**
     * Actualiza el estado de los botones de acción del carrito
     */
    const updateCartActionState = () => {
        if (!cartRefs) {
            return;
        }

        if (cartRefs.send) {
            cartRefs.send.disabled = isSubmittingOrder || !cartItems.length;
            cartRefs.send.textContent = isSubmittingOrder
                ? 'Guardando pedido...'
                : 'Guardar pedido';
        }

        if (cartRefs.clear) {
            cartRefs.clear.disabled = isSubmittingOrder || !cartItems.length;
        }

        if (cartRefs.branchId) {
            cartRefs.branchId.disabled = isSubmittingOrder;
        }
    };

    /**
     * Establece el estado de envío del pedido y actualiza la UI
     * @param {boolean} submitting - Si se está enviando el pedido
     */
    const setSubmittingState = submitting => {
        isSubmittingOrder = submitting;
        updateCartActionState();
    };

    /**
     * Renderiza las opciones de sucursal en el select correspondiente
     */
    const renderBranchOptions = () => {
        if (!cartRefs || !cartRefs.branchId) {
            return;
        }

        const currentValue = cartRefs.branchId.value;
        const options = ['<option value="">Selecciona una sucursal</option>']
            .concat(availableBranches.map(branch => `<option value="${branch.id}">${branch.nombre}</option>`));

        cartRefs.branchId.innerHTML = options.join('');

        if (currentValue && availableBranches.some(branch => String(branch.id) === String(currentValue))) {
            cartRefs.branchId.value = currentValue;
            return;
        }

        if (availableBranches.length === 1) {
            cartRefs.branchId.value = String(availableBranches[0].id);
        }
    };

    /**
     * Carga las sucursales disponibles desde el API
     */
    const loadBranches = async () => {
        try {
            const response = await window.fetch(`${API_BASE}/api/branches`);
            const data = await response.json().catch(() => ({}));

            if (!response.ok || !Array.isArray(data.branches)) {
                throw new Error(data.error || 'No se pudieron cargar las sucursales.');
            }

            availableBranches = data.branches;
            renderBranchOptions();
        } catch (error) {
            availableBranches = [];
            renderBranchOptions();
            showToast(error.message || 'No se pudieron cargar las sucursales.');
        }
    };

    /**
     * Sincroniza los highlights visuales de items en el carrito con las tarjetas del menú
     */
    const syncCartHighlights = () => {
        document.querySelectorAll('.menu-item').forEach(card => {
            const heading = card.querySelector('h3');
            if (!heading) {
                return;
            }

            const name = heading.textContent.trim().toLowerCase();
            const cartItem = cartItems.find(item => item.name.trim().toLowerCase() === name);
            
            if (cartItem) {
                card.classList.add('in-cart');
                
                // Crear o actualizar badge de cantidad
                let badge = card.querySelector('.item-quantity-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'item-quantity-badge';
                    card.appendChild(badge);
                }
                badge.textContent = `x${cartItem.qty}`;
            } else {
                card.classList.remove('in-cart');
                const badge = card.querySelector('.item-quantity-badge');
                if (badge) {
                    badge.remove();
                }
            }
        });
    };

    /**
     * Renderiza el contenido completo del carrito en el DOM
     */
    const renderCart = () => {
        if (!cartRefs) {
            return;
        }

        updateCartTriggers();

        if (!cartItems.length) {
            cartRefs.items.innerHTML = '<p class="cart-empty">Tu carrito está vacío.</p>';
            cartRefs.total.textContent = formatPrice(0);
            updateCartActionState();
            syncCartHighlights();
            return;
        }

        cartRefs.items.innerHTML = cartItems.map(item => {
            const meta = buildItemMeta(item)
                .map(line => `<li>${line}</li>`)
                .join('');

            return `
                <article class="cart-item" data-cart-id="${item.id}">
                    <div class="cart-item-copy">
                        <h3>${item.name}</h3>
                        <ul>${meta}</ul>
                    </div>
                    <div class="cart-item-side">
                        <div class="cart-qty-controls" aria-label="Controles de cantidad">
                            <button type="button" class="cart-qty-btn" data-cart-dec="${item.id}" aria-label="Disminuir cantidad">-</button>
                            <span class="cart-qty-value">x${Number(item.qty || 1)}</span>
                            <button type="button" class="cart-qty-btn" data-cart-inc="${item.id}" aria-label="Aumentar cantidad">+</button>
                        </div>
                        <strong>${formatPrice(getItemLineTotal(item))}</strong>
                        <button type="button" class="cart-remove-btn" data-remove-cart-item="${item.id}">Quitar</button>
                    </div>
                </article>
            `;
        }).join('');

        cartRefs.total.textContent = formatPrice(getTotal());
        updateCartActionState();
        syncCartHighlights();
    };

    /**
     * Abre el modal del carrito
     */
    const openCart = () => {
        if (!cartRefs) {
            return;
        }

        cartRefs.overlay.classList.remove('hidden');
        cartRefs.panel.classList.add('open');
        document.body.classList.add('modal-open');
    };

    /**
     * Cierra el modal del carrito
     */
    const closeCart = () => {
        if (!cartRefs) {
            return;
        }

        cartRefs.overlay.classList.add('hidden');
        cartRefs.panel.classList.remove('open');
        document.body.classList.remove('modal-open');
    };

    /**
     * Agrega un item al carrito, combinando con items similares si existen
     * @param {object} detail - Detalles del item a agregar
     */
    const addItem = detail => {
        const unitPrice = Number(detail.total || detail.price || 0);
        const item = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            name: detail.name || 'Producto',
            category: detail.category || getCategoryFromPage(),
            productType: detail.productType || getCurrentPageKey(),
            size: detail.size || '',
            crust: detail.crust || '',
            sauce: detail.sauce || '',
            halfMode: detail.halfMode || 'complete',
            halfAndHalf: Boolean(detail.halfAndHalf),
            secondHalf: detail.secondHalf || '',
            qty: 1,
            unitPrice: unitPrice,
            total: unitPrice
        };

        const existing = cartItems.find(current => (
            current.name === item.name
            && current.category === item.category
            && current.productType === item.productType
            && current.size === item.size
            && current.crust === item.crust
            && current.sauce === item.sauce
            && current.halfMode === item.halfMode
            && current.halfAndHalf === item.halfAndHalf
            && current.secondHalf === item.secondHalf
            && getItemUnitPrice(current) === unitPrice
        ));

        if (existing) {
            existing.qty = Number(existing.qty || 1) + 1;
            existing.unitPrice = getItemUnitPrice(existing);
            existing.total = getItemLineTotal(existing);
        } else {
            cartItems.push(item);
        }

        saveCart();
        renderCart();
    };

    /**
     * Remueve un item del carrito por su ID
     * @param {string} id - ID del item a remover
     */
    const removeItem = id => {
        cartItems = cartItems.filter(item => item.id !== id);
        saveCart();
        renderCart();
    };

    /**
     * Cambia la cantidad de un item del carrito
     * @param {string} id - ID del item
     * @param {number} delta - Cambio en la cantidad (+1 o -1)
     */
    const changeItemQty = (id, delta) => {
        const item = cartItems.find(current => current.id === id);
        if (!item) {
            return;
        }

        const nextQty = Number(item.qty || 1) + Number(delta || 0);

        if (nextQty <= 0) {
            removeItem(id);
            return;
        }

        item.qty = nextQty;
        item.total = getItemLineTotal(item);
        saveCart();
        renderCart();
    };

    /**
     * Vacía completamente el carrito
     */
    const clearCart = () => {
        cartItems = [];
        saveCart();
        renderCart();
    };

    /**
     * Envía el pedido al servidor después de validación
     */
    const submitOrder = async () => {
        if (!cartItems.length || isSubmittingOrder) {
            return;
        }

        const formData = getOrderFormData();
        const validationError = validateOrderForm(formData);

        if (validationError) {
            showToast(validationError);
            return;
        }

        setSubmittingState(true);

        try {
            const response = await window.fetch(`${API_BASE}/api/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(buildOrderPayload(formData))
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const detail = data.detail ? ` (${data.detail})` : '';
                throw new Error((data.error || 'No se pudo guardar el pedido.') + detail);
            }

            clearCart();
            closeCart();
        } catch (error) {
            showToast(error.message || 'No se pudo guardar el pedido.');
        } finally {
            setSubmittingState(false);
        }
    };

    /**
     * Asegura que el botón de envío del pedido exista en el DOM
     */
    const ensureSendButton = () => {
        if (!cartRefs || !cartRefs.clear) {
            return;
        }

        const actionsRow = cartRefs.clear.closest('.cart-actions-row');
        if (!actionsRow) {
            return;
        }

        let sendBtn = actionsRow.querySelector('#cart-send-whatsapp');
        if (!sendBtn) {
            sendBtn = document.createElement('button');
            sendBtn.type = 'button';
            sendBtn.className = 'btn-add';
            sendBtn.id = 'cart-send-whatsapp';
            actionsRow.insertBefore(sendBtn, actionsRow.firstChild);
        }

        sendBtn.textContent = 'Guardar pedido';
        cartRefs.send = sendBtn;

        if (cartRefs.clear.parentElement === actionsRow && actionsRow.firstElementChild !== cartRefs.send) {
            actionsRow.insertBefore(cartRefs.send, actionsRow.firstChild);
        }
    };

    /**
     * Asegura que los campos del formulario de checkout existan en el DOM
     */
    const ensureCheckoutFields = () => {
        if (!cartRefs || !cartRefs.panel) {
            return;
        }

        const footer = cartRefs.panel.querySelector('.cart-footer');
        if (!footer) {
            return;
        }

        let checkout = footer.querySelector('.cart-checkout');
        if (!checkout) {
            checkout = document.createElement('div');
            checkout.className = 'cart-checkout';
            checkout.innerHTML = `
                <label class="cart-field">
                    <span>Nombre</span>
                    <input type="text" id="cart-customer-name" placeholder="Nombre del cliente">
                </label>
                <label class="cart-field">
                    <span>Teléfono</span>
                    <input type="tel" id="cart-customer-phone" placeholder="2221234567">
                </label>
                <label class="cart-field">
                    <span>Sucursal</span>
                    <select id="cart-branch-id">
                        <option value="">Cargando sucursales...</option>
                    </select>
                </label>
                <div class="cart-field-grid">
                    <label class="cart-field">
                        <span>Tipo de pedido</span>
                        <select id="cart-order-type">
                            <option value="para_llevar">Para llevar</option>
                            <option value="local">Local</option>
                            <option value="domicilio">Domicilio</option>
                        </select>
                    </label>
                    <label class="cart-field">
                        <span>Método de pago</span>
                        <select id="cart-payment-method">
                            <option value="efectivo">Efectivo</option>
                            <option value="tarjeta">Tarjeta</option>
                            <option value="transferencia">Transferencia</option>
                        </select>
                    </label>
                </div>
                <label class="cart-field hidden" id="cart-delivery-wrap">
                    <span>Dirección de entrega</span>
                    <textarea id="cart-delivery-address" rows="2" placeholder="Calle, número, colonia, referencias"></textarea>
                </label>
                <label class="cart-field">
                    <span>Notas</span>
                    <textarea id="cart-order-notes" rows="2" placeholder="Indicaciones del pedido"></textarea>
                </label>
            `;

            const totalRow = footer.querySelector('.cart-total-row');
            footer.insertBefore(checkout, totalRow || footer.firstChild);
        }
    };

    /**
     * Alterna la visibilidad del campo de dirección de entrega según el tipo de pedido
     */
    const toggleDeliveryAddress = () => {
        if (!cartRefs || !cartRefs.orderType || !cartRefs.deliveryWrap || !cartRefs.deliveryAddress) {
            return;
        }

        const isDelivery = cartRefs.orderType.value === 'domicilio';
        cartRefs.deliveryWrap.classList.toggle('hidden', !isDelivery);
        cartRefs.deliveryAddress.required = isDelivery;
    };

    /**
     * Establece las referencias del DOM para los elementos del carrito
     */
    const setCartRefsFromDom = () => {
        cartRefs = {
            overlay: document.getElementById('cart-overlay'),
            panel: document.getElementById('cart-panel'),
            items: document.getElementById('cart-items'),
            total: document.getElementById('cart-total-value'),
            send: document.getElementById('cart-send-whatsapp'),
            clear: document.getElementById('cart-clear'),
            customerName: null,
            customerPhone: null,
            branchId: null,
            orderType: null,
            paymentMethod: null,
            deliveryWrap: null,
            deliveryAddress: null,
            notes: null
        };
    };

    /**
     * Asegura que la UI del carrito esté presente y configurada
     */
    const ensureCartUI = () => {
        if (document.getElementById('cart-overlay')) {
            setCartRefsFromDom();
            setCartRefsFromDom();
            cartRefs.send.addEventListener('click', submitOrder);
            return;
        }

        const markup = document.createElement('div');
        markup.innerHTML = `
            <div class="cart-toast" id="cart-toast"></div>
            <div class="modal-overlay hidden cart-overlay" id="cart-overlay">
                <aside class="cart-panel" id="cart-panel" aria-labelledby="cart-title" aria-modal="true" role="dialog">
                    <div class="cart-header">
                        <div>
                            <p class="modal-tag">Tu pedido</p>
                            <h2 id="cart-title">Carrito</h2>
                        </div>
                        <button type="button" class="modal-close" id="cart-close" aria-label="Cerrar carrito">&times;</button>
                    </div>
                    <div class="cart-items" id="cart-items"></div>
                    <div class="cart-footer">
                        <div class="cart-total-row">
                            <span>Total</span>
                            <strong id="cart-total-value">$0</strong>
                        </div>
                        <div class="cart-actions-row">
                            <button type="button" class="btn-add" id="cart-send-whatsapp">Guardar pedido</button>
                            <button type="button" class="btn-add btn-secondary" id="cart-clear">Vaciar</button>
                        </div>
                    </div>
                </aside>
            </div>
        `;

        const fragment = document.createDocumentFragment();
        while (markup.firstElementChild) {
            fragment.appendChild(markup.firstElementChild);
        }
        document.body.appendChild(fragment);

        toastRef = document.getElementById('cart-toast');
        setCartRefsFromDom();

        const closeBtn = document.getElementById('cart-close');

        closeBtn.addEventListener('click', closeCart);
        cartRefs.overlay.addEventListener('click', event => {
            if (event.target === cartRefs.overlay) {
                closeCart();
            }
        });
        cartRefs.items.addEventListener('click', event => {
            const incBtn = event.target.closest('[data-cart-inc]');
            if (incBtn) {
                changeItemQty(incBtn.getAttribute('data-cart-inc'), 1);
                return;
            }

            const decBtn = event.target.closest('[data-cart-dec]');
            if (decBtn) {
                changeItemQty(decBtn.getAttribute('data-cart-dec'), -1);
                return;
            }

            const removeBtn = event.target.closest('[data-remove-cart-item]');
            if (!removeBtn) {
                return;
            }
            removeItem(removeBtn.getAttribute('data-remove-cart-item'));
        });
        cartRefs.clear.addEventListener('click', clearCart);
        cartRefs.send.addEventListener('click', submitOrder);
    };

    // Event listener para abrir el carrito desde la navegación
    document.addEventListener('click', event => {
        const cartTrigger = event.target.closest('.nav-carrito');
        if (!cartTrigger) {
            return;
        }

        event.preventDefault();
        openCart();
    });

    // Event listener para agregar items al carrito desde las tarjetas del menú
    document.addEventListener('click', event => {
        const addButton = event.target.closest('.menu-item .btn-add');
        if (!addButton || shouldSkipAutoAdd(addButton)) {
            return;
        }

        event.preventDefault();

        const detail = buildDetailFromCard(addButton);
        if (!detail) {
            return;
        }

        addItem(detail);
    });

    // Event listener para cerrar el carrito con la tecla Escape
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeCart();
        }
    });

    // Event listener para agregar items al carrito via eventos custom
    document.addEventListener('cart:add', event => {
        if (!event.detail) {
            return;
        }

        addItem(event.detail);
    });

    // Inicialización del carrito
    ensureCartUI();
    loadBranches();

    if (!toastRef) {
        toastRef = document.getElementById('cart-toast');
    }

    wrapCardFooters();
    document.addEventListener('menu:sectionchange', () => {
        wrapCardFooters();
        syncCartHighlights();
    });
    renderCart();

    // Exponer API pública para integración con otros módulos
    window.Cart = {
        getItems: () => JSON.parse(JSON.stringify(cartItems)), // Copia profunda
        clearCart,
        getTotal,
        submitOrder,
        showToast
    };

    // Hacer cartItems accesible globalmente para delivery-form
    Object.defineProperty(window, 'cartItems', {
        get() {
            return cartItems;
        },
        enumerable: true
    });
})();
