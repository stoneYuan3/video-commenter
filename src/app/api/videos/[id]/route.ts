import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import initializeModels from '@/lib/initModels';
import Project from '@/models/Project';
import Video from '@/models/Video';
import Comment from '@/models/Comment';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { executeDbOperation } from '@/lib/dbUtils';

/**
 * GET /api/videos/[id]?videoIndex=0
 * Retrieves a project with its videos and comments
 *
 * Query Parameters:
 * - videoIndex: Index of the video to load details for (default: 0)
 *
 * Response:
 * - project: Project metadata with all video thumbnails/titles
 * - currentVideo: Full details of the selected video (source, title, thumbnail)
 * - projectComments: General project comments (only when videoIndex=0)
 * - videoComments: Comments for the selected video
 * - userPermissions: User's access rights
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(req);
    const { id } = await params;

    // Get videoIndex from query params (default to 0 for first video)
    const { searchParams } = new URL(req.url);
    const videoIndex = parseInt(searchParams.get('videoIndex') || '0', 10);

    await connectDB();
    initializeModels();

    // Fetch the project with all video metadata (thumbnails and titles only)
    const project = await executeDbOperation(
      async () => {
        return await Project.findById(id)
          .populate('userId', 'username name email')
          .populate('invitedUsers.userId', 'name email')
          .populate({
            path: 'videos',
            select: 'videoTitle thumbnail _id', // Only fetch metadata for all videos
          });
      },
      'Failed to fetch project'
    );

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions
    const projectOwnerId = (project.userId as any)?._id?.toString() || project.userId.toString();
    const isOwner = user && projectOwnerId === user.userId;

    // Check invitation status
    const invitedUser = user && project.invitedUsers.find((invited: any) =>
      invited.email === user.email
    );
    const isInvited = invitedUser && invitedUser.accepted;

    // Permission checks based on project.permission
    if (project.permission === 'invited-only') {
      if (!user) {
        return NextResponse.json({
          error: 'Unauthorized',
          accessDenied: true,
          videoTitle: project.title,
          ownerEmail: (project.userId as any)?.email,
          invitationStatus: 'not-logged-in'
        }, { status: 401 });
      }
      if (!isOwner && !isInvited) {
        const isPending = invitedUser && !invitedUser.accepted;
        return NextResponse.json({
          error: isPending
            ? 'Invitation pending. Please check your email to accept the invitation.'
            : 'Access denied. You are not invited to view this project.',
          accessDenied: true,
          videoTitle: project.title,
          ownerEmail: (project.userId as any)?.email,
          invitationStatus: isPending ? 'pending' : 'not-invited'
        }, { status: 403 });
      }
    }

    // Track last opened time for this user
    if (user) {
      try {
        await executeDbOperation(
          async () => {
            if (!project.lastOpenedBy) {
              project.lastOpenedBy = new Map();
            }
            project.lastOpenedBy.set(user.userId, new Date());
            await project.save();
          },
          'Failed to update last opened time'
        );
      } catch (saveError) {
        console.error('Error saving last opened time:', saveError);
        // Don't fail the request if we can't save the timestamp
      }
    }

    // Validate videoIndex
    if (!project.videos || project.videos.length === 0) {
      return NextResponse.json({ error: 'Project has no videos' }, { status: 404 });
    }
    if (videoIndex < 0 || videoIndex >= project.videos.length) {
      return NextResponse.json({ error: 'Invalid video index' }, { status: 400 });
    }

    // Fetch full details for the selected video only
    const selectedVideoId = (project.videos[videoIndex] as any)._id;
    const currentVideo = await Video.findById(selectedVideoId);

    if (!currentVideo) {
      return NextResponse.json({ error: 'Selected video not found' }, { status: 404 });
    }

    // Fetch video-specific comments (always fetch for selected video)
    const videoComments = await Comment.find({
      commentedTo: selectedVideoId,
      commentedToType: 'video',
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
      .sort({ timestamp: 1, 'timeRange.start': 1 });

    // Fetch general project comments (only on initial load - videoIndex = 0)
    let projectComments = [];
    if (videoIndex === 0) {
      projectComments = await Comment.find({
        commentedTo: project._id,
        commentedToType: 'project',
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
        .sort({ createdAt: -1 }); // Newest first for project comments
    }

    // Prepare response
    const response: any = {
      project: {
        _id: project._id,
        title: project.title,
        userId: project.userId,
        permission: project.permission,
        invitedUsers: project.invitedUsers,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        videos: project.videos, // Array of video metadata (title, thumbnail, _id)
      },
      currentVideo: {
        _id: currentVideo._id,
        videoTitle: currentVideo.videoTitle,
        videoSource: currentVideo.videoSource,
        thumbnail: currentVideo.thumbnail,
        duration: currentVideo.duration,
      },
      videoComments: videoComments,
      userPermissions: {
        canView: true, // If we got here, user can view
        canComment: isOwner || isInvited || project.permission === 'anyone-edit',
        isOwner: isOwner || false,
        isInvited: isInvited || false,
      }
    };

    // Include project comments only on initial load
    if (videoIndex === 0) {
      response.projectComments = projectComments;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('Get project error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/videos/[id]
 * Deletes a project and all associated videos and comments
 * Only the project owner can delete
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await executeDbOperation(
      async () => {
        const project = await Project.findById(id);

        if (!project) {
          throw new Error('Project not found');
        }

        // Check if user owns this project
        if (project.userId.toString() !== user.userId) {
          throw new Error('Unauthorized');
        }

        // Delete all comments associated with this project (both project and video comments)
        await Comment.deleteMany({ commentedTo: project._id });

        // Delete all comments for videos in this project
        for (const videoId of project.videos) {
          await Comment.deleteMany({ commentedTo: videoId });
        }

        // Delete all videos associated with this project
        await Video.deleteMany({ _id: { $in: project.videos } });

        // Delete the project itself
        await Project.findByIdAndDelete(id);
      },
      'Failed to delete project'
    );

    return NextResponse.json(
      { message: 'Project and associated content deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete project error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
