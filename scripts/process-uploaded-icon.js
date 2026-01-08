
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputFile = '/Users/rin/.gemini/antigravity/brain/645fe6d4-b5be-41e0-b80f-b0c772131cb8/uploaded_image_1767875954580.jpg';
const outputDir = path.join(process.cwd(), 'public', 'icons');

async function processIcon() {
  try {
    console.log('Processing uploaded icon...');

    // Resize and convert to PNG
    const image = sharp(inputFile);
    
    // Check metadata
    const metadata = await image.metadata();
    console.log(`Input dimensions: ${metadata.width}x${metadata.height}`);

    // If the user previously wanted a circular crop, we might want to do it here too?
    // But since this is a user-provided image, let's just resize it first.
    // However, since it's a JPG, it definitely doesn't have transparency. 
    // If the user wants transparency, we should probably mask it simply to be safe,
    // assuming the user uploaded a centered circle-ish image. 
    // Let's create a circular mask just in case the corners are white/black.
    // Actually, asking for "transparency" before suggests a circular crop is desired.
    
    const circleSvg = Buffer.from(
      `<svg><circle cx="256" cy="256" r="256" /></svg>`
    );
     // We resize to 512 first to apply mask consistently
    const resizedBuffer = await image
        .resize(512, 512, { fit: 'cover' })
        .composite([{
            input: circleSvg,
            blend: 'dest-in'
        }])
        .png() // Convert to PNG
        .toBuffer();

    // Save as 512x512
    await sharp(resizedBuffer)
        .toFile(path.join(outputDir, 'memo-icon-512x512.png'));

    // Resize for 192x192
    await sharp(resizedBuffer)
        .resize(192, 192)
        .toFile(path.join(outputDir, 'memo-icon-192x192.png'));

    console.log('Icon processing complete!');

  } catch (error) {
    console.error('Error processing icon:', error);
    process.exit(1);
  }
}

processIcon();
