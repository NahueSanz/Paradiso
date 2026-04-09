import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/errorHandler';
import router from './routes';

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://paradiso-nine.vercel.app',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-club-id',"*"],
}));

app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', router);

app.use(errorHandler);

export default app;
