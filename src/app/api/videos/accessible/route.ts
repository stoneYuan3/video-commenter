import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Video from '@/models/Video';
import { getUserFromRequest } from '@/lib/auth';

// GET all videos accessible to the current user (owned + shared)
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Find videos where:
    // 1. User is the owner, OR
    // 2. User is in the invitedUsers list
    const videos = await Video.find({
      $or: [
        { userId: user.userId },
        { invitedUsers: user.userId }
      ]
    })
    .populate('userId', 'username name email')
    .populate('invitedUsers', 'username name email');

    // Sort videos by last opened time for this user (most recent first)
    const sortedVideos = videos.map(video => {
      const lastOpened = video.lastOpenedBy?.get(user.userId);
      return {
        ...video.toObject(),
        lastOpenedAt: lastOpened || video.createdAt, // Fallback to createdAt if never opened
      };
    }).sort((a, b) => {
      const timeA = new Date(a.lastOpenedAt).getTime();
      const timeB = new Date(b.lastOpenedAt).getTime();
      return timeB - timeA; // Most recent first
    });

    return NextResponse.json({ videos: sortedVideos }, { status: 200 });
  } catch (error: any) {
    console.error('Get accessible videos error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
