import app from './app';
import { initializeDatabase } from './config/db';
import { env } from './config/env';

const startServer = async () => {
  try {
    await initializeDatabase();
    
    app.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
};

startServer();
