import express from 'express';
import { errorHandler } from './middlewares/errorHandler';
import router from './routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', router);

app.use(errorHandler);

export default app;
