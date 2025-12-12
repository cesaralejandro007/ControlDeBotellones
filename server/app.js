const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Simple route
app.get('/', (req, res) => res.send({ ok: true, message: 'API Control Botellones' }));

// Routes (basic CRUD)
app.use('/api/houses', require('./routes/houses'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/inventory/tanks', require('./routes/tanks'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/inventory/movements', require('./routes/inventoryMovements'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));

module.exports = app;
