# Control de Botellones - MERN

Proyecto inicial para gestionar los botellones de agua en una urbanización (MERN).

Estructura propuesta:
- `/server` - backend Express + MongoDB
- `/client` - frontend React (Vite)

Requisitos:
- Node.js >= 18
- MongoDB (local o Atlas)

Rápido inicio (PowerShell):
```powershell
# Backend
cd .\server
npm install
# crear .env con MONGO_URI
npm run dev

# Frontend
cd ..\client
npm install
npm run dev
```

Siguientes pasos disponibles:
- Añadir autenticación completa (JWT)
- Implementar UI detallada y lógica de deuda/anticipos
- Tests y despliegue
