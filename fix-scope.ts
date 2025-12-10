
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  const deleted = await prisma.account.deleteMany({
    where: { provider: 'google' }
  });
  console.log(`Deleted ${deleted.count} google account records. Please log in again.`);
}

fix()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
