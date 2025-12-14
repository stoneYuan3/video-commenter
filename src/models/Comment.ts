import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IComment extends Document {
  videoId: Types.ObjectId;
  userId: Types.ObjectId;
  text: string;
  timestamp?: number;
  timeRange?: {
    start: number;
    end: number;
  };
  timeString: string;
  color: string;
  parentCommentId?: Types.ObjectId;
  replies?: Types.ObjectId[];
  videoIndex: number; // NEW: Which video in the videos array (0, 1, 2...)
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    videoId: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: [true, 'Comment text is required'],
    },
    timestamp: {
      type: Number,
    },
    timeRange: {
      start: Number,
      end: Number,
    },
    timeString: {
      type: String,
    },
    color: {
      type: String,
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
    },
    replies: [{
      type: Schema.Types.ObjectId,
      ref: 'Comment',
    }],
    videoIndex: {
      type: Number,
      required: true,
      default: 0, // Default to first video for backward compatibility
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries (updated to include videoIndex)
CommentSchema.index({ videoId: 1, videoIndex: 1, timestamp: 1 });
CommentSchema.index({ videoId: 1, videoIndex: 1, userId: 1 });
CommentSchema.index({ parentCommentId: 1 });

export default mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);
