import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { ChatService, groupChatsByDate } from '../../services/chat.service';

/** Botón "Nuevo chat", buscador e historial de chats agrupado por fecha. */
@Component({
    selector: 'app-chat-history',
    imports: [
      FormsModule,
      RouterLink,
      RouterLinkActive,
      MatButtonModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatListModule,
    ],
    templateUrl: './chat-history.component.html',
    host: { class: 'flex flex-column' },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatHistoryComponent {
  protected readonly chatService = inject(ChatService);

  protected readonly search = signal('');

  protected readonly groups = computed(() => {
    const term = this.search().trim().toLowerCase();
    const chats = this.chatService.chats().filter((chat) => chat.title.toLowerCase().includes(term));
    return groupChatsByDate(chats);
  });
}
