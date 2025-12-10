
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = 'rintyan2951@gmail.com'; // Target email from screenshot
  
  console.log(`Deleting user with email ${email}...`);
  const deleted = await prisma.user.deleteMany({
    where: {
      email: email,
    },
  });
  
  console.log(`Deleted ${deleted.count} user records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
