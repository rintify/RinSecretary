
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.aiConfig.findMany();
  console.log('AI Configs:', JSON.stringify(configs, null, 2));
  
  const users = await prisma.user.findMany({ select: { id: true, aiModel: true, aiProvider: true } });
  console.log('Users:', JSON.stringify(users, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
