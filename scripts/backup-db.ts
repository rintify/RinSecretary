import fs from 'fs';
import path from 'path';

// Load env if needed (assuming dotenv/config is loaded via runner or env is already set)
// import 'dotenv/config'; 

const ADMIN_WEBHOOK = process.env.ADMIN_DISCORD_WEBHOOK;
const DB_URL = process.env.DATABASE_URL;

async function backupDatabase() {
    if (!ADMIN_WEBHOOK) {
        console.error("ADMIN_DISCORD_WEBHOOK is not set.");
        process.exit(1);
    }

    if (!DB_URL || !DB_URL.startsWith("file:")) {
        console.error("DATABASE_URL must be a file path (start with file:) for this simple backup script.");
        console.error("Current URL:", DB_URL);
        process.exit(1);
    }

    // Extract file path
    // file:./dev.db -> ./dev.db
    let dbPath = DB_URL.replace("file:", "");
    dbPath = path.resolve(process.cwd(), dbPath);

    if (!fs.existsSync(dbPath)) {
        console.error("Database file not found at:", dbPath);
        process.exit(1);
    }

    console.log(`Backing up database from ${dbPath}...`);
    
    const fileStream = fs.readFileSync(dbPath);
    const blob = new Blob([fileStream]);
    
    const formData = new FormData();
    formData.append('file', blob, 'backup.db');
    formData.append('content', `📦 **Database Backup** - ${new Date().toLocaleString('ja-JP')}`);

    try {
        const res = await fetch(ADMIN_WEBHOOK, {
            method: 'POST',
            body: formData,
        });

        if (res.ok) {
            console.log("Database backup sent successfully!");
        } else {
            console.error("Failed to send backup:", res.status, res.statusText);
            const text = await res.text();
            console.error("Response:", text);
            process.exit(1);
        }
    } catch (e) {
        console.error("Error sending backup:", e);
        process.exit(1);
    }
}

backupDatabase();
