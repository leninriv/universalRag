import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';

interface PromptSuggestion {
  icon: string;
  title: string;
  description: string;
  prompt: string;
}

/** Bienvenida de un chat nuevo con sugerencias de preguntas. */
@Component({
    selector: 'app-chat-empty-state',
    imports: [MatButtonModule, MatIconModule, AvatarComponent],
    templateUrl: './chat-empty-state.component.html',
    host: { class: 'flex flex-column align-items-center justify-content-center py-4' },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatEmptyStateComponent {
  readonly promptSelected = output<string>();

  protected readonly suggestions: PromptSuggestion[] = [
    {
      icon: 'description',
      title: 'Resume un documento',
      description: 'Extrae los puntos clave de un archivo',
      prompt: 'Resume los puntos clave del último documento que subí.',
    },
    {
      icon: 'search',
      title: 'Busca en la base de conocimiento',
      description: 'Encuentra respuestas en tus documentos',
      prompt: '¿Qué dice la documentación sobre la política de vacaciones?',
    },
    {
      icon: 'mail',
      title: 'Redacta un mensaje',
      description: 'Escribe un correo claro y profesional',
      prompt: 'Redacta un correo para informar al equipo sobre la nueva política de trabajo remoto.',
    },
    {
      icon: 'lightbulb',
      title: 'Genera ideas',
      description: 'Propuestas para un nuevo proyecto',
      prompt: 'Dame ideas para mejorar la atención al cliente por WhatsApp.',
    },
  ];
}
