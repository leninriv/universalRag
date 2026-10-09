import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { filter, map } from 'rxjs';

import { DrawerHeaderComponent } from '../../../../shared/components/drawer-header/drawer-header.component';
import { TopbarContentDirective } from '../../../../layout/topbar/topbar-content.directive';
import { ChatHistoryComponent } from '../../components/chat-history/chat-history.component';
import { ChatService } from '../../services/chat.service';

/** Página del módulo Agent: historial de chats + conversación activa (ruta hija). */
@Component({
    selector: 'app-agent-page',
    imports: [RouterOutlet, MatButtonModule, MatIconModule, MatSidenavModule, DrawerHeaderComponent, TopbarContentDirective, ChatHistoryComponent],
    templateUrl: './agent-page.component.html',
    host: { class: 'block h-full' },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgentPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly chatService = inject(ChatService);

  protected readonly historyVisible = signal(false);

  private readonly navigationEnd$ = inject(Router).events.pipe(
    filter((event) => event instanceof NavigationEnd),
  );

  // La página se crea durante una navegación, así que siempre recibe su NavigationEnd. No se lee la
  // ruta hija en el constructor: en ese momento todavía no está activada y no tiene snapshot.
  private readonly activeChatId = toSignal(
    this.navigationEnd$.pipe(map(() => this.route.firstChild?.snapshot.paramMap.get('chatId') ?? null)),
    { initialValue: null },
  );

  protected readonly title = computed(() => {
    const chatId = this.activeChatId();
    return (chatId && this.chatService.getChat(chatId)?.title) || 'Nuevo chat';
  });

  constructor() {
    this.chatService.ensureChatsLoaded().subscribe();
    this.navigationEnd$.pipe(takeUntilDestroyed()).subscribe(() => this.historyVisible.set(false));
  }
}
