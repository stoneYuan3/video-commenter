import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Video from '@/models/Video';
import { getUserFromRequest } from '@/lib/auth';

// Update video permissions
export async function PATCH(
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
    const { permission } = await req.json();

    if (!['invited-only', 'anyone-view', 'anyone-edit'].includes(permission)) {
      return NextResponse.json({ error: 'Invalid permission type' }, { status: 400 });
    }

    const video = await Video.findById(id);

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Only owner can change permissions
    if (video.userId.toString() !== user.userId) {
      return NextResponse.json({ error: 'Only the video owner can change permissions' }, { status: 403 });
    }

    video.permission = permission;
    await video.save();

    return NextResponse.json({ video }, { status: 200 });
  } catch (error: any) {
    console.error('Update permission error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
