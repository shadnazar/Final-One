import React, { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, RotateCw, ZoomIn, ZoomOut, Square, Smartphone, Monitor } from 'lucide-react';

/**
 * Returns a Promise<Blob> of the cropped area at the requested output size.
 * Drawn on an offscreen canvas — no server roundtrip needed.
 */
async function getCroppedBlob(imageSrc, pixelCrop, rotation = 0, outputSize = 1200) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Output dimensions preserve crop aspect ratio
  const aspect = pixelCrop.width / pixelCrop.height;
  if (aspect >= 1) {
    canvas.width = outputSize;
    canvas.height = Math.round(outputSize / aspect);
  } else {
    canvas.height = outputSize;
    canvas.width = Math.round(outputSize * aspect);
  }

  // Apply rotation if any
  if (rotation) {
    const rad = (rotation * Math.PI) / 180;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
  }

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, canvas.width, canvas.height
  );

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92));
}

const ASPECT_PRESETS = [
  { label: 'Square', value: 1, icon: Square, hint: '1:1 — best for product cards' },
  { label: 'Portrait', value: 4 / 5, icon: Smartphone, hint: '4:5 — Instagram-ready' },
  { label: 'Landscape', value: 16 / 9, icon: Monitor, hint: '16:9 — banner / hero' },
  { label: 'Free', value: null, icon: null, hint: 'No fixed ratio' },
];

/**
 * <ImageCropperModal /> — opens a fullscreen crop UI.
 * Props:
 *   open: boolean
 *   imageSrc: string (URL or data URL)
 *   defaultAspect: number (default 1)
 *   onCancel: () => void
 *   onConfirm: (croppedBlob: Blob) => void
 */
export default function ImageCropperModal({ open, imageSrc, defaultAspect = 1, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(defaultAspect);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, rotation, 1200);
      onConfirm?.(blob);
    } catch (e) {
      console.error('Crop failed:', e);
      alert('Crop failed. The image may have CORS restrictions — please re-upload from your device.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex flex-col" data-testid="image-cropper-modal">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 text-white">
        <div className="flex items-center gap-2">
          <Square size={16} className="text-emerald-400" />
          <h3 className="text-sm font-bold">Crop &amp; adjust image</h3>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Cancel" data-testid="crop-cancel">
          <X size={18} />
        </button>
      </div>

      {/* Cropper canvas */}
      <div className="relative flex-1 bg-stone-900">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect ?? undefined}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          showGrid
          objectFit="contain"
          restrictPosition={false}
        />
      </div>

      {/* Aspect ratio chips */}
      <div className="bg-black/60 px-4 py-3 flex items-center gap-2 overflow-x-auto" data-testid="crop-aspect-bar">
        {ASPECT_PRESETS.map((p) => {
          const active = (p.value === aspect) || (p.value === null && aspect === null);
          const Icon = p.icon;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setAspect(p.value)}
              title={p.hint}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                active ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
              data-testid={`crop-aspect-${p.label.toLowerCase()}`}
            >
              {Icon && <Icon size={12} />}
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Zoom + rotate */}
      <div className="bg-black/40 px-4 py-3 flex items-center gap-3 text-white">
        <button onClick={() => setZoom((z) => Math.max(1, z - 0.25))} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Zoom out">
          <ZoomOut size={16} />
        </button>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-emerald-500"
          aria-label="Zoom"
          data-testid="crop-zoom"
        />
        <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Zoom in">
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="ml-1 p-2 hover:bg-white/10 rounded-lg"
          aria-label="Rotate 90°"
          title="Rotate 90°"
          data-testid="crop-rotate"
        >
          <RotateCw size={16} />
        </button>
      </div>

      {/* Action bar */}
      <div className="bg-black/60 px-4 py-3 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-bold text-white/90 hover:bg-white/10"
          data-testid="crop-cancel-btn"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={busy}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          data-testid="crop-confirm-btn"
        >
          {busy ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check size={14} /> Apply crop
            </>
          )}
        </button>
      </div>
    </div>
  );
}
