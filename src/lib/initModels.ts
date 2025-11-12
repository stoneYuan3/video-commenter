// Initialize all mongoose models to prevent MissingSchemaError in serverless environments
// This ensures all models are registered before any database operations that use populate()

import User from '@/models/User';
import Video from '@/models/Video';
import Comment from '@/models/Comment';

/**
 * Initialize all Mongoose models by importing them.
 * This is critical for serverless environments where models may not be
 * registered when the function cold starts after being idle.
 *
 * Call this before any database operation that uses populate() or references
 * models indirectly.
 */
export function initializeModels() {
  // Simply importing the models ensures they are registered with Mongoose
  // The models themselves use the pattern: mongoose.models.X || mongoose.model('X', schema)
  // which prevents duplicate registration errors

  return {
    User,
    Video,
    Comment,
  };
}

export default initializeModels;
