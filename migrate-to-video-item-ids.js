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

async function migrateVideoItems() {
  console.log('Starting video item migration...');

  // Access the Video collection directly without importing TypeScript models
  const Video = mongoose.connection.collection('videos');
  console.log(Video)
  // Find all videos
  const videos = await Video.find({}).toArray();

  console.log(`Found ${videos.length} videos to process`);

  // Debug: Show what we found
  if (videos.length > 0) {
    console.log('Sample video:', JSON.stringify(videos[0], null, 2));
  } else {
    // Check if collection exists and has documents
    const count = await Video.countDocuments();
    console.log(`Total documents in videos collection: ${count}`);
  }

  let processedCount = 0;
  let skippedCount = 0;

  for (const video of videos) {
    try {
      let updatedVideos = [];

      // Case 1: Video already has videos array with _id (already migrated)
      if (video.videos && video.videos.length > 0 && video.videos[0]._id) {
        console.log(`Video ${video._id} already has video item IDs, skipping...`);
        skippedCount++;
        continue;
      }

      // Case 2: Video has videos array but items don't have _id
      if (video.videos && video.videos.length > 0) {
        console.log(`Video ${video._id}: Adding _id to existing video items...`);
        updatedVideos = video.videos.map((item) => ({
          ...item,
          _id: new mongoose.Types.ObjectId() // Generate new ID
        }));
      }
      // Case 3: Legacy video with no videos array - create from old fields
      else if (video.videoSource) {
        console.log(`Video ${video._id}: Migrating from legacy structure...`);
        updatedVideos = [{
          videoSource: video.videoSource,
          videoId: video.videoId,
          gdriveId: video.gdriveId,
          uploadedVideoUrl: video.uploadedVideoUrl,
          duration: video.duration,
          thumbnail: video.thumbnail,
          order: 0,
          _id: new mongoose.Types.ObjectId() // Generate new ID
        }];
      }
      // Case 4: Invalid video - no videos array and no legacy fields
      else {
        console.log(`Video ${video._id} has no video data, skipping...`);
        skippedCount++;
        continue;
      }

      // Update the video document
      await Video.updateOne(
        { _id: video._id },
        { $set: { videos: updatedVideos } }
      );

      // Update the video object in memory for comment migration
      video.videos = updatedVideos;

      processedCount++;

      if (processedCount % 10 === 0) {
        console.log(`Processed ${processedCount}/${videos.length} videos...`);
      }
    } catch (error) {
      console.error(`Failed to migrate video ${video._id}:`, error);
    }
  }

  console.log(`Video item migration complete!`);
  console.log(`- Processed: ${processedCount} videos`);
  console.log(`- Skipped: ${skippedCount} videos`);

  return videos;
}

async function migrateComments(videos) {
  console.log('\nStarting comment migration...');

  // Access the Comment collection directly without importing TypeScript models
  const Comment = mongoose.connection.collection('comments');

  // Find all comments that still use videoIndex (don't have videoItemId)
  const comments = await Comment.find({
    videoItemId: { $exists: false }
  }).toArray();

  console.log(`Found ${comments.length} comments to migrate`);

  let migratedCount = 0;
  let errorCount = 0;

  for (const comment of comments) {
    try {
      // Find the video this comment belongs to
      const video = videos.find(v => v._id.toString() === comment.videoId.toString());

      if (!video) {
        console.error(`Video not found for comment ${comment._id}`);
        errorCount++;
        continue;
      }

      if (!video.videos || video.videos.length === 0) {
        console.error(`Video ${video._id} has no video items for comment ${comment._id}`);
        errorCount++;
        continue;
      }

      // Get the videoIndex (default to 0 if not set)
      const videoIndex = comment.videoIndex !== undefined ? comment.videoIndex : 0;

      if (videoIndex >= video.videos.length) {
        console.error(`Invalid videoIndex ${videoIndex} for comment ${comment._id} (video has ${video.videos.length} items)`);
        errorCount++;
        continue;
      }

      // Get the video item ID at that index
      const videoItem = video.videos[videoIndex];
      const videoItemId = videoItem._id;

      // Update the comment
      await Comment.updateOne(
        { _id: comment._id },
        { $set: { videoItemId: videoItemId } }
      );

      migratedCount++;

      if (migratedCount % 100 === 0) {
        console.log(`Migrated ${migratedCount}/${comments.length} comments...`);
      }
    } catch (error) {
      console.error(`Failed to migrate comment ${comment._id}:`, error);
      errorCount++;
    }
  }

  console.log(`Comment migration complete!`);
  console.log(`- Migrated: ${migratedCount} comments`);
  console.log(`- Errors: ${errorCount} comments`);
}

async function migrate() {
  try {
    console.log('===================================');
    console.log('Video Item ID Migration Script');
    console.log('===================================\n');

    await connectDB();
    console.log('Connected to MongoDB\n');

    // Debug: List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name).join(', '));
    console.log('');

    // First migrate video items to ensure they have IDs
    const videos = await migrateVideoItems();

    // Then migrate comments to use videoItemId instead of videoIndex
    await migrateComments(videos);

    console.log('\n===================================');
    console.log('Migration completed successfully!');
    console.log('===================================');
    console.log('\nNOTE: The videoIndex field is kept in comments for backward compatibility.');
    console.log('You can remove it in a future migration after confirming everything works.');
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
