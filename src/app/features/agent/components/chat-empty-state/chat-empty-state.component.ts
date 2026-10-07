import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';

interface PromptSuggestion {
  icon: string;
  title: string;
  description: string;
  prompt: string;
}

/** Bienvenida de un chat nuevo con sugerencias de preguntas. */
@Component({
    selector: 'app-chat-empty-state',
    imports: [AvatarModule, ButtonModule],
    templateUrl: './chat-empty-state.component.html',
    host: { class: 'flex flex-column align-items-center justify-content-center py-4' },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatEmptyStateComponent {
  readonly promptSelected = output<string>();

  protected readonly suggestions: PromptSuggestion[] = [
    {
      icon: 'pi pi-file',
      title: 'Resume un documento',
      description: 'Extrae los puntos clave de un archivo',
      prompt: 'Resume los puntos clave del último documento que subí.',
    },
    {
      icon: 'pi pi-search',
      title: 'Busca en la base de conocimiento',
      description: 'Encuentra respuestas en tus documentos',
      prompt: '¿Qué dice la documentación sobre la política de vacaciones?',
    },
    {
      icon: 'pi pi-envelope',
      title: 'Redacta un mensaje',
      description: 'Escribe un correo claro y profesional',
      prompt: 'Redacta un correo para informar al equipo sobre la nueva política de trabajo remoto.',
    },
    {
      icon: 'pi pi-lightbulb',
      title: 'Genera ideas',
      description: 'Propuestas para un nuevo proyecto',
      prompt: 'Dame ideas para mejorar la atención al cliente por WhatsApp.',
    },
  ];
}
