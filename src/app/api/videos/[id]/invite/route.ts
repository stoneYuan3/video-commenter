import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { sendInvitationEmail } from '@/lib/email';
import { executeDbOperation } from '@/lib/dbUtils';

/**
 * POST /api/videos/[id]/invite
 * Invites a user to collaborate on a project
 * Sends an invitation email with an acceptance link
 *
 * Body: { email: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const result = await executeDbOperation(
      async () => {
        const project = await Project.findById(id);

        if (!project) {
          throw new Error('Project not found');
        }

        // Check if user is owner or invited user
        const isOwner = project.userId.toString() === user.userId;
        const isInvited = project.invitedUsers.some((invited: any) =>
          invited.email === user.email && invited.accepted
        );

        if (!isOwner && !isInvited) {
          throw new Error('You do not have permission to invite users');
        }

        // Check if the email to invite exists in our system
        const userToInvite = await User.findOne({ email });
        const hasAccount = !!userToInvite;

        // Check if already invited or is owner
        if (hasAccount && project.userId.toString() === userToInvite._id.toString()) {
          throw new Error('User is the project owner');
        }

        if (project.invitedUsers.some((invited: any) => invited.email === email)) {
          throw new Error('User is already invited');
        }

        // Add user to invitedUsers with accepted: false
        project.invitedUsers.push({
          email,
          accepted: false,
          userId: undefined, // Will be set when they accept
          invitedAt: new Date(),
        } as any);
        await project.save();

        // Get the inviter's name
        const inviter = await User.findById(user.userId);
        const inviterName = inviter?.name || inviter?.username || 'Someone';

        return { project, userToInvite, inviterName, hasAccount };
      },
      'Failed to invite user'
    );

    const { project, userToInvite, inviterName, hasAccount } = result;

    // Generate invitation acceptance link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const acceptLink = `${baseUrl}/accept-invite?videoId=${project._id}&email=${encodeURIComponent(email)}`;

    // Send invitation email
    try {
      await sendInvitationEmail({
        toEmail: email,
        toName: userToInvite?.name || email.split('@')[0],
        videoTitle: project.title, // Project title instead of video title
        acceptLink,
        inviterName,
        hasAccount,
      });
      console.log(`Invitation email sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the invitation if email fails, just log it
    }

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
    console.error('Invite user error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/videos/[id]/invite?email={email}
 * Removes an invited user from a project
 * Only the project owner can remove users
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
    const { searchParams } = new URL(req.url);
    const emailToRemove = searchParams.get('email');

    if (!emailToRemove) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const project = await executeDbOperation(
      async () => {
        const project = await Project.findById(id);

        if (!project) {
          throw new Error('Project not found');
        }

        // Only owner can remove users
        if (project.userId.toString() !== user.userId) {
          throw new Error('Only the project owner can remove users');
        }

        // Remove user from invitedUsers array
        project.invitedUsers = project.invitedUsers.filter((invited: any) => invited.email !== emailToRemove);
        await project.save();

        return project;
      },
      'Failed to remove user'
    );

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
    console.error('Remove user error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
