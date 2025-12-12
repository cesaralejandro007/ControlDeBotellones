Instrucciones rápidas (PowerShell):

1) Instalar dependencias frontend
```powershell
cd .\client
npm install
```

2) Ejecutar cliente (desarrollo)
```powershell
npm run dev
```

El cliente asume que el backend corre en `http://localhost:4000`.
Puedes registrarte en `/register` y luego iniciar sesión en `/login`.

Notas sobre Inventario:
- Categorías estándar: `Llenado Tanque` (litros), `Botellones` (unidades), `Artículos de limpieza`.
- Para recargar el tanque del local, crea un movimiento de inventario con el producto de categoría `Llenado Tanque` y `type: in` indicando litros cargados.
- En la tabla de Inventario se mostrará el número aproximado de botellones que se pueden llenar (20 L por botellón) y un medidor de nivel con estado (Ok / Medio / Bajo).

Notas útiles:
- La página `Dashboard` permite cambiar el rango de meses (3/6/12) y solicita al backend `/api/reports/summary?months=N`.
- La página `Usuarios` (solo admins) soporta paginación y búsqueda (`?search=`) y usa confirmaciones bonitas (SweetAlert2).
- Asegúrate de instalar dependencias (incluyendo Highcharts) con `npm install` antes de ejecutar.
