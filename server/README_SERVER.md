Instrucciones rápidas (PowerShell):

1) Instalar dependencias backend
```powershell
cd .\server
npm install
# crear .env con MONGO_URI y JWT_SECRET
copy .env.example .env
notepad .env
```

2) Ejecutar servidor (desarrollo)
```powershell
npm run dev
```

3) Smoke test (comprobación rápida)
```powershell
npm run smoke
```

3.b) Smoke test de tanques (flujo: recarga → entrega → resumen)
```powershell
# Opción 1: pasar token directamente
$env:ADMIN_TOKEN = "<tu_token_admin>"; npm run smoke:tanks

# Opción 2: pasar credenciales admin (login)
$env:ADMIN_EMAIL = "admin@example.com"; $env:ADMIN_PASSWORD = "secreto"; npm run smoke:tanks
```

API endpoints disponibles:
- GET `/api/houses` - listar casas
- POST `/api/houses` - crear casa
- GET `/api/houses/:id` - obtener casa
 - GET `/api/houses/:id/detail` - detalle casa (pagos, entregas, balance)

- GET `/api/payments` - listar pagos
- POST `/api/payments` - registrar pago

- GET `/api/inventory` - listar productos
- POST `/api/inventory` - crear producto
 - GET `/api/inventory/tanks/summary` - resumen de tanques con pricePerFill y fillable
 - POST `/api/inventory/tanks` - crear tanque (admin). Crea el producto y el registro Tank.
 - PUT `/api/inventory/tanks/:tankId` - actualizar precio por llenado / litros por botellón
 - POST `/api/inventory/tanks/:tankId/recharge` - recargar litros (admin)
 - POST `/api/inventory/tanks/:tankId/fill` - llenar botellones desde tanque (admin) [body: { count, house, usedPrepaid }]

- Movimientos de inventario:
	- GET `/api/inventory/movements` - listar movimientos (protegido)
	- POST `/api/inventory/movements` - crear movimiento (admin)

- Entregas:
	- GET `/api/deliveries` - listar entregas (protegido)
	- GET `/api/deliveries/house/:houseId` - entregas de una casa
	- POST `/api/deliveries` - registrar entrega (usar `usedPrepaid: true` si se consume anticipo)

- Pagos:
	- GET `/api/payments/balance/house/:houseId` - balance de anticipos (prepaid - usados)

	Reportes:
	- GET `/api/reports/summary?months=6` - Resumen para N meses (por defecto 6). Devuelve pagos por mes, entregas por mes e inventario por categoría.

	Usuarios:
	- GET `/api/users?page=1&limit=20&search=texto` - listar usuarios (admin). Soporta `search` para filtrar por nombre o email.
	- PUT `/api/users/:id/role` - cambiar rol (admin)
	- DELETE `/api/users/:id` - eliminar usuario (admin)

Roles y flujo de cobro / deudas:
- El sistema está pensado para que haya **un administrador** que registre entregas y pagos. Otros usuarios pueden tener rol `user` y usar la app en modo consulta.
- Para registrar entregas y gestionar cobros se requiere rol `admin`.

Comportamiento de deudas:
- Si se registra una entrega con `usedPrepaid: true`, la entrega consume botellones prepagados (si hay saldo) y **no** genera deuda monetaria.
- Si se registra una entrega con `usedPrepaid: false`, el backend crea automáticamente un `Payment` **pendiente** (`confirmed: false`) por el importe estimado (cantidad * precio del producto 'Botellones' en inventario). Esto representa una deuda que deberá cobrarse.
- El administrador puede confirmar un pago pendiente con `PUT /api/payments/:id/confirm` (esto marca `confirmed: true` y reduce la deuda calculada).

Endpoints relevantes adicionales:
- `GET /api/houses/:id/debt` - devuelve detalle de deuda (total entregado, pagos confirmados, pagos pendientes y monto pendiente).
- `POST /api/houses/:id/pay` - registrar un pago manual (admin) para liquidar/dejar abonos; devuelve `pendingAmount` actualizado.

Ventas y entregas:
- Las entregas a casa ya no descuentan inventario (son operaciones de la logística del local). Al registrar una entrega sin usar anticipo, se crea una deuda pendiente para la casa.
- Las ventas al público (venta de botellón suelto) se registran con `POST /api/sales` y SÍ descuentan inventario.

Endpoint de ventas:
- POST `/api/sales` - { productId, quantity, amount, notes } (admin). Descuenta inventario, registra `Sale` y crea movimiento de inventario.
 - POST `/api/sales` - { productId, quantity, amount, notes } (admin). Descuenta inventario, registra `Sale` y crea movimiento de inventario. (Usar para ventas de botellones físicos, no para recargas de tanque)

Tanques de agua:
- Para manejar un tanque de agua (capacidad en litros) crea un producto con `unit: 'litro'` y asigna `capacity` (ej. 1000 litros). El campo `quantity` representa litros actuales en el tanque.
- El sistema mostrará en el inventario cuántos botellones aproximados se pueden llenar (cada botellón = 20 litros) y un medidor de nivel (verde >=70%, amarillo 30-69%, rojo <30%).
 - Las recargas al tanque se registran como movimientos de inventario (entradas en litros) y aumentan `quantity` del producto tanque.
 - Al registrar una entrega a una casa, el sistema consumirá litros del tanque equivalentes a `count * 20` litros (20 L por botellón). Si no hay litros suficientes, la entrega será rechazada.
Categorías estándar:
- `Llenado Tanque` (unidad: litros) — destinada al tanque de agua del local; usa `capacity` (litros) y `quantity` refleja litros actuales. Para recargar el tanque usa `POST /api/inventory/movements` con `product` (tanque), `type: 'in'` y `quantity` en litros.
- `Botellones` (unidad: unidad) — botellones físicos en stock (contador de unidades). Usar ventas para descontar stock.
- `Artículos de limpieza` — otros artículos con cantidad manual.

Nota: para que las deudas monetarias se calculen correctamente, registra en inventario un producto de categoría `Botellones` (o `type: 'botellon'`) con su `price`.

	Usuarios:
	- GET `/api/users?page=1&limit=20` - listar usuarios (admin)
	- PUT `/api/users/:id/role` - cambiar rol (admin)
	- DELETE `/api/users/:id` - eliminar usuario (admin)

- POST `/api/auth/register` - registrar usuario
- POST `/api/auth/login` - login

Docker:
 - Levantar Mongo + servidor con:
```powershell
docker-compose up --build
```
 
 Notificaciones (Slack webhook):
 - Puedes configurar `SLACK_WEBHOOK_URL` en tu `env` para que el servidor envíe notificaciones cuando un tanque entre en nivel bajo. Es opcional y puede quedar vacío si no lo usas.

Puerto en uso al iniciar (EADDRINUSE):
- Si ves un error similar a "Port 4000 already in use" al ejecutar `npm run dev`, puede que tengas otro servidor usando el puerto 4000. En Windows puedes encontrar y cerrar el proceso así:
```powershell
# encontrar PID que usa el puerto 4000
netstat -ano | findstr ":4000"
# matar proceso (reemplaza <PID> por el número reportado)
taskkill /PID <PID> /F
```
Alternativamente, puedes iniciar el servidor en otro puerto:
```powershell
$env:PORT=4001; npm run dev
```


Notas:
 - El primer usuario que registres recibirá rol `admin` automáticamente.

