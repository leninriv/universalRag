import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

/** Caja de texto para escribir y enviar mensajes. Enter envía, Shift+Enter agrega una línea. */
@Component({
    selector: 'app-chat-composer',
    imports: [FormsModule, TextFieldModule, MatButtonModule, MatIconModule, MatInputModule],
    templateUrl: './chat-composer.component.html',
    styleUrl: './chat-composer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatComposerComponent {
  /** Bloquea el envío (p. ej. mientras el agente responde); se puede seguir escribiendo. */
  readonly disabled = input(false);
  readonly submitted = output<string>();

  protected readonly draft = signal('');
  protected readonly canSend = computed(() => !this.disabled() && this.draft().trim().length > 0);

  protected onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey || keyboardEvent.isComposing) {
      return;
    }
    event.preventDefault();
    this.submit();
  }

  protected submit(): void {
    if (!this.canSend()) {
      return;
    }
    this.submitted.emit(this.draft().trim());
    this.draft.set('');
  }
}
