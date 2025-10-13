/**
 * Migration Script: Convert invitedUsers to new structure with accepted status
 *
 * This script will:
 * 1. Find all videos that have invitedUsers
 * 2. Convert from old formats (ObjectId or string) to new object structure
 * 3. New structure: { email, accepted, userId, invitedAt }
 * 4. Save the updated video
 *
 * Handles three formats:
 * - ObjectId[] -> Look up email, convert to object
 * - string[] (email) -> Convert to object
 * - object[] (already new format) -> Skip
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

        // Check if already migrated to new object format
        const firstInvitedUser = video.invitedUsers[0];
        if (typeof firstInvitedUser === 'object' && firstInvitedUser.email && firstInvitedUser.hasOwnProperty('accepted')) {
          console.log(`⏭️  Skipping "${video.title}" - already migrated to new format`);
          skippedCount++;
          continue;
        }

        console.log(`\n🔄 Migrating "${video.title}"...`);
        console.log(`   Current invitedUsers (${video.invitedUsers.length} users):`, video.invitedUsers);

        // Convert to new object structure
        const newInvitedUsers = [];

        for (const item of video.invitedUsers) {
          try {
            let email = null;
            let userId = null;

            // Determine format: ObjectId, string (email), or already object
            if (mongoose.Types.ObjectId.isValid(item) && typeof item !== 'string') {
              // Format 1: ObjectId - need to look up email
              console.log(`   📋 Processing ObjectId: ${item}`);
              const user = await User.findById(item);
              if (user && user.email) {
                email = user.email;
                userId = item;
                console.log(`   ✓ Converted ObjectId ${item} → ${email}`);
              } else {
                console.log(`   ⚠️  User not found for ObjectId: ${item}, skipping`);
                continue;
              }
            } else if (typeof item === 'string' && item.includes('@')) {
              // Format 2: String (email)
              console.log(`   📧 Processing email string: ${item}`);
              email = item;
              // Try to find userId for this email
              const user = await User.findOne({ email: item });
              if (user) {
                userId = user._id;
                console.log(`   ✓ Found user ID for ${email}`);
              } else {
                console.log(`   ℹ️  No user found for ${email} (will create account later)`);
              }
            } else {
              console.log(`   ⚠️  Unknown format: ${item}, skipping`);
              continue;
            }

            // Create new object structure
            if (email) {
              newInvitedUsers.push({
                email: email,
                accepted: true, // Assume old invitations were already accepted
                userId: userId || undefined,
                invitedAt: new Date(),
              });
              console.log(`   ✓ Added ${email} (accepted: true)`);
            }
          } catch (itemError) {
            console.log(`   ⚠️  Error processing item ${item}:`, itemError.message);
          }
        }

        // Update the video with new structure
        video.invitedUsers = newInvitedUsers;
        await video.save();

        console.log(`   ✅ Migrated "${video.title}" - ${newInvitedUsers.length} users converted`);
        console.log(`   New invitedUsers structure:`, JSON.stringify(newInvitedUsers, null, 2));
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
