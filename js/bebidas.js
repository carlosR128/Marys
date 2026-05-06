// Este archivo maneja la funcionalidad de las pestañas en la sección de bebidas.
// Permite alternar entre bebidas sin alcohol y bebidas con alcohol.

(function(){
    const tabs = document.querySelectorAll('.tab-btn');
    const alcohol = document.getElementById('alcoholSection');
    const tabBebidas = document.getElementById('tab-bebidas');

    // Función para cambiar la pestaña activa y mostrar/ocultar secciones
    function setActiveTab(target){
        tabs.forEach(t=> t.classList.toggle('active', t.dataset.target===target));
        if(target === 'tab-bebidas'){
            if(tabBebidas) tabBebidas.classList.remove('hidden');
            if(alcohol) alcohol.classList.add('hidden');
        } else if(target === 'alcoholSection'){
            if(tabBebidas) tabBebidas.classList.add('hidden');
            if(alcohol) alcohol.classList.remove('hidden');
            if(alcohol) alcohol.scrollIntoView({behavior:'smooth'});
        }
    }

    // Agrega eventos de clic a cada pestaña
    tabs.forEach(t=> t.addEventListener('click', ()=> setActiveTab(t.dataset.target)));

    // Estado inicial: muestra las bebidas sin alcohol
    setActiveTab('tab-bebidas');
})();
