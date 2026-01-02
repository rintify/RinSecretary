
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'user@example.com'; // Replace with actual user email if known or fetch first user
  // Or just fetch all tasks deadline < now
  
  const now = new Date();
  console.log('Current Server Time:', now.toString());

  const users = await prisma.user.findMany();
  console.log('Users found:', users.length);

  for (const user of users) {
      console.log(`Checking user: ${user.email}`);
      const tasks = await prisma.task.findMany({
        where: {
            userId: user.id,
            deadline: { lt: now }
        }
      });
      
      console.log(`Found ${tasks.length} tasks with deadline < now`);
      
      tasks.forEach(t => {
          const p = t.progress || 0;
          const mp = t.maxProgress || 100;
          const isExpired = p < mp;
          console.log(`- Task: "${t.title}" (ID: ${t.id})`);
          console.log(`  Deadline: ${t.deadline}`);
          console.log(`  Progress: ${p}/${mp} -> Is Expired? ${isExpired}`);
      });
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
