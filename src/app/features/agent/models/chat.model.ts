export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
}

export interface Chat {
  id: string;
  /** Id del chat en el backend; existe tras la primera respuesta de `ask`. */
  remoteId?: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
  /** `false` en chats del historial cuyos mensajes aún no se han traído del servidor. */
  messagesLoaded?: boolean;
}

export interface ChatGroup {
  label: string;
  chats: Chat[];
}
