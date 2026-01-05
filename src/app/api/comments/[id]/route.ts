import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import initializeModels from '@/lib/initModels';
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
    initializeModels();

    const { id } = await params;
    const { content } = await req.json();

    // Support both 'content' (new) and 'text' (backward compatibility)
    const commentText = content;

    if (!commentText) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    const comment = await Comment.findById(id);

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check if user owns this comment
    if (comment.userId.toString() !== user.userId) {
      return NextResponse.json({ error: 'Unauthorized to edit this comment' }, { status: 403 });
    }

    comment.content = commentText;
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

    // If this is a reply, remove it from parent's replies array
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(
        comment.parentComment,
        { $pull: { replies: comment._id } }
      );
    }

    // Delete all replies first
    if (comment.replies && comment.replies.length > 0) {
      await Comment.deleteMany({ _id: { $in: comment.replies } });
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
