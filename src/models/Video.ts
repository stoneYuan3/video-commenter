import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * IVideo Interface
 * Represents a single video within a project
 * Videos are referenced by Projects and can have comments attached to them
 */
export interface IVideo extends Document {
  _id: Types.ObjectId;          // MongoDB auto-generated unique identifier
  videoTitle: string;           // Title of the video (fetched from YouTube or user-provided)
  videoSource: string;          // YouTube URL or path to uploaded file
  thumbnail: string;            // YouTube thumbnail URL or path to generated thumbnail
  duration?: number;            // Video duration in seconds (optional)
  createdAt: Date;              // Auto-managed by Mongoose timestamps
  updatedAt: Date;              // Auto-managed by Mongoose timestamps
}

/**
 * Video Schema Definition
 * Simplified structure - videos are standalone documents referenced by Projects
 * All project-level data (permissions, invitations, ownership) is stored in Project model
 */
const VideoSchema = new Schema<IVideo>(
  {
    videoTitle: {
      type: String,
      required: [true, 'Video title is required'],
      trim: true,
    },
    videoSource: {
      type: String,
      required: [true, 'Video source is required'],
      // This can be:
      // - YouTube URL: "https://www.youtube.com/watch?v=..."
      // - YouTube video ID: "dQw4w9WgXcQ"
      // - Upload path: "/uploads/videos/filename.mp4"
    },
    thumbnail: {
      type: String,
      required: [true, 'Thumbnail is required'],
      // This can be:
      // - YouTube thumbnail: "https://img.youtube.com/vi/{videoId}/mqdefault.jpg"
      // - Upload thumbnail: "/uploads/thumbnails/filename.jpg"
    },
    duration: {
      type: Number,
      // Duration in seconds - optional as it may not always be available
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// Index for faster queries
VideoSchema.index({ createdAt: -1 }); // Sort videos by creation date

export default mongoose.models.Video || mongoose.model<IVideo>('Video', VideoSchema);
