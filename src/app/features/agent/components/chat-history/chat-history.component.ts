import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';

import { ChatService, groupChatsByDate } from '../../services/chat.service';

/** Botón "Nuevo chat", buscador e historial de chats agrupado por fecha. */
@Component({
    selector: 'app-chat-history',
    imports: [FormsModule, RouterLink, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, MenuModule],
    templateUrl: './chat-history.component.html',
    host: { class: 'flex flex-column' },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatHistoryComponent {
  private readonly chatService = inject(ChatService);

  protected readonly search = signal('');

  protected readonly menuItems = computed<MenuItem[]>(() => {
    const term = this.search().trim().toLowerCase();
    const chats = this.chatService.chats().filter((chat) => chat.title.toLowerCase().includes(term));

    return groupChatsByDate(chats).map((group) => ({
      label: group.label,
      items: group.chats.map((chat) => ({
        label: chat.title,
        title: chat.title,
        routerLink: ['/agent', chat.id],
      })),
    }));
  });
}
