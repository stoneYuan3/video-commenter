import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Video from '@/models/Video';
import Comment from '@/models/Comment';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { executeDbOperation } from '@/lib/dbUtils';

// GET a specific video
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(req);
    const { id } = await params;

    const video = await executeDbOperation(
      async () => {
        return await Video.findById(id)
          .populate('userId', 'username name email')
          .populate('invitedUsers.userId', 'name email');
      },
      'Failed to fetch video'
    );

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check permissions
    // video.userId is populated, so we need to access _id
    const videoOwnerId = (video.userId as any)?._id?.toString() || video.userId.toString();
    const isOwner = user && videoOwnerId === user.userId;

    // Check invitation status - invitedUsers is now array of objects
    const invitedUser = user && video.invitedUsers.find((invited: any) =>
      invited.email === user.email
    );
    const isInvited = invitedUser && invitedUser.accepted;

    // Permission checks based on video.permission
    if (video.permission === 'invited-only') {
      // Invited only: must be logged in and either owner or invited
      if (!user) {
        return NextResponse.json({
          error: 'Unauthorized',
          accessDenied: true,
          videoTitle: video.title,
          ownerEmail: (video.userId as any)?.email,
          invitationStatus: 'not-logged-in'
        }, { status: 401 });
      }
      if (!isOwner && !isInvited) {
        const isPending = invitedUser && !invitedUser.accepted;
        return NextResponse.json({
          error: isPending
            ? 'Invitation pending. Please check your email to accept the invitation.'
            : 'Access denied. You are not invited to view this video.',
          accessDenied: true,
          videoTitle: video.title,
          ownerEmail: (video.userId as any)?.email,
          invitationStatus: isPending ? 'pending' : 'not-invited'
        }, { status: 403 });
      }
    } else if (video.permission === 'anyone-view') {
      // Anyone can view: no auth required to view, but return user status for comment permissions
      // User can comment only if invited or owner
    } else if (video.permission === 'anyone-edit') {
      // Anyone can edit: no auth required to view, must have account to comment
      // Return user status for comment permissions
    }

    // Track last opened time for this user
    if (user) {
      try {
        await executeDbOperation(
          async () => {
            // Initialize Map if it doesn't exist
            if (!video.lastOpenedBy) {
              video.lastOpenedBy = new Map();
            }
            video.lastOpenedBy.set(user.userId, new Date());
            await video.save();
          },
          'Failed to update last opened time'
        );
      } catch (saveError) {
        console.error('Error saving last opened time:', saveError);
        // Don't fail the request if we can't save the timestamp
      }
    }

    // Return video with user permissions info
    return NextResponse.json({
      video,
      userPermissions: {
        canView: true, // If we got here, user can view
        canComment: isOwner || isInvited || video.permission === 'anyone-edit',
        isOwner: isOwner || false,
        isInvited: isInvited || false,
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error('Get video error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

// DELETE a video
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
        const video = await Video.findById(id);

        if (!video) {
          throw new Error('Video not found');
        }

        // Check if user owns this video
        if (video.userId.toString() !== user.userId) {
          throw new Error('Unauthorized');
        }

        // Delete all comments associated with this video
        await Comment.deleteMany({ videoId: id });

        // Delete the video
        await Video.findByIdAndDelete(id);
      },
      'Failed to delete video'
    );

    return NextResponse.json(
      { message: 'Video and associated comments deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete video error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
