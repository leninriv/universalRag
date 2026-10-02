import { Routes } from '@angular/router';

import { ChatConversationComponent } from './components/chat-conversation/chat-conversation.component';
import { chatExistsGuard } from './guards/chat-exists.guard';
import { AgentPageComponent } from './pages/agent-page/agent-page.component';

export const AGENT_ROUTES: Routes = [
  {
    path: '',
    title: 'Agent · Universal RAG',
    component: AgentPageComponent,
    children: [
      { path: '', component: ChatConversationComponent },
      { path: ':chatId', component: ChatConversationComponent, canActivate: [chatExistsGuard] },
    ],
  },
];
