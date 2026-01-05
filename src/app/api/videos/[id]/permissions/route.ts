import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import { getUserFromRequest } from '@/lib/auth';

/**
 * PATCH /api/videos/[id]/permissions
 * Updates project permission settings
 * Only the project owner can change permissions
 *
 * Body: { permission: 'invited-only' | 'anyone-view' | 'anyone-edit' }
 */
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

    // Validate permission value
    if (!['invited-only', 'anyone-view', 'anyone-edit'].includes(permission)) {
      return NextResponse.json({ error: 'Invalid permission type' }, { status: 400 });
    }

    // Find the project
    const project = await Project.findById(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Only owner can change permissions
    if (project.userId.toString() !== user.userId) {
      return NextResponse.json({ error: 'Only the project owner can change permissions' }, { status: 403 });
    }

    // Update permission
    project.permission = permission;
    await project.save();

    // Return updated project with populated fields
    const updatedProject = await Project.findById(project._id)
      .populate('userId', 'username name email')
      .populate('invitedUsers.userId', 'name email')
      .populate({
        path: 'videos',
        select: 'videoTitle thumbnail _id',
      });

    return NextResponse.json({ video: updatedProject }, { status: 200 }); // Keep 'video' key for backward compatibility
  } catch (error: any) {
    console.error('Update permission error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
