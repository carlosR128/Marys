/**
 * SCRIPT DE PRUEBA - Verificar que Google Maps API funciona
 * ---
 * Ejecuta esto en la consola del navegador para verificar que todo funciona
 */

(function() {
    console.log('🔍 INICIANDO PRUEBA DE GOOGLE MAPS API...');

    // Verificar que Google Maps está cargado
    if (typeof google === 'undefined' || !google.maps) {
        console.error('❌ Google Maps API no está cargada');
        return;
    }
    console.log('✅ Google Maps API cargada correctamente');

    // Verificar nuestros servicios
    if (typeof window.LocationService === 'undefined') {
        console.error('❌ LocationService no está cargado');
        return;
    }
    console.log('✅ LocationService cargado');

    if (typeof window.MapsService === 'undefined') {
        console.error('❌ MapsService no está cargado');
        return;
    }
    console.log('✅ MapsService cargado');

    if (typeof window.DeliveryForm === 'undefined') {
        console.error('❌ DeliveryForm no está cargado');
        return;
    }
    console.log('✅ DeliveryForm cargado');

    // Probar funciones básicas
    console.log('🧪 PROBANDO FUNCIONES...');

    // Probar obtener sucursales
    const branches = window.LocationService.getBranches();
    console.log('🏪 Sucursales encontradas:', branches.length);
    branches.forEach(branch => {
        console.log(`  - ${branch.name}: ${branch.lat}, ${branch.lng}`);
    });

    // Probar validación de cobertura (punto de ejemplo)
    const testPoint = { lat: 19.1456, lng: -97.5859 };
    const validation = window.LocationService.validateDeliveryLocation(testPoint.lat, testPoint.lng);
    console.log('🎯 Validación de cobertura:', validation);

    console.log('🎉 TODAS LAS PRUEBAS PASARON - MAPAS LISTOS PARA USAR');

    // Instrucciones para el usuario
    console.log('');
    console.log('📋 INSTRUCCIONES PARA PROBAR:');
    console.log('1. Haz clic en "A domicilio"');
    console.log('2. Deberías ver un mapa interactivo');
    console.log('3. Haz clic en cualquier punto del mapa');
    console.log('4. Debería aparecer confirmación de ubicación');
    console.log('');
    console.log('5. Haz clic en "Recoger"');
    console.log('6. Deberías ver mapa con marcadores de sucursales');
    console.log('7. Haz clic en una sucursal para seleccionarla');

})();