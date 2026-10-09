import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api.config';
import { AuthService } from '../../../core/services/auth.service';
import { Chat, ChatGroup, ChatMessage, ChatRole } from '../models/chat.model';

const TITLE_MAX_LENGTH = 40;
const CHATS_PAGE_SIZE = 50;
const MESSAGES_PAGE_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Edge function `ask`: `{ question, chat_id? }` → respuesta del agente (requiere sesión iniciada). */
export const ASK_URL = `${API_CONFIG.baseUrl}/functions/ask`;

/** Edge function `list-chats`: chats del usuario en sesión, paginados (`page_size`, `before_cursor`). */
export const LIST_CHATS_URL = `${API_CONFIG.baseUrl}/functions/list-chats`;
/** RPC `get_chat_messages`: mensajes de un chat del usuario (los más recientes primero en la paginación). */
export const CHAT_MESSAGES_URL = `${API_CONFIG.baseUrl}/api/database/rpc/get_chat_messages`;

interface RemoteChat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ListChatsResponse {
  chats: RemoteChat[];
  has_more: boolean;
  next_cursor: string | null;
}

interface ChatMessagesResponse {
  messages: { id: number; role: ChatRole; content: string; created_at: string }[];
}

interface AskResponse {
  answer: string;
  chat: { id: string };
}

