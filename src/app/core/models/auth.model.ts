export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/** Respuesta de `POST /api/auth/sessions` (InsForge, cliente web). */
export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    emailVerified?: boolean;
    profile?: { name?: string | null } | null;
  };
}

/** Sesión guardada en el navegador. */
export interface AuthSession {
  token: string;
  /** Epoch en milisegundos. */
  expiresAt: number;
  user: AuthUser;
}
