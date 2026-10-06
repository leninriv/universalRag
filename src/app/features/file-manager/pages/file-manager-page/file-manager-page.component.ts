import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ComingSoonComponent } from '../../../../shared/components/coming-soon/coming-soon.component';

@Component({
    selector: 'app-file-manager-page',
    imports: [ComingSoonComponent],
    template: `<app-coming-soon moduleName="FileManager" icon="pi pi-folder-open" />`,
    host: { class: 'block h-full' },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileManagerPageComponent {}
