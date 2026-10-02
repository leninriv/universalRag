import { Directive, OnDestroy, OnInit, TemplateRef, inject } from '@angular/core';

import { LayoutService } from '../layout.service';

/**
 * Proyecta contenido de una página en la barra superior global (a la izquierda de tema y avatar).
 * Uso: `<ng-template appTopbarContent> ...título, acciones... </ng-template>`
 */
@Directive({
  selector: 'ng-template[appTopbarContent]',
  standalone: true,
})
export class TopbarContentDirective implements OnInit, OnDestroy {
  private readonly layout = inject(LayoutService);
  private readonly template = inject(TemplateRef);

  ngOnInit(): void {
    this.layout.topbarContent.set(this.template);
  }

  ngOnDestroy(): void {
    if (this.layout.topbarContent() === this.template) {
      this.layout.topbarContent.set(null);
    }
  }
}
