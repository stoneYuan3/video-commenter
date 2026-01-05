import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * IComment Interface
 * Represents a comment that can be attached to either a Project (general comment) or a Video (timestamp comment)
 */
export interface IComment extends Document {
  _id: Types.ObjectId;               // MongoDB auto-generated unique identifier
  commentedTo: Types.ObjectId;       // ID of the Project or Video this comment belongs to
  commentedToType: 'project' | 'video'; // Type of entity this comment is attached to
  userId: Types.ObjectId;            // User who created this comment (references User._id)
  content: string;                   // The actual comment text

  // Timestamp fields - ONLY used when commentedToType === 'video'
  timestamp?: number;                // Specific timestamp in video (in seconds)
  timeRange?: {                      // Time range in video (start and end in seconds)
    start: number;
    end: number;
  };
  timeString?: string;               // Human-readable time display (e.g., "01:23" or "01:23 - 01:45")
  color?: string;                    // Color for timeline visualization

  // Threading fields - for nested replies
  parentComment?: Types.ObjectId;    // If this is a reply, references the parent Comment._id
  replies?: Types.ObjectId[];        // Array of child Comment._id references

  createdAt: Date;                   // Auto-managed by Mongoose timestamps
  updatedAt: Date;                   // Auto-managed by Mongoose timestamps
}

/**
 * Comment Schema Definition
 * Supports two types of comments:
 * 1. Project-level comments: General discussion about the entire project (no timestamp)
 * 2. Video-level comments: Comments tied to specific timestamps or time ranges in a video
 */
const CommentSchema = new Schema<IComment>(
  {
    commentedTo: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,               // Index for faster queries by target entity
      // This references either a Project._id or a Video._id
    },
    commentedToType: {
      type: String,
      enum: ['project', 'video'],
      required: true,
      index: true,               // Index for filtering by comment type
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,               // Index for queries by user
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
    },

    // Video-specific fields (optional - only for video comments)
    timestamp: {
      type: Number,
      // Timestamp in seconds - used for point-in-time comments
      // Example: 125.5 means 2 minutes and 5.5 seconds into the video
    },
    timeRange: {
      start: Number,
      end: Number,
      // Used for comments that span a range of time in the video
      // Example: { start: 10, end: 25 } means from 0:10 to 0:25
    },
    timeString: {
      type: String,
      // Human-readable representation of the time
      // Examples: "02:15", "02:15 - 02:30"
    },
    color: {
      type: String,
      // Hex color for timeline visualization
      // Example: "#ef4444" (red)
    },

    // Threading fields
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      // If set, this comment is a reply to another comment
    },
    replies: [{
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      // Array of replies to this comment
    }],
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// Compound indexes for optimized queries
CommentSchema.index({ commentedTo: 1, commentedToType: 1, timestamp: 1 }); // Get video comments sorted by time
CommentSchema.index({ commentedTo: 1, commentedToType: 1, createdAt: 1 }); // Get project comments sorted by date
CommentSchema.index({ parentComment: 1 }); // Find replies to a specific comment
CommentSchema.index({ userId: 1, createdAt: -1 }); // Get user's comments sorted by date

export default mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);
