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
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
CommentSchema.index({ videoId: 1, timestamp: 1 });
CommentSchema.index({ videoId: 1, userId: 1 });

export default mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);
