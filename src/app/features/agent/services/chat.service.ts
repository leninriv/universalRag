import { Injectable, computed, signal } from '@angular/core';

import { Chat, ChatGroup, ChatMessage, ChatRole } from '../models/chat.model';

const TITLE_MAX_LENGTH = 40;
const REPLY_DELAY_MS = 1200;
const DAY_MS = 24 * 60 * 60 * 1000;

// Solo UI: no hay backend todavía, las respuestas del agente son simuladas.
const MOCK_REPLIES = [
  'Esta es una respuesta simulada del agente. Cuando el backend esté conectado, aquí verás la respuesta real basada en tus documentos.',
  'Entendido. Por ahora solo estoy mostrando la interfaz, pero pronto podré buscar en tu base de conocimiento y responderte con fuentes.',
  'Buena pregunta. Esta respuesta es de ejemplo: la integración con el modelo todavía no está disponible.',
];

/** Estado de los chats del módulo Agent (en memoria). */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly chatsState = signal<Chat[]>(createSeedChats());
  private readonly pendingChatIds = signal<ReadonlySet<string>>(new Set());

  /** Chats ordenados del más reciente al más antiguo. */
  readonly chats = computed(() =>
    [...this.chatsState()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
  );

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

    setTimeout(() => {
      const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
      this.appendMessage(chatId, createMessage('assistant', reply));
      this.setPending(chatId, false);
    }, REPLY_DELAY_MS);
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

function createMessage(role: ChatRole, content: string, createdAt = new Date()): ChatMessage {
  return { id: crypto.randomUUID(), role, content, createdAt };
}

function createSeedChats(): Chat[] {
  const seed: [title: string, question: string, answer: string, daysAgo: number][] = [
    [
      'Resumen del contrato de proveedores',
      'Resume los puntos clave del contrato de proveedores.',
      'Los puntos clave son: vigencia de 12 meses, pagos a 30 días y penalización por retraso en entregas.',
      0,
    ],
    [
      'Política de vacaciones 2026',
      '¿Cuántos días de vacaciones corresponden el primer año?',
      'Según la política vigente corresponden 15 días hábiles durante el primer año.',
      1,
    ],
    [
      'Ideas para el onboarding',
      'Dame ideas para mejorar el onboarding de nuevos empleados.',
      'Podrías asignar un mentor, preparar una guía de primeros pasos y agendar revisiones a los 30, 60 y 90 días.',
      4,
    ],
    [
      'Consulta sobre facturación',
      '¿Cómo se emite una nota de crédito?',
      'Desde el módulo de facturación selecciona la factura original y elige "Emitir nota de crédito".',
      12,
    ],
    [
      'Manual de soporte técnico',
      '¿Cuál es el procedimiento para reiniciar el servidor?',
      'Primero notifica al equipo, luego detén los servicios en orden y reinicia desde el panel de administración.',
      45,
    ],
  ];

  return seed.map(([title, question, answer, daysAgo]) => {
    const date = new Date(Date.now() - daysAgo * DAY_MS);
    return {
      id: crypto.randomUUID(),
      title,
      createdAt: date,
      updatedAt: date,
      messages: [createMessage('user', question, date), createMessage('assistant', answer, date)],
    };
  });
}
