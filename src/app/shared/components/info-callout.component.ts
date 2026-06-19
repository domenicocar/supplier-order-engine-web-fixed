import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-info-callout',
  standalone: true,
  host: {
    class: 'block'
  },
  template: `
    <div class="flex items-start gap-3 rounded-2xl bg-[var(--brand-primary-soft)] px-4 py-4">
      <i
        class="pi pi-info-circle mt-0.5 shrink-0 text-sm text-[var(--brand-primary)]"
        aria-hidden="true"
      ></i>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-[var(--app-text)]">{{ title() }}</p>
        <p class="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
          {{ message() }}
        </p>
      </div>
      @if (dismissible()) {
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--app-text-muted)] transition hover:bg-white/70 hover:text-[var(--app-text)]"
          [attr.aria-label]="dismissLabel()"
          (click)="dismissed.emit()"
        >
          <i class="pi pi-times text-xs" aria-hidden="true"></i>
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfoCalloutComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly dismissible = input(true);
  readonly dismissLabel = input('Nascondi informazioni');
  readonly dismissed = output<void>();
}
