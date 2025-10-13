/**
 * Migration Script: Convert invitedUsers from ObjectId references to email addresses
 *
 * This script will:
 * 1. Find all videos that have invitedUsers with ObjectIds
 * 2. Look up the email for each ObjectId
 * 3. Replace the ObjectId array with email array
 * 4. Save the updated video
 *
 * Run this script once after deploying the code changes.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load MongoDB URI from .env.local file
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.local');

  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      const value = valueParts.join('=').trim();
      if (key.trim() === 'MONGODB_URI') {
        return value.replace(/^["']|["']$/g, ''); // Remove quotes if present
      }
    }
  }

  return null;
}

const MONGODB_URI = loadEnvFile();

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env.local file');
  process.exit(1);
}

// Define schemas (temporary for migration)
const UserSchema = new mongoose.Schema({
  email: String,
  name: String,
});

const VideoSchema = new mongoose.Schema({
  title: String,
  invitedUsers: [mongoose.Schema.Types.Mixed], // Can be ObjectId or String
  userId: mongoose.Schema.Types.ObjectId,
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Video = mongoose.models.Video || mongoose.model('Video', VideoSchema);

async function migrateInvitedUsers() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      dbName: 'VideoCommenter',
      bufferCommands: false,
    });
    console.log('✅ Connected to MongoDB');

    // Find all videos
    console.log('\n📊 Fetching all videos...');
    const videos = await Video.find({});
    console.log(`Found ${videos.length} videos`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const video of videos) {
      try {
        // Check if invitedUsers needs migration
        if (!video.invitedUsers || video.invitedUsers.length === 0) {
          console.log(`⏭️  Skipping "${video.title}" - no invited users`);
          skippedCount++;
          continue;
        }

        // Check if already migrated (first element is a string, not ObjectId)
        const firstInvitedUser = video.invitedUsers[0];
        if (typeof firstInvitedUser === 'string' && firstInvitedUser.includes('@')) {
          console.log(`⏭️  Skipping "${video.title}" - already migrated`);
          skippedCount++;
          continue;
        }

        console.log(`\n🔄 Migrating "${video.title}"...`);
        console.log(`   Current invitedUsers (${video.invitedUsers.length} users):`, video.invitedUsers);

        // Convert ObjectIds to emails
        const emailArray = [];
        for (const userId of video.invitedUsers) {
          try {
            // Check if it's a valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(userId)) {
              console.log(`   ⚠️  Invalid ObjectId: ${userId}, skipping`);
              continue;
            }

            const user = await User.findById(userId);
            if (user && user.email) {
              emailArray.push(user.email);
              console.log(`   ✓ Converted ${userId} → ${user.email}`);
            } else {
              console.log(`   ⚠️  User not found for ObjectId: ${userId}, skipping`);
            }
          } catch (userError) {
            console.log(`   ⚠️  Error looking up user ${userId}:`, userError.message);
          }
        }

        // Update the video with email array
        video.invitedUsers = emailArray;
        await video.save();

        console.log(`   ✅ Migrated "${video.title}" - ${emailArray.length} emails saved`);
        console.log(`   New invitedUsers:`, emailArray);
        migratedCount++;

      } catch (videoError) {
        console.error(`   ❌ Error migrating video "${video.title}":`, videoError.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${migratedCount} videos`);
    console.log(`⏭️  Skipped (no users or already migrated): ${skippedCount} videos`);
    console.log(`❌ Errors: ${errorCount} videos`);
    console.log(`📊 Total videos processed: ${videos.length}`);
    console.log('='.repeat(60));

    console.log('\n✅ Migration completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the migration
console.log('🚀 Starting invitedUsers migration...');
console.log('='.repeat(60));
migrateInvitedUsers()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
