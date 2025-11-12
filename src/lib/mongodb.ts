import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function connectDB() {
  const timestamp = new Date().toISOString();
  const connectionStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  // Check if we have a connection and if it's still active
  if (cached.conn) {
    const readyState = cached.conn.connection.readyState;
    const stateString = connectionStates[readyState as keyof typeof connectionStates] || 'unknown';

    console.log(`[${timestamp}] MongoDB: Checking existing connection`, {
      readyState,
      stateString,
      host: cached.conn.connection.host,
      name: cached.conn.connection.name,
    });

    // Check connection state: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (readyState === 1) {
      console.log(`[${timestamp}] MongoDB: Reusing existing active connection`);
      return cached.conn;
    }

    // Connection is not active, reset it
    console.log(`[${timestamp}] MongoDB: Connection lost (state: ${stateString}), reconnecting...`, {
      lastConnectionHost: cached.conn.connection.host,
      lastConnectionName: cached.conn.connection.name,
    });
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    console.log(`[${timestamp}] MongoDB: Creating new connection promise`);

    const opts = {
      bufferCommands: false,
      dbName: 'VideoCommenter',
      // Connection pool settings optimized for MongoDB Atlas Free Tier
      maxPoolSize: 10, // Max number of connections in the pool
      minPoolSize: 2,  // Minimum number of connections
      serverSelectionTimeoutMS: 5000, // Timeout for server selection
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      // Retry settings
      retryWrites: true,
      retryReads: true,
      // Connection timeout
      connectTimeoutMS: 10000,
    };

    console.log(`[${timestamp}] MongoDB: Attempting connection with options:`, {
      dbName: opts.dbName,
      maxPoolSize: opts.maxPoolSize,
      serverSelectionTimeoutMS: opts.serverSelectionTimeoutMS,
      socketTimeoutMS: opts.socketTimeoutMS,
    });

    const connectStartTime = Date.now();

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        const connectTime = Date.now() - connectStartTime;
        const ts = new Date().toISOString();
        console.log(`[${ts}] MongoDB: Connected successfully in ${connectTime}ms`, {
          host: mongoose.connection.host,
          name: mongoose.connection.name,
          readyState: mongoose.connection.readyState,
        });
        return mongoose;
      })
      .catch((error) => {
        const connectTime = Date.now() - connectStartTime;
        const ts = new Date().toISOString();
        console.error(`[${ts}] MongoDB: Connection error after ${connectTime}ms`, {
          errorName: error.name,
          errorMessage: error.message,
          errorCode: error.code,
          errorStack: error.stack,
        });
        cached.promise = null;
        throw error;
      });
  }

  try {
    console.log(`[${timestamp}] MongoDB: Awaiting connection promise...`);
    cached.conn = await cached.promise;
    console.log(`[${timestamp}] MongoDB: Connection promise resolved successfully`);
  } catch (e: any) {
    cached.promise = null;
    console.error(`[${timestamp}] MongoDB: Failed to establish connection`, {
      errorName: e.name,
      errorMessage: e.message,
      errorCode: e.code,
      errorStack: e.stack,
    });
    throw e;
  }

  return cached.conn;
}

// Handle connection events
mongoose.connection.on('connected', () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Mongoose: Connection event 'connected'`, {
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    readyState: mongoose.connection.readyState,
  });
});

mongoose.connection.on('error', (err) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Mongoose: Connection event 'error'`, {
    errorName: err.name,
    errorMessage: err.message,
    errorStack: err.stack,
  });
  cached.conn = null;
  cached.promise = null;
});

mongoose.connection.on('disconnected', () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Mongoose: Connection event 'disconnected'`, {
    previousHost: mongoose.connection.host,
    previousName: mongoose.connection.name,
  });
  cached.conn = null;
  cached.promise = null;
});

// Graceful shutdown
if (process.env.NODE_ENV !== 'production') {
  process.on('SIGINT', async () => {
    if (cached.conn) {
      await cached.conn.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    }
  });
}

export default connectDB;
