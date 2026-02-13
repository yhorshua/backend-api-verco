// src/auth/interfaces/jwt-payload.interface.ts

export interface JwtPayload {
  sub: number;        // ID del usuario
  email: string;      // Email del usuario
  role: string;       // Role del usuario
}
