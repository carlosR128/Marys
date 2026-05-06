// Este archivo controla el menú móvil (hamburger menu).
// Permite abrir y cerrar el menú desplegable en dispositivos móviles.

// Elementos del DOM para el menú móvil
const hamburgerBtn = document.getElementById('hamburger-btn');
const mobileDropdown = document.getElementById('mobile-dropdown-menu');

if (hamburgerBtn && mobileDropdown) {
    // Función para cerrar el menú móvil
    const closeMobileMenu = () => {
        mobileDropdown.classList.remove('show');
        mobileDropdown.classList.add('hidden');
        hamburgerBtn.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
    };

    // Evento de clic en el botón hamburguesa para abrir/cerrar el menú
    hamburgerBtn.addEventListener('click', event => {
        event.stopPropagation();
        const isOpen = mobileDropdown.classList.contains('show');

        if (isOpen) {
            closeMobileMenu();
            return;
        }

        mobileDropdown.classList.add('show');
        mobileDropdown.classList.remove('hidden');
        hamburgerBtn.classList.add('open');
        hamburgerBtn.setAttribute('aria-expanded', 'true');
    });

    // Cerrar el menú al hacer clic en un enlace
    mobileDropdown.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            closeMobileMenu();
        });
    });

    // Cerrar el menú al hacer clic fuera de él
    document.addEventListener('click', event => {
        if (!mobileDropdown.contains(event.target) && !hamburgerBtn.contains(event.target)) {
            closeMobileMenu();
        }
    });

    // Cerrar el menú con la tecla Escape
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeMobileMenu();
        }
    });
}
