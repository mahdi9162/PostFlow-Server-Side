import express from 'express';
import cors from 'cors';
import routes from './routes/routes';
import { globalErrorHandler } from './middleware/error.middleware';

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// test route
app.get('/', (req, res) => {
  res.send('PostFlow server running..');
});

// register api routes
app.use('/api', routes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'Not Found' });
});

// global error handler
app.use(globalErrorHandler);

export default app;
