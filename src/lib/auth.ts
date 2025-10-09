import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
}

export function verifyToken(req: NextRequest): JWTPayload | null {
  try {
    const token = req.cookies.get('token')?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function getUserFromRequest(req: NextRequest): JWTPayload | null {
  return verifyToken(req);
}
