// Este archivo maneja la configuración y pedido de pizzas.
// Incluye tamaños, precios, orillas rellenas y opciones de mitad y mitad.

(() => {
    // Precios para pizzas clásicas por tamaño
    const classicSizePrices = {
        individual: 145,
        mediana: 175,
        familiar: 219,
        extra: 299,
        jumbo: 325
    };

    // Precios para pizzas especiales por tamaño
    const specialSizePrices = {
        individual: 155,
        mediana: 199,
        familiar: 229,
        extra: 315,
        jumbo: 335
    };

    // Precios para orilla rellena (salchicha o queso) - precio total que reemplaza el base
    const stuffedCrustPrices = {
        individual: 205,
        mediana: 265,
        familiar: 305,
        extra: 395,
        jumbo: 505
    };

    // Extra cuando se mezcla mitad clásica + mitad especial
    const halfMixedExtra = 15;

    let currentPizza = null;

    // Formatea un número como precio con símbolo de dólar
    const formatPrice = value => `$${value}`;
    // Obtiene los precios del tamaño actual según el tipo de pizza
    const getCurrentSizePrices = () => currentPizza && currentPizza.sizePrices ? currentPizza.sizePrices : classicSizePrices;

    // Obtiene todos los elementos de pizza en el menú
    const getPizzaItems = () => Array.from(document.querySelectorAll('.menu-item .item-info h3'));

    // Obtiene las referencias a los elementos del modal de pizza
    const getModalRefs = () => {
        const overlay = document.getElementById('pizza-modal-overlay');
        if (!overlay) {
            return null;
        }

        return {
            overlay: overlay,
            closeBtn: document.getElementById('pizza-modal-close'),
            cancelBtn: document.getElementById('pizza-modal-cancel'),
            form: document.getElementById('pizza-config-form'),
            title: document.getElementById('pizza-modal-title'),
            description: document.getElementById('pizza-modal-description'),
            sizeWrap: document.getElementById('pizza-size-options'),
            crustWrap: document.getElementById('pizza-crust-options'),
            halfModeWrap: document.getElementById('pizza-half-mode-options'),
            halfWrap: document.getElementById('pizza-half-selector-wrap'),
            halfLabel: document.getElementById('pizza-half-selector-label'),
            halfSelect: document.getElementById('pizza-half-selector'),
               sauceWrap: document.getElementById('pizza-sauce-options'),
               summary: document.getElementById('pizza-price-summary'),
        };
    };

    const buildOptionCards = (container, groupName, optionsMap, checkedKey) => {
        if (!container) {
            return;
        }

        container.innerHTML = Object.entries(optionsMap).map(([key, price]) => {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            const checked = key === checkedKey ? 'checked' : '';
            return `
                <label class="pizza-choice">
                    <input type="radio" name="${groupName}" value="${key}" ${checked}>
                    <span class="pizza-choice-label">
                        <strong>${label}</strong>
                        <span>${price > 0 ? '+' + formatPrice(price) : 'Sin costo extra'}</span>
                    </span>
                </label>
            `;
        }).join('');
    };

    const buildHalfSelector = refs => {
        if (!refs || !refs.halfSelect || !currentPizza) {
            return;
        }

        const allCards = Array.from(document.querySelectorAll('.menu-item'));
        const options = allCards
            .map(card => {
                const nameEl = card.querySelector('.item-info h3');
                if (!nameEl) { return null; }
                const name = nameEl.textContent.trim();
                if (!name || name === currentPizza.name) { return null; }
                const section = card.closest('[id$="-section"]');
                const category = section && section.id === 'especiales-section' ? 'especiales' : 'clasicas';
                return { name, category };
            })
            .filter(Boolean);

        refs.halfSelect.innerHTML = options.map(({ name, category }) =>
            `<option value="${name}" data-category="${category}">${name}</option>`
        ).join('');
    };

    const getSelectedValue = (form, name) => {
        const selected = form ? form.querySelector(`input[name="${name}"]:checked`) : null;
        return selected ? selected.value : '';
    };

    const updateHalfUI = refs => {
        if (!refs || !refs.halfWrap || !refs.form) {
            return;
        }

        const selectedHalfMode = getSelectedValue(refs.form, 'pizza-half-mode') || 'complete';
        const isComplete = selectedHalfMode === 'complete';

        refs.halfWrap.classList.toggle('hidden', isComplete);

        if (refs.halfLabel) {
            const labelMap = {
                half: 'Elige la segunda mitad',
                complete: 'Elige la segunda mitad'
            };

            refs.halfLabel.textContent = labelMap[selectedHalfMode] || labelMap.complete;
        }
    };

    // Construye opciones de orilla mostrando el precio total cuando es rellena
    const buildCrustOptions = (refs, selectedSize) => {
        if (!refs || !refs.crustWrap) {
            return;
        }

        const size = selectedSize || 'individual';
        const stuffedPrice = stuffedCrustPrices[size] || 205;
        const currentCrust = refs.form ? getSelectedValue(refs.form, 'pizza-crust') || 'normal' : 'normal';

        const crusts = [
            { key: 'normal',    label: 'Normal',             priceText: 'Sin costo extra' },
            { key: 'salchicha', label: 'Orilla de Salchicha', priceText: `Precio total: ${formatPrice(stuffedPrice)}` },
            { key: 'queso',     label: 'Orilla de Queso',     priceText: `Precio total: ${formatPrice(stuffedPrice)}` }
        ];

        refs.crustWrap.innerHTML = crusts.map(({ key, label, priceText }) => {
            const checked = key === currentCrust ? 'checked' : '';
            return `
                <label class="pizza-choice">
                    <input type="radio" name="pizza-crust" value="${key}" ${checked}>
                    <span class="pizza-choice-label">
                        <strong>${label}</strong>
                        <span>${priceText}</span>
                    </span>
                </label>
            `;
        }).join('');
    };

    // Calcula el extra de mitad y mitad según categorías
    const getHalfExtra = refs => {
        if (!currentPizza || !refs) {
            return 0;
        }
        // Si la pizza principal es especial → sin cargo extra
        if (currentPizza.category === 'especiales') {
            return 0;
        }
        // Pizza principal es clásica: solo cobra extra si la 2da mitad es especial
        const selectedOption = refs.halfSelect
            ? refs.halfSelect.options[refs.halfSelect.selectedIndex]
            : null;
        const secondCategory = selectedOption
            ? (selectedOption.getAttribute('data-category') || 'clasicas')
            : 'clasicas';
        return secondCategory === 'especiales' ? halfMixedExtra : 0;
    };

    const updateSummary = refs => {
        if (!refs || !refs.form || !refs.summary || !currentPizza) {
            return;
        }

        const selectedSize = getSelectedValue(refs.form, 'pizza-size') || 'individual';
        const selectedCrust = getSelectedValue(refs.form, 'pizza-crust') || 'normal';
        const selectedHalfMode = getSelectedValue(refs.form, 'pizza-half-mode') || 'complete';
        const isHalf = selectedHalfMode === 'half';
        const isStuffed = selectedCrust !== 'normal';

        const sizePrices = getCurrentSizePrices();
        const basePrice = isStuffed
            ? (stuffedCrustPrices[selectedSize] || 0)
            : (sizePrices[selectedSize] || 0);
        const halfExtra = isHalf ? getHalfExtra(refs) : 0;
        const total = basePrice + halfExtra;

        const halfLabelMap = {
            half: 'Mitad y mitad',
            complete: 'Pizza completa'
        };

        const secondHalfName = isHalf && refs.halfSelect ? refs.halfSelect.value : '';
        const secondHalfText = secondHalfName
            ? `<br>2da mitad: ${secondHalfName}${halfExtra > 0 ? ` (+${formatPrice(halfExtra)})` : ''}`
            : '';

        const selectedSauce = getSelectedValue(refs.form, 'pizza-sauce') || 'jitomate';
        const sauceLabel = selectedSauce === 'bbq' ? 'BBQ' : 'Jitomate';
        const crustLabel = isStuffed ? `${selectedCrust} (precio incluido)` : selectedCrust;

        refs.summary.innerHTML = `
            <strong>${currentPizza.name}</strong><br>
            Tamaño: ${selectedSize} (${formatPrice(basePrice)})<br>
            Salsa: ${sauceLabel}<br>
            Orilla: ${crustLabel}<br>
            Modo: ${halfLabelMap[selectedHalfMode] || halfLabelMap.complete}${secondHalfText}<br>
            <strong>Total: ${formatPrice(total)}</strong>
        `;
    };

    const openPizzaModal = pizzaData => {
        const refs = getModalRefs();
        if (!refs || !refs.form) {
            return;
        }

        currentPizza = pizzaData;
        refs.title.textContent = pizzaData.name;
        refs.description.textContent = pizzaData.description;

        buildOptionCards(refs.sizeWrap, 'pizza-size', getCurrentSizePrices(), 'individual');
        buildCrustOptions(refs, 'individual');
        buildOptionCards(refs.sauceWrap, 'pizza-sauce', { jitomate: 0, bbq: 0 }, 'jitomate');

        const defaultHalfMode = refs.form.querySelector('input[name="pizza-half-mode"][value="complete"]');
        if (defaultHalfMode) {
            defaultHalfMode.checked = true;
        }

        buildHalfSelector(refs);
        updateHalfUI(refs);
        updateSummary(refs);

        refs.overlay.classList.remove('hidden');
        document.body.classList.add('modal-open');
    };

    const closePizzaModal = () => {
        const refs = getModalRefs();
        if (!refs || !refs.overlay || refs.overlay.classList.contains('hidden')) {
            return;
        }

        refs.overlay.classList.add('hidden');
        document.body.classList.remove('modal-open');
        currentPizza = null;
    };

    const handleTabClick = button => {
        const tabName = button.getAttribute('data-tab');
        if (!tabName) {
            return;
        }

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn === button);
        });

        document.querySelectorAll('[id$="-section"]').forEach(section => {
            section.classList.add('hidden');
        });

        const target = document.getElementById(tabName + '-section');
        if (target) {
            target.classList.remove('hidden');
        }
    };

    const initPizzaPage = () => {
        const firstTab = document.querySelector('.tab-btn.active') || document.querySelector('.tab-btn');
        if (firstTab) {
            handleTabClick(firstTab);
        }
    };

    document.addEventListener('click', event => {
        const tabButton = event.target.closest('.tab-btn');
        if (tabButton) {
            handleTabClick(tabButton);
            return;
        }

        const addButton = event.target.closest('.menu-item .btn-add');
        if (addButton) {
            const card = addButton.closest('.menu-item');
            const section = addButton.closest('.menu-section-container');
            const name = card ? card.querySelector('h3') : null;
            const description = card ? card.querySelector('.item-description') : null;
            const isSpecial = section && section.id === 'especiales-section';

            if (name && description) {
                openPizzaModal({
                    name: name.textContent.trim(),
                    description: description.textContent.trim(),
                    category: isSpecial ? 'especiales' : 'clasicas',
                    sizePrices: isSpecial ? specialSizePrices : classicSizePrices
                });
            }
            return;
        }

        const refs = getModalRefs();
        if (!refs) {
            return;
        }

        if (event.target === refs.closeBtn || event.target === refs.cancelBtn) {
            closePizzaModal();
        }
    });

    document.addEventListener('change', event => {
        const refs = getModalRefs();
        if (!refs || !currentPizza || !refs.overlay || refs.overlay.classList.contains('hidden')) {
            return;
        }

        if (event.target.matches('input[name="pizza-size"]')) {
            buildCrustOptions(refs, event.target.value);
            updateHalfUI(refs);
            updateSummary(refs);
        } else if (event.target === refs.halfSelect || event.target.matches('input[name="pizza-crust"], input[name="pizza-half-mode"], input[name="pizza-sauce"]')) {
            updateHalfUI(refs);
            updateSummary(refs);
        }
    });

    document.addEventListener('submit', event => {
        const refs = getModalRefs();
        if (!refs || event.target !== refs.form || !currentPizza) {
            return;
        }

        event.preventDefault();

        const selectedSize = getSelectedValue(refs.form, 'pizza-size') || 'individual';
        const selectedCrust = getSelectedValue(refs.form, 'pizza-crust') || 'normal';
        const selectedHalfMode = getSelectedValue(refs.form, 'pizza-half-mode') || 'complete';
        const isHalf = selectedHalfMode === 'half';
        const secondHalf = isHalf && refs.halfSelect ? refs.halfSelect.value : '';
        const isStuffed = selectedCrust !== 'normal';
        const sizePrices = getCurrentSizePrices();
        const basePrice = isStuffed
            ? (stuffedCrustPrices[selectedSize] || 0)
            : (sizePrices[selectedSize] || 0);
        const halfExtra = isHalf ? getHalfExtra(refs) : 0;
        const total = basePrice + halfExtra;

        const detail = {
            productType: 'pizza',
            name: currentPizza.name,
            size: selectedSize,
            crust: selectedCrust,
            sauce: getSelectedValue(refs.form, 'pizza-sauce') || 'jitomate',
            halfMode: selectedHalfMode,
            halfAndHalf: isHalf,
            secondHalf: secondHalf,
            total: total
        };

        document.dispatchEvent(new CustomEvent('cart:add', {
            detail: detail
        }));

        closePizzaModal();
    });

    document.addEventListener('click', event => {
        const refs = getModalRefs();
        if (!refs || !refs.overlay || refs.overlay.classList.contains('hidden')) {
            return;
        }

        if (event.target === refs.overlay) {
            closePizzaModal();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') {
            return;
        }

        closePizzaModal();
    });

    document.addEventListener('menu:sectionchange', event => {
        if (event.detail && event.detail.path === 'pizzas.html') {
            initPizzaPage();
        }
    });

    initPizzaPage();
})();
