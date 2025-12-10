
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const accounts = await prisma.account.findMany();
  console.log('Accounts found:', accounts.length);
  for (const acc of accounts) {
    console.log(`User: ${acc.userId}, Provider: ${acc.provider}, Scope: ${acc.scope}`);
  }
}

check()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
