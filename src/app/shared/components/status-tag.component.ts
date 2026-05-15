import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

type TagTone = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';

@Component({
  selector: 'app-status-tag',
  standalone: true,
  imports: [TagModule],
  template: '<p-tag [severity]="severity()" [value]="label()" />',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusTagComponent {
  readonly label = input.required<string>();
  readonly tone = input<TagTone | undefined>();

  readonly severity = computed<TagTone>(() => {
    const explicitTone = this.tone();

    if (explicitTone) {
      return explicitTone;
    }

    const normalized = this.label().toLowerCase();

    if (normalized.includes('error') || normalized.includes('reject')) {
      return 'danger';
    }

    if (normalized.includes('warn') || normalized.includes('review')) {
      return 'warn';
    }

    if (normalized.includes('complete') || normalized.includes('success')) {
      return 'success';
    }

    return 'info';
  });
}
