import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Comment from '@/models/Comment';
import { getUserFromRequest } from '@/lib/auth';

// PUT update a comment
export async function PUT(
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
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    const comment = await Comment.findById(id);

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check if user owns this comment
    if (comment.userId.toString() !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized to edit this comment' }, { status: 403 });
    }

    comment.text = text;
    await comment.save();

    const populatedComment = await Comment.findById(comment._id).populate('userId', 'name email');

    return NextResponse.json(
      { message: 'Comment updated successfully', comment: populatedComment },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update comment error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

// DELETE a comment
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
    const comment = await Comment.findById(id);

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check if user owns this comment
    if (comment.userId.toString() !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized to delete this comment' }, { status: 403 });
    }

    await Comment.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Comment deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Delete comment error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
