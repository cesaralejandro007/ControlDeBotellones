require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 4000;
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/urbanizacion';

mongoose.connect(MONGO)
  .then(() => {
    console.log('MongoDB conectado');
    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} already in use. If you have another instance running, stop it or set PORT environment variable and re-run.`)
        process.exit(1)
      } else {
        console.error('Server error', err); process.exit(1)
      }
    })
  })
  .catch(err => console.error('MongoDB connection error', err));
