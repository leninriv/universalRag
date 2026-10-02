import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { ChatService } from '../services/chat.service';

/** Redirige a un chat nuevo si el id de la URL no existe. */
export const chatExistsGuard: CanActivateFn = (route) => {
  const chatId = route.paramMap.get('chatId');
  return (chatId && inject(ChatService).getChat(chatId)) ? true : inject(Router).createUrlTree(['/agent']);
};
