import express from 'express';
import apiRoutes from './routes/api';
import { syncDatabase } from './models';
import http from 'http';

const app = express();

// Middleware
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// Create HTTP server
const server = http.createServer(app);

// Sync database and start server function
export const startServer = async () => {
  try {
    await syncDatabase();
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
      console.log(`Express server is running on port ${port}`);
    });
  } catch (error) {
    console.error('Unable to sync database:', error);
    process.exit(1);
  }
};

export { app, server };
