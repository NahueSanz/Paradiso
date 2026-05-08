import 'dotenv/config';
import app from './app';
import prisma from './lib/prisma';
import { verifySmtp } from './services/emailService';

const PORT = process.env.PORT || 3000;

async function main() {
  await prisma.$connect();
  console.log('Database connected');

  await verifySmtp();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
