import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ComingSoonComponent } from '../../../../shared/components/coming-soon/coming-soon.component';

@Component({
    selector: 'app-open-wa-page',
    imports: [ComingSoonComponent],
    template: `<app-coming-soon moduleName="OpenWa" icon="chat" />`,
    host: { class: 'block h-full' },
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OpenWaPageComponent {}
