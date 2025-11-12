import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
}

export function verifyToken(req: NextRequest): JWTPayload | null {
  const timestamp = new Date().toISOString();
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    const token = req.cookies.get('token')?.value;

    if (!token) {
      console.log(`[${timestamp}] Auth: No token found in request`, {
        path: req.nextUrl.pathname,
        userAgent,
      });
      return null;
    }

    console.log(`[${timestamp}] Auth: Token found, attempting verification`, {
      path: req.nextUrl.pathname,
      tokenLength: token.length,
      userAgent,
    });

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    console.log(`[${timestamp}] Auth: Token verified successfully`, {
      userId: decoded.userId,
      email: decoded.email,
      path: req.nextUrl.pathname,
    });

    return decoded;
  } catch (error: any) {
    console.error(`[${timestamp}] Auth: Token verification failed`, {
      errorName: error.name,
      errorMessage: error.message,
      path: req.nextUrl.pathname,
      userAgent,
      isExpiredError: error.name === 'TokenExpiredError',
      expiredAt: error.expiredAt ? new Date(error.expiredAt).toISOString() : null,
    });
    return null;
  }
}

export function getUserFromRequest(req: NextRequest): JWTPayload | null {
  return verifyToken(req);
}
