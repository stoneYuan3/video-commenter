import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { executeDbOperation } from '@/lib/dbUtils';

/**
 * POST /api/videos/[id]/accept-invite
 * Accepts an invitation to collaborate on a project
 * Body: { email: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get current user if logged in
    const currentUser = getUserFromRequest(req);

    const result = await executeDbOperation(
      async () => {
        const project = await Project.findById(id);

        if (!project) {
          throw new Error('Project not found');
        }

        // Find the invitation
        const invitationIndex = project.invitedUsers.findIndex(
          (invited: any) => invited.email === email
        );

        if (invitationIndex === -1) {
          // Return specific error response for deleted/not-found invitations
          const populatedProject = await project.populate('userId', 'email');
          return {
            notFound: true,
            videoTitle: project.title,
            ownerEmail: (populatedProject.userId as any)?.email
          };
        }

        const invitation = project.invitedUsers[invitationIndex];

        if (invitation.accepted) {
          // Already accepted, just return success
          return { project, alreadyAccepted: true, hasAccount: !!invitation.userId };
        }

        // Check if user has an account
        const user = await User.findOne({ email });

        if (!user) {
          // User doesn't have account yet, mark as pending signup
          return { project, hasAccount: false, alreadyAccepted: false };
        }

        // User has account, mark as accepted
        project.invitedUsers[invitationIndex].accepted = true;
        project.invitedUsers[invitationIndex].userId = user._id;
        await project.save();

        return { project, hasAccount: true, alreadyAccepted: false };
      },
      'Failed to accept invitation'
    );

    const { project, hasAccount, alreadyAccepted, notFound, videoTitle, ownerEmail } = result as any;

    // Handle invitation not found case
    if (notFound) {
      return NextResponse.json({
        error: 'Invitation not found. Please contact the project owner.',
        invitationNotFound: true,
        videoTitle,
        ownerEmail
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      hasAccount,
      alreadyAccepted,
      videoId: project._id,
      videoTitle: project.title,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Accept invitation error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
