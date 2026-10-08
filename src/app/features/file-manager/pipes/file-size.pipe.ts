import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';
import { formatNumber } from '@angular/common';

const UNITS = ['B', 'KB', 'MB', 'GB'];

/** Tamaño legible de un archivo: `1258291 | fileSize` → `1,2 MB`. */
@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(bytes: number | null | undefined): string {
    if (bytes == null || !Number.isFinite(bytes)) {
      return '';
    }
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < UNITS.length - 1) {
      value /= 1024;
      unit++;
    }
    return `${formatNumber(value, this.locale, unit === 0 || value >= 100 ? '1.0-0' : '1.0-1')} ${UNITS[unit]}`;
  }
}
