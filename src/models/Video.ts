import mongoose, { Schema, Document, Types } from 'mongoose';

export interface InvitedUser {
  email: string;
  accepted: boolean;
  userId?: Types.ObjectId; // Only set after user accepts and has account
  invitedAt: Date;
}

export interface IVideoItem {
  _id?: Types.ObjectId; // Optional for backward compatibility with legacy videos
  videoSource: 'youtube' | 'upload' | 'gdrive';
  videoId?: string;
  gdriveId?: string;
  uploadedVideoUrl?: string;
  duration?: number;
  thumbnail?: string;
  order: number;
}

export interface IVideo extends Document {
  userId: Types.ObjectId;
  title: string;

  // NEW: Array of videos
  videos: IVideoItem[];

  // LEGACY: Keep for backward compatibility during migration
  videoSource?: 'youtube' | 'upload' | 'gdrive';
  videoId?: string; // For YouTube
  gdriveId?: string; // For Google Drive
  uploadedVideoUrl?: string; // For uploaded videos

  thumbnail?: string;
  duration: number;
  permission: 'invited-only' | 'anyone-view' | 'anyone-edit';
  invitedUsers: InvitedUser[]; // Array of invited user objects
  lastOpenedBy: Map<string, Date>; // Map of userId -> last opened timestamp
  createdAt: Date;
  updatedAt: Date;
  getCurrentVideo(index?: number): IVideoItem | null;
}

// Define subdocument schema for video items
const VideoItemSchema = new Schema<IVideoItem>({
  videoSource: {
    type: String,
    enum: ['youtube', 'upload', 'gdrive'],
    required: true,
  },
  videoId: { type: String },
  gdriveId: { type: String },
  uploadedVideoUrl: { type: String },
  duration: { type: Number },
  thumbnail: { type: String },
  order: {
    type: Number,
    required: true,
    default: 0,
  }
}, { _id: true });

const VideoSchema = new Schema<IVideo>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },

    // NEW: Array of videos
    videos: {
      type: [VideoItemSchema],
      default: [],
    },

    // LEGACY FIELDS: Keep for backward compatibility (no longer required)
    videoSource: {
      type: String,
      enum: ['youtube', 'upload', 'gdrive'],
    },
    videoId: {
      type: String, // YouTube video ID
    },
    gdriveId: {
      type: String, // Google Drive file ID
    },
    uploadedVideoUrl: {
      type: String, // URL or path to uploaded video
    },
    thumbnail: {
      type: String, // Thumbnail URL
    },
    duration: {
      type: Number,
      default: 0,
    },
    permission: {
      type: String,
      enum: ['invited-only', 'anyone-view', 'anyone-edit'],
      default: 'invited-only',
    },
    invitedUsers: {
      type: [{
        email: {
          type: String,
          required: true,
        },
        accepted: {
          type: Boolean,
          default: false,
        },
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        invitedAt: {
          type: Date,
          default: Date.now,
        },
      }],
      default: [],
    },
    lastOpenedBy: {
      type: Map,
      of: Date,
      default: new Map(),
    },
  },
  {
    timestamps: true,
  }
);

// Add helper method to get video data (supports both old and new structure)
VideoSchema.methods.getCurrentVideo = function(index: number = 0): IVideoItem | null {
  // Try new structure first
  if (this.videos && this.videos.length > index) {
    return this.videos[index];
  }

  // Fallback to old structure
  if (this.videoSource) {
    return {
      videoSource: this.videoSource,
      videoId: this.videoId,
      gdriveId: this.gdriveId,
      uploadedVideoUrl: this.uploadedVideoUrl,
      duration: this.duration,
      thumbnail: this.thumbnail,
      order: 0
    };
  }

  return null;
};

export default mongoose.models.Video || mongoose.model<IVideo>('Video', VideoSchema);
