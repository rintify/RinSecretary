
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found');
    return;
  }

  console.log('Creating task for user:', user.email);

  const checklistPayload = [
      { text: "Item 1", checked: true },
      { text: "Item 2", checked: false }
  ];

  const task = await prisma.task.create({
    data: {
      title: "Script Created Checklist Task",
      userId: user.id,
      checklist: JSON.stringify(checklistPayload),
      progress: 50,
      maxProgress: 100
    }
  });

  console.log('Created task:', task.id);
  console.log('Checklist stored:', task.checklist);
  
  // Verify retrieving it
  const fetched = await prisma.task.findUnique({ where: { id: task.id } });
  const parsed = JSON.parse(fetched.checklist);
  console.log('Parsed items:', parsed.length);
  console.log('Item 1 checked:', parsed[0].checked);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
