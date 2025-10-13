import mongoose, { Schema, Document, Types } from 'mongoose';

export interface InvitedUser {
  email: string;
  accepted: boolean;
  userId?: Types.ObjectId; // Only set after user accepts and has account
  invitedAt: Date;
}

export interface IVideo extends Document {
  userId: Types.ObjectId;
  title: string;
  videoSource: 'youtube' | 'upload' | 'gdrive';
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
}

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
    videoSource: {
      type: String,
      enum: ['youtube', 'upload', 'gdrive'],
      required: true,
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

export default mongoose.models.Video || mongoose.model<IVideo>('Video', VideoSchema);
