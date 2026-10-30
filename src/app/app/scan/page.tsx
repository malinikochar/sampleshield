'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import jsQR from 'jsqr';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CameraOff,
  Flashlight,
  Keyboard,
  QrCode,
} from 'lucide-react';
import { OPAQUE_PUBLIC_CODE_REGEX } from '@/lib/validation/schemas';
import { getOfflineDB } from '@/lib/offline/db';
import { Button, Card, FieldLabel, Input } from '@/components/ui/primitives';

export default function QrScannerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  const resolveOpaqueCode = useCallback(
    async (rawInput: string) => {
      const normalized = rawInput.trim().toUpperCase();
      setLookupError(null);

      if (!OPAQUE_PUBLIC_CODE_REGEX.test(normalized)) {
        setLookupError(
          `Unrecognized QR payload "${normalized.slice(
            0,
            24
          )}". Expected opaque SampleShield format SS-XXXX-XXXX-XXXX.`
        );
        return;
      }

      setLookingUp(true);
      stopCamera();

      try {
        // Offline check: if offline, verify if code exists in cached courier assignments
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getOfflineDB()
            .cached_assignments.where('public_code')
            .equals(normalized)
            .first();
          if (cached) {
            router.push(`/app/handovers?code=${encodeURIComponent(normalized)}`);
            return;
          }
          setLookupError(
            'Device is offline and this code is not in your pre-authorized courier assignments.'
          );
          return;
        }

        const res = await fetch(`/api/samples/${encodeURIComponent(normalized)}`);
        if (!res.ok) {
          const errJson = (await res.json().catch(() => null)) as { message?: string } | null;
          setLookupError(
            errJson?.message ??
              'Sample code not found in your organization or outside your role permissions.'
          );
          return;
        }

        router.push(`/app/samples/${encodeURIComponent(normalized)}`);
      } catch {
        // Network error fallback to cached courier assignments
        const cached = await getOfflineDB()
          .cached_assignments.where('public_code')
          .equals(normalized)
          .first();
        if (cached) {
          router.push(`/app/handovers?code=${encodeURIComponent(normalized)}`);
          return;
        }
        setLookupError('Network unreachable and sample is not cached for offline handover.');
      } finally {
        setLookingUp(false);
      }
    },
    [router, stopCamera]
  );

  const startCamera = async () => {
    setCameraError(null);
    setLookupError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera API is unavailable in this browser context. Use manual opaque code entry below.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track && 'getCapabilities' in track) {
        const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(Boolean(caps.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      const scanFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !streamRef.current) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code?.data) {
              void resolveOpaqueCode(code.data);
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(scanFrame);
      };

      rafRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setCameraError(
        'Camera permission was denied or no camera was detected. Grant browser camera access or enter the printed SS-XXXX-XXXX-XXXX code manually below.'
      );
      setCameraActive(false);
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#142437]">
          Scan Specimen Opaque QR
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Scanning performs authenticated lookup only—it never exposes confidential records without
          active organization and role authorization.
        </p>
      </div>

      {lookupError ? (
        <div
          role="alert"
          data-testid="scanner-error"
          className="flex items-start gap-2.5 rounded-xl border border-[#D85A56] bg-[#FDF1F0] p-4 text-sm font-medium text-[#8A1F1C]"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{lookupError}</span>
        </div>
      ) : null}

      {/* Camera Viewport Card */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[#0E9488]" aria-hidden="true" />
            <h2 className="text-base font-bold text-[#142437]">Live Camera Scanner</h2>
          </div>

          <div className="flex items-center gap-2">
            {cameraActive && torchSupported ? (
              <Button variant="outline" size="sm" onClick={() => void toggleTorch()}>
                <Flashlight className="h-3.5 w-3.5" />
                <span>{torchOn ? 'Torch Off' : 'Torch On'}</span>
              </Button>
            ) : null}

            {cameraActive ? (
              <Button variant="outline" size="sm" onClick={stopCamera}>
                <CameraOff className="h-3.5 w-3.5" />
                <span>Stop Camera</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => void startCamera()}
                data-testid="start-camera-btn"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Enable Camera</span>
              </Button>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-[#142437] aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {cameraActive ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-44 w-44 sm:h-52 sm:w-52 rounded-2xl border-2 border-[#5EEAD4] shadow-[0_0_0_9999px_rgba(20,36,55,0.45)]" />
            </div>
          ) : (
            <div className="p-6 text-center text-slate-200 max-w-md space-y-2">
              <Camera className="h-8 w-8 mx-auto text-[#5EEAD4]" aria-hidden="true" />
              <p className="text-sm font-semibold">
                {cameraError ? 'Camera unavailable — manual fallback active' : 'Camera is idle'}
              </p>
              <p className="text-xs text-slate-300">
                {cameraError ??
                  'Tap "Enable Camera" to scan a printed SampleShield label, or type the opaque code below.'}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* First-Class Manual Opaque Code Fallback */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Keyboard className="h-5 w-5 text-[#183B56]" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold text-[#142437]">
              Manual Opaque Code Entry (Low-Light / No-Camera Fallback)
            </h2>
            <p className="text-xs text-slate-600">
              Enter the human-readable identifier printed beneath the QR label.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void resolveOpaqueCode(manualCode);
          }}
          className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
        >
          <div className="flex-1">
            <FieldLabel htmlFor="manual-code-input" required>
              Opaque SampleShield Code
            </FieldLabel>
            <Input
              id="manual-code-input"
              data-testid="manual-qr-input"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="SS-3H8W-5T6J-C4ZP"
              className="font-mono uppercase tracking-wider"
            />
          </div>
          <Button
            type="submit"
            disabled={lookingUp || manualCode.trim().length === 0}
            data-testid="manual-qr-submit"
          >
            <span>{lookingUp ? 'Verifying…' : 'Open Sample Passport'}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
