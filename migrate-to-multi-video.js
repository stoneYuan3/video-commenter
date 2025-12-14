require('dotenv').config({ path: './.env.local' });

const mongoose = require('mongoose');

// MongoDB connection helper
async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('Please define MONGODB_URI environment variable');
  }

  if (mongoose.connection.readyState >= 1) {
    return;
  }

  return mongoose.connect(MONGODB_URI);
}

async function migrateVideos() {
  console.log('Starting video migration...');

  // Dynamically import the Video model
  const Video = (await import('./src/models/Video.ts')).default;

  // Find all videos with old structure (has videoSource but no videos array or empty videos array)
  const oldVideos = await Video.find({
    videoSource: { $exists: true },
    $or: [
      { videos: { $exists: false } },
      { videos: { $size: 0 } }
    ]
  });

  console.log(`Found ${oldVideos.length} videos to migrate`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const video of oldVideos) {
    try {
      // Skip if video already has videos array populated
      if (video.videos && video.videos.length > 0) {
        skippedCount++;
        continue;
      }

      // Create video item from old fields
      const videoItem = {
        videoSource: video.videoSource,
        videoId: video.videoId,
        gdriveId: video.gdriveId,
        uploadedVideoUrl: video.uploadedVideoUrl,
        duration: video.duration,
        thumbnail: video.thumbnail,
        order: 0
      };

      // Add to videos array
      video.videos = [videoItem];
      await video.save();

      migratedCount++;
      if (migratedCount % 10 === 0) {
        console.log(`Migrated ${migratedCount}/${oldVideos.length} videos...`);
      }
    } catch (error) {
      console.error(`Failed to migrate video ${video._id}:`, error);
    }
  }

  console.log(`Video migration complete!`);
  console.log(`- Migrated: ${migratedCount} videos`);
  console.log(`- Skipped: ${skippedCount} videos (already migrated)`);
}

async function migrateComments() {
  console.log('\nStarting comment migration...');

  // Dynamically import the Comment model
  const Comment = (await import('./src/models/Comment.ts')).default;

  // Set videoIndex: 0 for all existing comments without it
  const result = await Comment.updateMany(
    { videoIndex: { $exists: false } },
    { $set: { videoIndex: 0 } }
  );

  console.log(`Comment migration complete!`);
  console.log(`- Updated ${result.modifiedCount} comments with videoIndex: 0`);
}

async function migrate() {
  try {
    console.log('===================================');
    console.log('Multi-Video Migration Script');
    console.log('===================================\n');

    await connectDB();
    console.log('Connected to MongoDB\n');

    await migrateVideos();
    await migrateComments();

    console.log('\n===================================');
    console.log('Migration completed successfully!');
    console.log('===================================');
    process.exit(0);
  } catch (error) {
    console.error('\n===================================');
    console.error('Migration failed:', error);
    console.error('===================================');
    process.exit(1);
  }
}

// Run migration
migrate();
