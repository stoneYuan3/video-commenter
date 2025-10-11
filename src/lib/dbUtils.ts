import connectDB from './mongodb';

/**
 * Execute a database operation with automatic retry on connection failures
 * This is especially useful for MongoDB Atlas free tier which may close idle connections
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Ensure connection is active before operation
      await connectDB();

      // Execute the operation
      const result = await operation();
      return result;
    } catch (error: any) {
      lastError = error;

      // Check if it's a connection error
      const isConnectionError =
        error.name === 'MongooseServerSelectionError' ||
        error.name === 'MongoNetworkError' ||
        error.message?.includes('connection') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ETIMEDOUT');

      if (isConnectionError && attempt < maxRetries) {
        console.log(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying...`);

        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        continue;
      }

      // If it's not a connection error or we've exhausted retries, throw
      throw error;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Operation failed after retries');
}

/**
 * Wrapper for database operations with proper error handling
 */
export async function executeDbOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string = 'Database operation failed'
): Promise<T> {
  try {
    return await withRetry(operation);
  } catch (error: any) {
    console.error(`${errorMessage}:`, error);
    // Re-throw the original error to preserve error messages
    throw error;
  }
}
