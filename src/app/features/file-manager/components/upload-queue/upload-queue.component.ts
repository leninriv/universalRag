import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { UploadItem } from '../../models/document.model';
import { FileSizePipe } from '../../pipes/file-size.pipe';
import { fileTypeOf } from '../../utils/file-rules';

/** Subidas en curso (con su progreso) y las que fallaron. */
@Component({
  selector: 'app-upload-queue',
  imports: [MatButtonModule, MatIconModule, MatListModule, MatProgressBarModule, FileSizePipe],
  templateUrl: './upload-queue.component.html',
  styles: `
    .upload-error {
      color: var(--mat-sys-error);
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadQueueComponent {
  readonly uploads = input.required<UploadItem[]>();
  /** Se pidió cancelar una subida en curso (emite su id). */
  readonly cancelled = output<string>();
  /** Se descartó una subida que falló (emite su id). */
  readonly dismissed = output<string>();

  protected readonly fileTypeOf = fileTypeOf;
}
