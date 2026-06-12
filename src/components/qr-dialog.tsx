import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 512, color: { dark: "#0a0a0a", light: "#ffffff" } })
      .then(setDataUrl).catch(() => setDataUrl(""));
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl ring-1 ring-border p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">QR Code</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>
        <div className="bg-white rounded-lg p-4 grid place-items-center">
          {dataUrl ? (
            <img src={dataUrl} alt="QR Code" className="size-56" />
          ) : (
            <div className="size-56 bg-muted animate-pulse rounded" />
          )}
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground text-center font-mono break-all">{url}</p>
        {dataUrl && (
          <a href={dataUrl} download="qr-code.png" className="mt-4 w-full block text-center py-2 bg-foreground text-background text-xs font-medium rounded hover:opacity-90 transition">
            Download PNG
          </a>
        )}
      </div>
    </div>
  );
}
