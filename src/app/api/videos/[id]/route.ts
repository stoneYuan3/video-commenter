import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Video from '@/models/Video';
import Comment from '@/models/Comment';
import { getUserFromRequest } from '@/lib/auth';

// GET a specific video
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(req);

    await connectDB();

    const { id } = await params;
    const video = await Video.findById(id)
      .populate('invitedUsers', 'username name email')
      .populate('userId', 'username name email');

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check permissions
    // video.userId is populated, so we need to access _id
    const videoOwnerId = (video.userId as any)?._id?.toString() || video.userId.toString();
    const isOwner = user && videoOwnerId === user.userId;
    const isInvited = user && video.invitedUsers.some((invitedUser: any) => invitedUser._id.toString() === user.userId);

    // Permission checks based on video.permission
    if (video.permission === 'invited-only') {
      // Invited only: must be logged in and either owner or invited
      if (!user) {
        return NextResponse.json({
          error: 'Unauthorized',
          accessDenied: true,
          videoTitle: video.title,
          ownerEmail: (video.userId as any)?.email
        }, { status: 401 });
      }
      if (!isOwner && !isInvited) {
        return NextResponse.json({
          error: 'Access denied. You are not invited to view this video.',
          accessDenied: true,
          videoTitle: video.title,
          ownerEmail: (video.userId as any)?.email
        }, { status: 403 });
      }
    } else if (video.permission === 'anyone-view') {
      // Anyone can view: no auth required to view, but return user status for comment permissions
      // User can comment only if invited or owner
    } else if (video.permission === 'anyone-edit') {
      // Anyone can edit: no auth required to view, must have account to comment
      // Return user status for comment permissions
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

    await connectDB();

    const { id } = await params;
    const video = await Video.findById(id);

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check if user owns this video
    if (video.userId.toString() !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete all comments associated with this video
    await Comment.deleteMany({ videoId: id });

    // Delete the video
    await Video.findByIdAndDelete(id);

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
