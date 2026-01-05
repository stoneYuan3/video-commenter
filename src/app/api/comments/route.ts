import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import initializeModels from '@/lib/initModels';
import Comment from '@/models/Comment';
import Project from '@/models/Project';
import Video from '@/models/Video';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/comments?commentedTo={id}&commentedToType={project|video}
 * Retrieves comments for a specific project or video
 *
 * Query Parameters:
 * - commentedTo: ID of the project or video
 * - commentedToType: 'project' or 'video'
 *
 * Returns: Array of top-level comments with populated replies
 */
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);

    await connectDB();
    initializeModels();

    const { searchParams } = new URL(req.url);
    const commentedTo = searchParams.get('commentedTo');
    const commentedToType = searchParams.get('commentedToType');

    // Validate required parameters
    if (!commentedTo) {
      return NextResponse.json({ error: 'commentedTo ID is required' }, { status: 400 });
    }

    if (!commentedToType || !['project', 'video'].includes(commentedToType)) {
      return NextResponse.json(
        { error: 'commentedToType must be either "project" or "video"' },
        { status: 400 }
      );
    }

    // Check permissions based on comment type
    if (commentedToType === 'project') {
      // For project comments, check project permissions
      const project = await Project.findById(commentedTo);

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      // Check if user has permission to view project comments
      const isOwner = user && project.userId.toString() === user.userId;
      const isInvited = user && project.invitedUsers.some((invited: any) =>
        invited.email === user.email && invited.accepted
      );

      if (project.permission === 'invited-only') {
        if (!user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!isOwner && !isInvited) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    } else if (commentedToType === 'video') {
      // For video comments, need to find the project this video belongs to
      const project = await Project.findOne({ videos: commentedTo });

      if (!project) {
        return NextResponse.json({ error: 'Video not found in any project' }, { status: 404 });
      }

      // Check project permissions
      const isOwner = user && project.userId.toString() === user.userId;
      const isInvited = user && project.invitedUsers.some((invited: any) =>
        invited.email === user.email && invited.accepted
      );

      if (project.permission === 'invited-only') {
        if (!user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!isOwner && !isInvited) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    // Fetch comments
    const sortOrder = commentedToType === 'video'
      ? { timestamp: 1, 'timeRange.start': 1 } // Sort video comments by time
      : { createdAt: -1 }; // Sort project comments by newest first

    const comments = await Comment.find({
      commentedTo,
      commentedToType,
      parentComment: { $exists: false } // Only top-level comments
    })
      .populate('userId', 'name email username')
      .populate({
        path: 'replies',
        populate: {
          path: 'userId',
          select: 'name email username'
        }
      })
      .sort(sortOrder);

    return NextResponse.json({ comments }, { status: 200 });
  } catch (error: any) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/comments
 * Creates a new comment (either project-level or video-level)
 *
 * Body:
 * - commentedTo: ID of project or video
 * - commentedToType: 'project' or 'video'
 * - content: Comment text
 * - parentComment: (optional) ID of parent comment if this is a reply
 * - timestamp: (optional, video only) Specific timestamp in seconds
 * - timeRange: (optional, video only) { start: number, end: number }
 * - timeString: (optional, video only) Human-readable time
 * - color: (optional, video only) Color for timeline visualization
 */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    initializeModels();

    const {
      commentedTo,
      commentedToType,
      content,
      parentComment,
      timestamp,
      timeRange,
      timeString,
      color
    } = await req.json();

    // Validate required fields
    if (!commentedTo || !commentedToType || !content) {
      return NextResponse.json(
        { error: 'commentedTo, commentedToType, and content are required' },
        { status: 400 }
      );
    }

    if (!['project', 'video'].includes(commentedToType)) {
      return NextResponse.json(
        { error: 'commentedToType must be either "project" or "video"' },
        { status: 400 }
      );
    }

    // For video comments (not replies), require timeString and color
    if (commentedToType === 'video' && !parentComment) {
      if (!timeString || !color) {
        return NextResponse.json(
          { error: 'timeString and color are required for video comments' },
          { status: 400 }
        );
      }
    }

    // Check permissions before creating comment
    let project;
    if (commentedToType === 'project') {
      project = await Project.findById(commentedTo);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    } else {
      // Find project that contains this video
      project = await Project.findOne({ videos: commentedTo });
      if (!project) {
        return NextResponse.json({ error: 'Video not found in any project' }, { status: 404 });
      }
    }

    // Verify user can comment
    const isOwner = project.userId.toString() === user.userId;
    const isInvited = project.invitedUsers.some((invited: any) =>
      invited.email === user.email && invited.accepted
    );
    const canComment = isOwner || isInvited || project.permission === 'anyone-edit';

    if (!canComment) {
      return NextResponse.json(
        { error: 'You do not have permission to comment on this project' },
        { status: 403 }
      );
    }

    // Create comment document
    const commentData: any = {
      commentedTo,
      commentedToType,
      userId: user.userId,
      content,
      parentComment,
    };

    // Add video-specific fields if this is a video comment
    if (commentedToType === 'video') {
      if (timestamp !== undefined) commentData.timestamp = timestamp;
      if (timeRange) commentData.timeRange = timeRange;
      if (timeString) commentData.timeString = timeString;
      if (color) commentData.color = color;
    }

    const comment = await Comment.create(commentData);

    // If this is a reply, add it to the parent comment's replies array
    if (parentComment) {
      await Comment.findByIdAndUpdate(
        parentComment,
        { $push: { replies: comment._id } }
      );
    }

    // Populate user info for response
    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'name email username');

    return NextResponse.json(
      { message: 'Comment created successfully', comment: populatedComment },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create comment error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
