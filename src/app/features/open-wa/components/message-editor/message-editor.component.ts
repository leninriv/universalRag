import { TextFieldModule } from '@angular/cdk/text-field';
import { ChangeDetectionStrategy, Component, ElementRef, computed, input, model, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { Recipient } from '../../models/broadcast.model';
import { MAX_MESSAGE_LENGTH } from '../../utils/limits';
import { renderMessage, unknownVariables } from '../../utils/recipients';

/** Texto del mensaje con variables `{{Columna}}`, botones para insertarlas y vista previa con un destinatario. */
@Component({
  selector: 'app-message-editor',
  imports: [FormsModule, TextFieldModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './message-editor.component.html',
  styles: `
    .preview {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageEditorComponent {
  /** Columnas que se pueden usar como variables. */
  readonly variables = input<string[]>([]);
  /** Destinatario con el que se arma la vista previa. */
  readonly sample = input<Recipient | undefined>();
  /** Largo del mensaje más largo ya personalizado (para avisar si supera el máximo). */
  readonly longestLength = input(0);
  readonly message = model('');

  protected readonly maxLength = MAX_MESSAGE_LENGTH;
  protected readonly placeholder = 'Hola {{Nombre}}, te escribimos para…';
  protected readonly preview = computed(() => {
    const sample = this.sample();
    return sample ? renderMessage(this.message(), sample.data) : this.message();
  });
  protected readonly unknown = computed(() => unknownVariables(this.message(), this.variables()));

  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');

  /** Inserta `{{variable}}` donde está el cursor. */
  protected insert(variable: string): void {
    const element = this.textarea().nativeElement;
    const token = `{{${variable}}}`;
    const start = element.selectionStart ?? this.message().length;
    const end = element.selectionEnd ?? start;
    this.message.update((text) => text.slice(0, start) + token + text.slice(end));
    // El valor del textarea se actualiza en el siguiente ciclo; después se deja el cursor tras la variable.
    setTimeout(() => {
      element.focus();
      element.setSelectionRange(start + token.length, start + token.length);
    });
  }
}
