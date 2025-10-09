import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Video from '@/models/Video';
import { getUserFromRequest } from '@/lib/auth';

// GET all videos for the logged-in user
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const videos = await Video.find({ userId: user.userId }).sort({ createdAt: -1 });

    return NextResponse.json({ videos }, { status: 200 });
  } catch (error: any) {
    console.error('Get videos error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

// POST create a new video
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { title, videoSource, videoId, gdriveId, uploadedVideoUrl, thumbnail, duration } = await req.json();

    // Validation
    if (!title || !videoSource) {
      return NextResponse.json(
        { error: 'Title and video source are required' },
        { status: 400 }
      );
    }

    const video = await Video.create({
      userId: user.userId,
      title,
      videoSource,
      videoId,
      gdriveId,
      uploadedVideoUrl,
      thumbnail,
      duration: duration || 0,
    });

    return NextResponse.json(
      { message: 'Video created successfully', video },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create video error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