/** Chats del módulo Agent (en memoria); las respuestas vienen de la edge function `ask`. */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly chatsState = signal<Chat[]>([]);
  private readonly loadingMessageIds = signal<ReadonlySet<string>>(new Set());
  private loadedFor: string | null = null;
  private listRequest: Observable<void> | null = null;
  private nextCursor: string | null = null;

  readonly loadingChats = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly hasMoreChats = signal(false);
  private readonly pendingChatIds = signal<ReadonlySet<string>>(new Set());

  /** Chats ordenados del más reciente al más antiguo. */
  readonly chats = computed(() =>
    [...this.chatsState()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
  );

  /** Carga el historial del usuario en sesión una vez (y otra vez si cambia de usuario). */
  ensureChatsLoaded(): Observable<void> {
    const userId = this.auth.user()?.id ?? null;
    if (this.listRequest && this.loadedFor === userId) {
      return this.listRequest;
    }
    this.loadedFor = userId;
    this.chatsState.set([]);
    this.nextCursor = null;
    this.hasMoreChats.set(false);
    this.listRequest = this.fetchChats(null).pipe(shareReplay(1));
    return this.listRequest;
  }

  loadMoreChats(): void {
    if (this.nextCursor && !this.loadingChats()) {
      this.fetchChats(this.nextCursor).subscribe();
    }
  }

  /** Trae los mensajes de un chat guardado en el servidor la primera vez que se abre. */
  loadMessages(chatId: string): void {
    const chat = this.getChat(chatId);
    if (!chat?.remoteId || chat.messagesLoaded !== false || this.loadingMessageIds().has(chatId)) {
      return;
    }
    this.setLoadingMessages(chatId, true);
    this.http
      .post<ChatMessagesResponse>(CHAT_MESSAGES_URL, { chat_id: chat.remoteId, page_size: MESSAGES_PAGE_SIZE })
      .subscribe({
        next: ({ messages }) => {
          this.patchChat(chatId, {
            messagesLoaded: true,
            messages: messages.map((m) => createMessage(m.role, m.content, new Date(m.created_at), String(m.id))),
          });
          this.setLoadingMessages(chatId, false);
        },
        error: () => this.setLoadingMessages(chatId, false),
      });
  }

  isLoadingMessages(chatId: string): boolean {
    return this.loadingMessageIds().has(chatId);
  }

  getChat(id: string): Chat | undefined {
    return this.chatsState().find((chat) => chat.id === id);
  }

  isAwaitingReply(chatId: string): boolean {
    return this.pendingChatIds().has(chatId);
  }

  /** Crea un chat nuevo a partir del primer mensaje del usuario y devuelve su id. */
  startChat(content: string): string {
    const now = new Date();
    const chat: Chat = {
      id: crypto.randomUUID(),
      title: toTitle(content),
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    this.chatsState.update((chats) => [chat, ...chats]);
    this.sendMessage(chat.id, content);
    return chat.id;
  }

  sendMessage(chatId: string, content: string): void {
    this.appendMessage(chatId, createMessage('user', content));
    this.setPending(chatId, true);

    // El servidor crea el chat con la primera pregunta; las siguientes lo referencian con su id.
    const remoteId = this.getChat(chatId)?.remoteId;
    this.http.post<AskResponse>(ASK_URL, { question: content, ...(remoteId && { chat_id: remoteId }) }).subscribe({
      next: ({ answer, chat }) => {
        this.patchChat(chatId, { remoteId: chat.id });
        this.appendMessage(chatId, createMessage('assistant', answer));
        this.setPending(chatId, false);
      },
      error: (error: unknown) => {
        this.appendMessage(chatId, createMessage('assistant', replyError(error)));
        this.setPending(chatId, false);
      },
    });
  }

  private fetchChats(cursor: string | null): Observable<void> {
    this.loadingChats.set(true);
    this.loadError.set(null);
    return this.http
      .post<ListChatsResponse>(LIST_CHATS_URL, { page_size: CHATS_PAGE_SIZE, ...(cursor && { before_cursor: cursor }) })
      .pipe(
        tap((page) => {
          const known = new Set(this.chatsState().map((chat) => chat.remoteId));
          const incoming = page.chats.filter((chat) => !known.has(chat.id)).map(toChat);
          this.chatsState.update((chats) => [...chats, ...incoming]);
          this.nextCursor = page.next_cursor;
          this.hasMoreChats.set(page.has_more);
          this.loadingChats.set(false);
        }),
        map(() => undefined),
        catchError((error: unknown) => {
          this.loadedFor = null;
          this.listRequest = null;
          this.loadError.set(errorMessage(error, 'No se pudo cargar el historial.'));
          this.loadingChats.set(false);
          return of(undefined);
        }),
      );
  }

  private patchChat(chatId: string, patch: Partial<Chat>): void {
    this.chatsState.update((chats) => chats.map((chat) => (chat.id === chatId ? { ...chat, ...patch } : chat)));
  }

  private setLoadingMessages(chatId: string, loading: boolean): void {
    this.loadingMessageIds.update((ids) => {
      const next = new Set(ids);
      if (loading) {
        next.add(chatId);
      } else {
        next.delete(chatId);
      }
      return next;
    });
  }

  private appendMessage(chatId: string, message: ChatMessage): void {
    this.chatsState.update((chats) =>
      chats.map((chat) =>
        chat.id === chatId
          ? { ...chat, updatedAt: message.createdAt, messages: [...chat.messages, message] }
          : chat,
      ),
    );
  }

  private setPending(chatId: string, pending: boolean): void {
    this.pendingChatIds.update((ids) => {
      const next = new Set(ids);
      if (pending) {
        next.add(chatId);
      } else {
        next.delete(chatId);
      }
      return next;
    });
  }
}

function replyError(error: unknown): string {
  const detail = error instanceof HttpErrorResponse ? error.error?.error : null;
  return `No pude obtener una respuesta. ${typeof detail === 'string' ? detail : 'Inténtalo de nuevo.'}`;
}

function errorMessage(error: unknown, fallback: string): string {
  const detail = error instanceof HttpErrorResponse ? error.error?.error : null;
  return typeof detail === 'string' ? detail : fallback;
}

function toChat(remote: RemoteChat): Chat {
  return {
    id: remote.id,
    remoteId: remote.id,
    title: remote.title,
    createdAt: new Date(remote.created_at),
    updatedAt: new Date(remote.updated_at),
    messages: [],
    messagesLoaded: false,
  };
}

/** Agrupa chats (ya ordenados) por antigüedad, como en el historial de ChatGPT. */
export function groupChatsByDate(chats: Chat[], now = new Date()): ChatGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const buckets: { label: string; from: number }[] = [
    { label: 'Hoy', from: startOfToday },
    { label: 'Ayer', from: startOfToday - DAY_MS },
    { label: 'Últimos 7 días', from: startOfToday - 7 * DAY_MS },
    { label: 'Últimos 30 días', from: startOfToday - 30 * DAY_MS },
    { label: 'Anteriores', from: Number.NEGATIVE_INFINITY },
  ];

  const groups = buckets.map(({ label }): ChatGroup => ({ label, chats: [] }));
  for (const chat of chats) {
    const index = buckets.findIndex(({ from }) => chat.updatedAt.getTime() >= from);
    groups[index].chats.push(chat);
  }
  return groups.filter((group) => group.chats.length > 0);
}

function toTitle(content: string): string {
  const singleLine = content.replace(/\s+/g, ' ').trim();
  return singleLine.length > TITLE_MAX_LENGTH ? `${singleLine.slice(0, TITLE_MAX_LENGTH)}…` : singleLine;
}

function createMessage(role: ChatRole, content: string, createdAt = new Date(), id: string = crypto.randomUUID()): ChatMessage {
  return { id, role, content, createdAt };
}
