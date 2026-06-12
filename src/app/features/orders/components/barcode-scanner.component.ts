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
import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  DecodeHintType,
  NotFoundException
} from '@zxing/library';

type ExtendedTrackCapabilities = MediaTrackCapabilities & {
  focusDistance?: { min: number; max: number; step?: number };
  focusMode?: string[];
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
};

type ExtendedTrackConstraintSet = MediaTrackConstraintSet & {
  focusDistance?: number;
  focusMode?: string;
  torch?: boolean;
  zoom?: number;
};

type NativeBarcode = {
  rawValue: string;
};

type NativeBarcodeDetector = {
  detect(source: HTMLVideoElement): Promise<NativeBarcode[]>;
};

type NativeBarcodeDetectorConstructor = new (options: {
  formats: string[];
}) => NativeBarcodeDetector;

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div
      class="fixed inset-0 z-[10000] flex flex-col items-center justify-center overflow-hidden bg-black"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
    >
      <div
        class="absolute inset-x-0 top-0 z-50 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-6"
      >
        <h2 id="barcode-scanner-title" class="font-bold text-white">Scanner</h2>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white"
          aria-label="Chiudi scanner"
          (click)="close()"
        >
          <i class="pi pi-times text-xl" aria-hidden="true"></i>
        </button>
      </div>

      <video
        #video
        class="absolute inset-0 h-full w-full object-cover"
        autoplay
        muted
        playsinline
      ></video>

      <div
        class="pointer-events-none relative z-10 h-48 w-80 rounded-2xl border-2 border-white/40 shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]"
      >
        <div
          class="absolute inset-0 animate-pulse rounded-2xl border-2 border-[var(--brand-primary)]"
        ></div>
      </div>

      @if (!initialized()) {
        <div class="absolute inset-0 z-40 flex items-center justify-center bg-black">
          @if (error()) {
            <div class="mx-6 max-w-md rounded-3xl bg-white p-5 text-center">
              <p class="text-sm font-medium leading-6 text-rose-700">{{ error() }}</p>
              <div class="mt-4 flex gap-2">
                <input
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  class="app-input min-w-0 flex-1"
                  placeholder="Inserisci EAN"
                  aria-label="EAN manuale"
                  [ngModel]="manualCode()"
                  (ngModelChange)="manualCode.set($event)"
                  (keyup.enter)="submitManualCode()"
                />
                <button
                  type="button"
                  class="app-primary-action px-4 text-sm disabled:opacity-50"
                  [disabled]="!manualCode().trim()"
                  (click)="submitManualCode()"
                >
                  Cerca
                </button>
              </div>
            </div>
          } @else {
            <div class="h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BarcodeScannerComponent implements AfterViewInit {
  @ViewChild('video', { static: true })
  private readonly videoRef!: ElementRef<HTMLVideoElement>;

  readonly scanned = output<string>();
  readonly closed = output<void>();
  readonly initialized = signal(false);
  readonly error = signal<string | null>(null);
  readonly manualCode = signal('');

  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isScanning = { current: true };
  private readonly hasStarted = { current: false };
  private readonly hasScanned = { current: false };
  private selectedCameraId: string | null = null;
  private stream: MediaStream | null = null;
  private reader: BrowserMultiFormatReader | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private animationFrameId: number | null = null;
  private previousBodyOverflow = '';

  constructor() {
    this.destroyRef.onDestroy(() => this.stopEverything());
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    void this.loadCameras();
  }

  close(): void {
    this.stopEverything();
    this.closed.emit();
  }

  submitManualCode(): void {
    this.handleSuccess(this.manualCode());
  }

  private stopEverything(): void {
    this.isScanning.current = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.reader) {
      try {
        this.reader.reset();
      } catch {
        // The reader may already have released its video source.
      }
      this.reader = null;
    }

    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch {
        // Some mobile browsers throw while a stream is shutting down.
      }
      this.stream = null;
    }

    const video = this.videoRef?.nativeElement;
    if (video) {
      video.srcObject = null;
      video.pause();
      try {
        video.load();
      } catch {
        // Safari can reject load() after the stream has already stopped.
      }
    }

    this.canvas = null;

    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = this.previousBodyOverflow;
    }
  }

  private handleSuccess(rawCode: string): void {
    const code = rawCode.trim();

    if (!code || !this.isScanning.current || this.hasScanned.current) {
      return;
    }

    this.hasScanned.current = true;
    this.isScanning.current = false;

    try {
      navigator.vibrate?.(100);
    } catch {
      // Vibration is optional and unsupported on iOS.
    }

    this.stopEverything();
    this.scanned.emit(code);
  }

  private async startScanning(): Promise<void> {
    const video = this.videoRef.nativeElement;

    if (this.hasStarted.current || !this.isScanning.current) {
      return;
    }

    this.hasStarted.current = true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    try {
      const constraints: MediaTrackConstraints = isIOS
        ? {
            facingMode: { exact: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60, max: 60 }
          }
        : {
            deviceId:
              this.selectedCameraId && this.selectedCameraId !== 'environment'
                ? { exact: this.selectedCameraId }
                : undefined,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60, max: 60 },
            facingMode: { ideal: 'environment' }
          };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: constraints
      });

      if (!this.isScanning.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.stream = stream;
      video.srcObject = stream;
      await this.waitForVideo(video, stream, isIOS);

      if (!this.isScanning.current) {
        return;
      }

      const BarcodeDetectorClass = (
        window as Window &
          typeof globalThis & { BarcodeDetector?: NativeBarcodeDetectorConstructor }
      ).BarcodeDetector;

      if (BarcodeDetectorClass) {
        this.startNativeLoop(
          new BarcodeDetectorClass({
            formats: ['ean_13', 'ean_8', 'upc_a', 'code_128']
          })
        );
      } else {
        this.startZxingCanvasLoop();
      }
    } catch (error: unknown) {
      console.error('Camera initialization error:', error);
      this.hasStarted.current = false;
      this.zone.run(() => {
        this.initialized.set(false);
        this.error.set(this.cameraErrorMessage(error));
      });
    }
  }

  private async waitForVideo(
    video: HTMLVideoElement,
    stream: MediaStream,
    isIOS: boolean
  ): Promise<void> {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      await this.configureVideoTrack(stream, isIOS);
      await video.play();
      this.zone.run(() => this.initialized.set(true));
      await this.delay(300);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const handleLoadedMetadata = async () => {
        try {
          if (!this.isScanning.current) {
            reject(new Error('Stopped during video initialization'));
            return;
          }

          await this.configureVideoTrack(stream, isIOS);
          await video.play();
          this.zone.run(() => this.initialized.set(true));
          await this.delay(300);
          resolve();
        } catch (error: unknown) {
          reject(error);
        }
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata, {
        once: true
      });
    });
  }

  private async configureVideoTrack(stream: MediaStream, isIOS: boolean): Promise<void> {
    const track = stream.getVideoTracks()[0];
    if (!track) {
      return;
    }

    const capabilities = track.getCapabilities() as ExtendedTrackCapabilities;
    const advanced: ExtendedTrackConstraintSet[] = [];

    if (isIOS) {
      if (capabilities.focusMode?.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }

      if (capabilities.focusDistance) {
        advanced.push({
          focusDistance: capabilities.focusDistance.min || 0.1
        });
      }
    } else {
      if (capabilities.zoom?.max) {
        advanced.push({
          zoom: Math.min(capabilities.zoom.max, 1.5)
        });
      }

      if (capabilities.focusMode?.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }
    }

    if (advanced.length === 0) {
      return;
    }

    try {
      await track.applyConstraints({
        advanced: advanced as MediaTrackConstraintSet[]
      });
    } catch (error: unknown) {
      console.warn(`${isIOS ? 'iOS' : 'Android'} camera constraints failed:`, error);
    }
  }

  private startNativeLoop(detector: NativeBarcodeDetector): void {
    const nativeLoop = async () => {
      const video = this.videoRef.nativeElement;

      if (!this.isScanning.current || this.hasScanned.current) {
        return;
      }

      try {
        const barcodes = await detector.detect(video);
        const firstBarcode = barcodes[0];

        if (firstBarcode && this.isScanning.current && !this.hasScanned.current) {
          this.zone.run(() => this.handleSuccess(firstBarcode.rawValue));
          return;
        }
      } catch {
        // Native detection can fail temporarily while autofocus is moving.
      }

      if (this.isScanning.current && !this.hasScanned.current) {
        this.animationFrameId = requestAnimationFrame(nativeLoop);
      }
    };

    void nativeLoop();
  }

  private startZxingCanvasLoop(): void {
    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.CODE_128
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.ASSUME_GS1, false);
    hints.set(DecodeHintType.PURE_BARCODE, false);

    const reader = new BrowserMultiFormatReader(hints);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', {
      willReadFrequently: true
    });

    canvas.width = 640;
    canvas.height = 480;
    this.reader = reader;
    this.canvas = canvas;

    const scanLoop = async () => {
      const video = this.videoRef.nativeElement;

      if (!this.isScanning.current || this.hasScanned.current) {
        return;
      }

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
          const cropWidth = video.videoWidth * 0.8;
          const cropHeight = video.videoHeight * 0.4;
          const cropX = (video.videoWidth - cropWidth) / 2;
          const cropY = (video.videoHeight - cropHeight) / 2;

          context?.drawImage(
            video,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const result = await reader.decodeFromImageUrl(canvas.toDataURL('image/png'));

          if (result && this.isScanning.current && !this.hasScanned.current) {
            this.zone.run(() => this.handleSuccess(result.getText()));
            return;
          }
        } catch (error: unknown) {
          if (!(error instanceof NotFoundException)) {
            console.error('Scan error:', error);
          }
        }
      }

      if (this.isScanning.current && !this.hasScanned.current) {
        this.animationFrameId = requestAnimationFrame(scanLoop);
      }
    };

    void scanLoop();
  }

  private async loadCameras(): Promise<void> {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      this.selectedCameraId = 'environment';
      await this.startScanning();
      return;
    }

    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true
      });
      permissionStream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === 'videoinput');
      let bestBackCamera: MediaDeviceInfo | undefined;
      let maxResolution = 0;

      for (const device of videoInputs) {
        if (
          /back|rear/i.test(device.label) &&
          !/wide|0\.5|ultra/i.test(device.label)
        ) {
          try {
            const candidateStream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: device.deviceId } }
            });
            const track = candidateStream.getVideoTracks()[0];
            const capabilities = track?.getCapabilities();
            candidateStream.getTracks().forEach((candidateTrack) => candidateTrack.stop());

            const resolution =
              (capabilities?.width?.max ?? 0) * (capabilities?.height?.max ?? 0);

            if (resolution > maxResolution) {
              maxResolution = resolution;
              bestBackCamera = device;
            }
          } catch {
            // Ignore camera devices that cannot be opened individually.
          }
        }
      }

      const selectedCamera =
        bestBackCamera ??
        videoInputs.find((device) => /back|rear/i.test(device.label)) ??
        videoInputs[0];

      this.selectedCameraId = selectedCamera?.deviceId ?? 'environment';
    } catch (error: unknown) {
      console.error('Camera enumeration error:', error);
      this.selectedCameraId = 'environment';
    }

    await this.startScanning();
  }

  private cameraErrorMessage(error: unknown): string {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        return "Permesso fotocamera negato. Abilitalo nel browser oppure inserisci l'EAN.";
      }

      if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        return 'Non e stata trovata una fotocamera posteriore compatibile.';
      }

      if (error.name === 'NotReadableError') {
        return "La fotocamera e gia in uso da un'altra applicazione.";
      }
    }

    return "Impossibile avviare la fotocamera. Puoi inserire manualmente l'EAN.";
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
