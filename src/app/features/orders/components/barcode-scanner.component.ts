import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  ViewChild,
  inject,
  output,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div
      class="fixed inset-0 z-[10000] flex flex-col overflow-hidden bg-black"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
    >
      <div
        class="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-5 pb-10 pt-5"
      >
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            Fotocamera posteriore
          </p>
          <h2 id="barcode-scanner-title" class="mt-1 text-lg font-bold text-white">
            Scansiona il barcode
          </h2>
        </div>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"
          aria-label="Chiudi scanner"
          (click)="close()"
        >
          <i class="pi pi-times text-lg" aria-hidden="true"></i>
        </button>
      </div>

      <video
        #video
        class="absolute inset-0 h-full w-full object-cover"
        autoplay
        muted
        playsinline
      ></video>

      <div class="pointer-events-none relative z-10 flex flex-1 items-center justify-center px-6">
        <div
          class="relative h-48 w-full max-w-sm rounded-3xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.58)]"
        >
          <span class="absolute -left-0.5 -top-0.5 h-10 w-10 rounded-tl-3xl border-l-4 border-t-4 border-[var(--brand-primary)]"></span>
          <span class="absolute -right-0.5 -top-0.5 h-10 w-10 rounded-tr-3xl border-r-4 border-t-4 border-[var(--brand-primary)]"></span>
          <span class="absolute -bottom-0.5 -left-0.5 h-10 w-10 rounded-bl-3xl border-b-4 border-l-4 border-[var(--brand-primary)]"></span>
          <span class="absolute -bottom-0.5 -right-0.5 h-10 w-10 rounded-br-3xl border-b-4 border-r-4 border-[var(--brand-primary)]"></span>
          <span
            class="absolute left-5 right-5 top-1/2 h-0.5 bg-[var(--brand-primary)] shadow-[0_0_12px_var(--brand-primary)]"
          ></span>
        </div>
      </div>

      <div class="relative z-20 bg-gradient-to-t from-black via-black/90 to-transparent px-5 pb-7 pt-14">
        @if (error()) {
          <p class="mb-4 rounded-2xl bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
            {{ error() }}
          </p>
        } @else {
          <p class="mb-4 text-center text-sm text-white/80">
            Inquadra il codice a barre e mantieni fermo il telefono.
          </p>
        }

        <div class="flex gap-2">
          <input
            type="text"
            inputmode="numeric"
            autocomplete="off"
            class="min-w-0 flex-1 rounded-2xl border border-white/20 bg-white px-4 py-3 text-base text-slate-950 outline-none"
            placeholder="Oppure inserisci l'EAN"
            aria-label="EAN manuale"
            [ngModel]="manualCode()"
            (ngModelChange)="manualCode.set($event)"
            (keyup.enter)="submitManualCode()"
          />
          <button
            type="button"
            class="rounded-2xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            [disabled]="!manualCode().trim()"
            (click)="submitManualCode()"
          >
            Cerca
          </button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BarcodeScannerComponent implements AfterViewInit {
  @ViewChild('video', { static: true })
  private readonly videoRef!: ElementRef<HTMLVideoElement>;

  readonly scanned = output<string>();
  readonly closed = output<void>();
  readonly error = signal<string | null>(null);
  readonly manualCode = signal('');

  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private controls: IScannerControls | null = null;
  private active = true;
  private previousBodyOverflow = '';

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    void this.startScanner();
  }

  close(): void {
    this.stop();
    this.closed.emit();
  }

  submitManualCode(): void {
    this.complete(this.manualCode());
  }

  private async startScanner(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set(
        "La fotocamera non e disponibile. Apri il sito in HTTPS oppure inserisci l'EAN qui sotto."
      );
      return;
    }

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 80,
      delayBetweenScanSuccess: 500
    });

    try {
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        },
        this.videoRef.nativeElement,
        (result) => {
          if (result && this.active) {
            this.zone.run(() => this.complete(result.getText()));
          }
        }
      );

      if (!this.active) {
        controls.stop();
        return;
      }

      this.controls = controls;
    } catch (error: unknown) {
      this.zone.run(() => this.error.set(this.cameraErrorMessage(error)));
    }
  }

  private complete(rawCode: string): void {
    const code = rawCode.trim();

    if (!code || !this.active) {
      return;
    }

    navigator.vibrate?.(100);
    this.stop();
    this.scanned.emit(code);
  }

  private stop(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    this.controls?.stop();
    this.controls = null;

    const stream = this.videoRef?.nativeElement.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    if (this.videoRef?.nativeElement) {
      this.videoRef.nativeElement.srcObject = null;
    }

    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = this.previousBodyOverflow;
    }
  }

  private cameraErrorMessage(error: unknown): string {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        return "Permesso fotocamera negato. Abilitalo nel browser oppure inserisci l'EAN qui sotto.";
      }

      if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        return 'Non e stata trovata una fotocamera compatibile su questo dispositivo.';
      }

      if (error.name === 'NotReadableError') {
        return "La fotocamera e gia in uso da un'altra applicazione.";
      }
    }

    return "Impossibile avviare la fotocamera. Puoi inserire manualmente l'EAN qui sotto.";
  }
}
