export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/** Respuesta de `POST /auth/login`. */
export interface LoginResponse {
  accessToken: string;
  /** Vigencia del token en segundos. */
  expiresIn: number;
  user: AuthUser;
}

/** Sesión guardada en el navegador. */
export interface AuthSession {
  token: string;
  /** Epoch en milisegundos. */
  expiresAt: number;
  user: AuthUser;
}
