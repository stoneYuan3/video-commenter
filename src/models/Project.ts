import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * InvitedUser Interface
 * Represents a user who has been invited to collaborate on this project
 */
export interface InvitedUser {
  email: string;           // Email address of the invited user
  accepted: boolean;       // Whether the invitation has been accepted
  userId?: Types.ObjectId; // Set after user accepts invitation and creates/has an account
  invitedAt: Date;         // Timestamp when the invitation was sent
}

/**
 * IProject Interface
 * Represents a project containing multiple videos with shared commenting and collaboration features
 */
export interface IProject extends Document {
  _id: Types.ObjectId;                                      // MongoDB auto-generated unique identifier
  userId: Types.ObjectId;                                   // Owner of this project (references User._id)
  title: string;                                            // Project title/name
  videos: Types.ObjectId[];                                 // Array of Video document references (Video._id)
  permission: 'invited-only' | 'anyone-view' | 'anyone-edit'; // Access control setting
  invitedUsers: InvitedUser[];                              // Users invited to collaborate on this project
  createdAt: Date;                                          // Auto-managed by Mongoose timestamps
  updatedAt: Date;                                          // Auto-managed by Mongoose timestamps
  lastOpenedBy: Map<string, Date>;                          // Track when each user last opened this project
}

/**
 * Project Schema Definition
 * Stores project-level information including title, owner, permissions, and video references
 */
const ProjectSchema = new Schema<IProject>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',                    // References the User collection
      required: true,
      index: true,                    // Index for faster queries by owner
    },
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
    },
    videos: [{
      type: Schema.Types.ObjectId,
      ref: 'Video',                   // References the Video collection
    }],
    permission: {
      type: String,
      enum: ['invited-only', 'anyone-view', 'anyone-edit'],
      default: 'invited-only',        // Default to most restrictive permission
    },
    invitedUsers: {
      type: [{
        email: {
          type: String,
          required: true,
        },
        accepted: {
          type: Boolean,
          default: false,             // Invitations start as pending
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
      default: new Map(),             // Track user activity for sorting/filtering
    },
  },
  {
    timestamps: true,                 // Automatically manage createdAt and updatedAt
  }
);

// Indexes for optimized queries
ProjectSchema.index({ userId: 1, createdAt: -1 }); // Query user's projects sorted by date
ProjectSchema.index({ 'invitedUsers.email': 1 });  // Find projects by invited user email

export default mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
