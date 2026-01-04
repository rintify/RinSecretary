import { PrismaClient } from '@prisma/client';
import { generateDailyMailSummary } from '../src/lib/mail-scheduler-actions';

const prisma = new PrismaClient();

async function runTest() {
    console.log('--- Mail Summary Test Trigger ---');
    const now = new Date();
    console.log('Current Time:', now.toLocaleString('ja-JP'));

    try {
        // Find users with mail summary configured
        const users = await prisma.user.findMany({
            where: {
                mailSummaryModelId: { not: null }
            }
        });

        if (users.length === 0) {
            console.log('No users found with mail summary configured.');
            return;
        }

        console.log(`Found ${users.length} users. Starting generation...`);

        for (const user of users) {
            console.log(`\nUser: ${user.email} (${user.id})`);
            // This will generate cards for the range: (Yesterday 18:30) to (Today 18:30)
            // Even if it's currently before 18:30, it will fetch up to "now".
            await generateDailyMailSummary(user.id, now);
            console.log(`Done for user ${user.id}`);
        }

        console.log('\n--- Test Trigger Finished ---');
        console.log('Open /mail-summaries to see the results.');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
