/**
 * EJEMPLO: Integración de Formularios de Entrega con Carrito
 * 
 * Este archivo muestra cómo conectar los datos de los formularios de entrega
 * con el sistema de carrito existente. Puedes usar estas ideas como referencia.
 */

document.addEventListener('order:delivery-ready', async (event) => {
    const deliveryData = event.detail;
    
    console.log('✅ Pedido a domicilio listo para procesar');
    console.log('Datos capturados:', deliveryData);
    
    // Ejemplo 1: Guardar en sessionStorage para usar en otra página
    sessionStorage.setItem('orderType', 'domicilio');
    sessionStorage.setItem('orderData', JSON.stringify(deliveryData));
    
    // Ejemplo 2: Si el carrito tiene una función para capturar datos
    if (window.DeliveryForm && window.Cart) {
        // Asignar datos al carrito
        window.Cart.setDeliveryInfo(deliveryData);
    }
    
    // Ejemplo 3: Enviar a tu servidor
    try {
        const response = await fetch('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...deliveryData,
                items: window.Cart?.getItems?.() || [], // Si el carrito expone getItems()
                timestamp: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Pedido guardado en servidor:', result);
            // Aquí puedes redirigir a una página de confirmación
            // window.location.href = '/confirmacion.html';
        } else {
            console.error('❌ Error al guardar pedido:', response.statusText);
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
    }
});

document.addEventListener('order:pickup-ready', async (event) => {
    const pickupData = event.detail;
    
    console.log('✅ Pedido para recoger listo para procesar');
    console.log('Datos capturados:', pickupData);
    
    // Ejemplo 1: Guardar en sessionStorage
    sessionStorage.setItem('orderType', 'pickup');
    sessionStorage.setItem('orderData', JSON.stringify(pickupData));
    
    // Ejemplo 2: Si el carrito tiene una función para capturar datos
    if (window.DeliveryForm && window.Cart) {
        window.Cart.setPickupInfo(pickupData);
    }
    
    // Ejemplo 3: Enviar a tu servidor
    try {
        const response = await fetch('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...pickupData,
                items: window.Cart?.getItems?.() || [],
                timestamp: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Pedido guardado en servidor:', result);
            // window.location.href = '/confirmacion.html';
        } else {
            console.error('❌ Error al guardar pedido:', response.statusText);
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
    }
});

/**
 * SCRIPT DE PRUEBA: Ejecuta esto en la consola del navegador para simular el flujo
 */
window.testDeliveryForm = () => {
    console.log('🧪 Iniciando prueba de formulario de domicilio...');
    
    // Usar los refs del módulo
    const form = document.getElementById('form-domicilio');
    
    if (!form) {
        console.error('❌ Formulario no encontrado');
        return;
    }
    
    // Simular datos
    document.getElementById('delivery-name').value = 'Juan García López';
    document.getElementById('delivery-phone').value = '2221234567';
    document.getElementById('delivery-zone').value = 'Tepeaca';
    document.getElementById('delivery-address').value = 'Calle Principal 123';
    document.getElementById('delivery-reference').value = 'Próximo al supermercado';
    
    // Validar
    const isValid = window.DeliveryForm.validateDeliveryForm();
    console.log('✅ Formulario válido:', isValid);
    
    if (isValid) {
        const data = window.DeliveryForm.getDeliveryData();
        console.log('📦 Datos a enviar:', data);
    }
};

window.testPickupForm = () => {
    console.log('🧪 Iniciando prueba de formulario de recogida...');
    
    const form = document.getElementById('form-sucursal');
    
    if (!form) {
        console.error('❌ Formulario no encontrado');
        return;
    }
    
    // Simular datos
    document.getElementById('pickup-name').value = 'María López';
    document.getElementById('pickup-phone').value = '5552345678';
    document.getElementById('pickup-branch').value = 'tepeaca';
    
    // Validar
    const isValid = window.DeliveryForm.validatePickupForm();
    console.log('✅ Formulario válido:', isValid);
    
    if (isValid) {
        const data = window.DeliveryForm.getPickupData();
        console.log('📦 Datos a enviar:', data);
    }
};

console.log('💡 Usa estos comandos para probar:');
console.log('  - testDeliveryForm()  → Prueba el formulario de domicilio');
console.log('  - testPickupForm()    → Prueba el formulario de recogida');
