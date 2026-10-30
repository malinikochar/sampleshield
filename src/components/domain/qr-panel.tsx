'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, Printer, ShieldCheck } from 'lucide-react';
import { Button, Card } from '@/components/ui/primitives';

export function QrPanel({
  publicCode,
  specimenType,
  sourceCode,
  destinationCode,
  isDemo,
}: {
  publicCode: string;
  specimenType: string;
  sourceCode?: string;
  destinationCode?: string;
  isDemo: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    // SECURITY CONTRACT: QR payload encodes ONLY the opaque random identifier — zero PHI.
    QRCode.toDataURL(publicCode, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
      color: {
        dark: '#142437',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [publicCode]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = `${publicCode}-opaque-qr.png`;
    anchor.click();
  };

  return (
    <Card className="p-5 print-only-passport">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Opaque Specimen QR Label
        </span>
        {isDemo ? (
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
            SYNTHETIC DEMO
          </span>
        ) : null}
      </div>

      <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-[#F7FAFC] p-4">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt={`Opaque QR code for specimen ${publicCode}`}
            width={184}
            height={184}
            className="rounded-lg border border-slate-200 bg-white p-2"
          />
        ) : (
          <div className="h-[184px] w-[184px] animate-pulse rounded-lg bg-slate-200" />
        )}

        <p
          data-testid="sample-public-code"
          className="mt-3 font-mono text-base font-bold tracking-wider text-[#142437]"
        >
          {publicCode}
        </p>
        <p className="mt-0.5 text-xs text-slate-600 text-center">{specimenType}</p>

        {sourceCode && destinationCode ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-white px-2.5 py-1 text-xs font-mono font-medium text-[#183B56] border border-slate-200">
            <span>{sourceCode}</span>
            <span aria-hidden="true">→</span>
            <span>{destinationCode}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#E5F7F3]/60 px-3 py-2 text-xs text-[#0B5D56]">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          Zero-PII payload: encodes only random identifier{' '}
          <code className="font-mono font-semibold">{publicCode}</code>. Authenticated facility
          access is required on scan.
        </span>
      </div>

      <div className="no-print mt-4 grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-[#0E9488]" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy ID'}</span>
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={!qrDataUrl}>
          <Download className="h-3.5 w-3.5" />
          <span>PNG</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          <span>Print</span>
        </Button>
      </div>
    </Card>
  );
}
