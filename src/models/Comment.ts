import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IComment extends Document {
  videoId: Types.ObjectId; // Project ID
  videoItemId: Types.ObjectId; // Specific video item ID within the project
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
  videoIndex?: number; // DEPRECATED: Keep for backward compatibility during migration
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
    videoItemId: {
      type: Schema.Types.ObjectId,
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
      // DEPRECATED: Keep for backward compatibility, no longer required
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries (updated to use videoItemId)
CommentSchema.index({ videoId: 1, videoItemId: 1, timestamp: 1 });
CommentSchema.index({ videoId: 1, videoItemId: 1, userId: 1 });
CommentSchema.index({ videoItemId: 1, timestamp: 1 });
CommentSchema.index({ parentCommentId: 1 });

export default mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);
