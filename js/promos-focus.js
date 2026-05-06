// Este archivo hace que la página de promociones se desplace automáticamente
// a la sección de combos cuando se carga sin un hash en la URL.

(function () {
    // Función para enfocar la grilla de promociones
    function focusPromoGrid() {
        if (window.location.hash) {
            return;
        }

        const promoGridStart = document.querySelector('#promos-list .menu-section-container');
        if (!promoGridStart) {
            return;
        }

        // Si no hay hash, desplaza la vista a la grilla de combos
        promoGridStart.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    // Ejecuta la función cuando la página termina de cargar
    window.addEventListener('load', focusPromoGrid);
})();
