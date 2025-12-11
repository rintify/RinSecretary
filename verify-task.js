
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Found tasks:', tasks.length);
  tasks.forEach(t => {
      console.log('---');
      console.log('Title:', t.title);
      console.log('Checklist:', t.checklist);
      console.log('Progress:', t.progress);
      console.log('MaxProgress:', t.maxProgress);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
