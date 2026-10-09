import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { ChatService } from '../services/chat.service';

/** Redirige a un chat nuevo si el id de la URL no existe (espera a que cargue el historial). */
export const chatExistsGuard: CanActivateFn = (route) => {
  const chatId = route.paramMap.get('chatId');
  const chatService = inject(ChatService);
  const router = inject(Router);
  return chatService
    .ensureChatsLoaded()
    .pipe(map(() => (chatId && chatService.getChat(chatId) ? true : router.createUrlTree(['/agent']))));
};
