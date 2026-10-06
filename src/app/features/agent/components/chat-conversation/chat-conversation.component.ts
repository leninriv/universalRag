import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { ChatService } from '../../services/chat.service';
import { ChatComposerComponent } from '../chat-composer/chat-composer.component';
import { ChatEmptyStateComponent } from '../chat-empty-state/chat-empty-state.component';
import { ChatMessageComponent } from '../chat-message/chat-message.component';
import { ChatTypingIndicatorComponent } from '../chat-typing-indicator/chat-typing-indicator.component';

/** Conversación activa. Sin `chatId` muestra el estado inicial de un chat nuevo. */
@Component({
    selector: 'app-chat-conversation',
    imports: [ChatComposerComponent, ChatEmptyStateComponent, ChatMessageComponent, ChatTypingIndicatorComponent],
    templateUrl: './chat-conversation.component.html',
    host: { class: 'flex flex-column h-full' },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatConversationComponent {
  private readonly chatService = inject(ChatService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  /** Parámetro de ruta `:chatId` (vía `withComponentInputBinding`). */
  readonly chatId = input<string>();

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  protected readonly messages = computed(() => {
    const chatId = this.chatId();
    return (chatId && this.chatService.getChat(chatId)?.messages) || [];
  });

  protected readonly awaitingReply = computed(() => {
    const chatId = this.chatId();
    return !!chatId && this.chatService.isAwaitingReply(chatId);
  });

  constructor() {
    // Mantiene visible el último mensaje cuando cambia la conversación.
    effect(() => {
      this.messages();
      this.awaitingReply();
      afterNextRender(() => this.scrollToBottom(), { injector: this.injector });
    });
  }

  protected send(content: string): void {
    const chatId = this.chatId();
    if (chatId) {
      this.chatService.sendMessage(chatId, content);
    } else {
      this.router.navigate(['/agent', this.chatService.startChat(content)]);
    }
  }

  private scrollToBottom(): void {
    const element = this.scroller().nativeElement;
    element.scrollTop = element.scrollHeight;
  }
}
