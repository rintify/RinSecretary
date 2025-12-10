
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Target user ID from logs: cmizqwamp0000wkv6nhirf9b5
  const userId = 'cmizqwamp0000wkv6nhirf9b5';
  
  console.log(`Deleting accounts for user ${userId}...`);
  const deleted = await prisma.account.deleteMany({
    where: {
      userId: userId,
    },
  });
  
  console.log(`Deleted ${deleted.count} account records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
