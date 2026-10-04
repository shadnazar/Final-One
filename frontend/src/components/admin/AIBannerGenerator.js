import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Sparkles, X, Upload, Loader2, Check, ImagePlus } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * AIBannerGenerator — one-click AI image generator for category / concern / subcategory cards.
 *
 * Props:
 *   • resourceType : 'category' | 'concern' | 'subcategory'
 *   • slug         : string                — entity slug used in the PATCH URL
 *   • currentImage : string|null           — currently-saved image (for context only)
 *   • onUpdated    : (newUrl) => void      — called after the generated image is saved
 *   • token        : string                — X-Admin-Token
 *
 * UX:
 *   1. Admin clicks the AI button — modal opens with empty prompt + (optional) file picker.
 *   2. Admin types prompt, optionally drops a reference image, clicks Generate.
 *   3. Banner image generates via Gemini Nano Banana — preview rendered.
 *   4. "Use this image" saves it to the resource. "Generate again" re-rolls (with same or new prompt/reference).
 *   5. Closing the modal and re-opening = fresh state, so a different prompt + image
 *      produces a different result (matches the user's "off the button and try again" flow).
 */
export default function AIBannerGenerator({ resourceType, slug, currentImage, onUpdated, token }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [ref, setRef] = useState(null);
  const [refPreview, setRefPreview] = useState('');
  const [aspect, setAspect] = useState('square');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  const auth = { headers: { 'X-Admin-Token': token } };

  const reset = () => {
    setPrompt('');
    setRef(null);
    setRefPreview('');
    setResult(null);
    setErr('');
    setBusy(false);
    setSaved(false);
    setAspect('square');
  };

  const close = () => { reset(); setOpen(false); };

  const pickRef = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setErr('Reference image too large (max 8 MB)');
      return;
    }
    setRef(file);
    setRefPreview(URL.createObjectURL(file));
    setErr('');
  };

  const generate = async () => {
    if (!prompt.trim()) {
      setErr('Type a prompt first — e.g. "Glowing dewy skin closeup with peach tones"');
      return;
    }
    setBusy(true); setErr(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('prompt', prompt.trim());
      fd.append('aspect', aspect);
      if (ref) fd.append('reference', ref);
      const { data } = await axios.post(`${API}/api/admin/ai/generate-banner`, fd, {
        ...auth,
        timeout: 120000,
      });
      if (!data?.image_url) throw new Error('No image returned');
      setResult(data.image_url);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  const useThis = async () => {
    if (!result) return;
    setBusy(true); setErr('');
    try {
      const resourcePath = resourceType === 'category' ? 'categories'
        : resourceType === 'subcategory' ? 'subcategories'
        : 'concerns';
      await axios.patch(`${API}/api/admin/${resourcePath}/${slug}/image`, { image: result }, auth);
      setSaved(true);
      onUpdated?.(result);
      try { window.dispatchEvent(new Event('admin-data-changed')); } catch (_) { /* noop */ }
      setTimeout(() => { close(); }, 700);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Generate banner with AI (Nano Banana)"
        className="p-1.5 rounded transition text-violet-600 hover:bg-violet-50"
        data-testid={`ai-banner-btn-${resourceType}-${slug}`}
      >
        <Sparkles size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4" data-testid={`ai-banner-modal-${resourceType}-${slug}`}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between p-5 border-b">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2 text-violet-700">
                  <Sparkles size={16} /> AI Banner Generator
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Nano Banana · {resourceType} · <span className="font-mono">{slug}</span></p>
              </div>
              <button onClick={close} className="text-gray-400 hover:text-gray-700 p-1 -mr-1" data-testid="ai-banner-close">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Reference image */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Reference image <span className="text-gray-400 font-normal">(optional · style / mood only)</span></label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickRef} />
                {refPreview ? (
                  <div className="relative inline-block">
                    <img src={refPreview} alt="reference" className="h-24 w-24 object-cover rounded-lg ring-1 ring-gray-200" />
                    <button
                      type="button"
                      onClick={() => { setRef(null); setRefPreview(''); }}
                      className="absolute -top-1.5 -right-1.5 bg-white rounded-full shadow ring-1 ring-gray-200 p-0.5 hover:bg-red-50 text-red-500"
                      data-testid="ai-banner-clear-ref"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold border-2 border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-violet-300 hover:text-violet-700 transition"
                    data-testid="ai-banner-upload-ref"
                  >
                    <ImagePlus size={14} /> Upload reference
                  </button>
                )}
              </div>

              {/* Prompt */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Prompt <span className="text-red-400">*</span></label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder='e.g. "Glowing dewy skin closeup with golden hour light, peach and cream tones, hydrating skincare serum"'
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  data-testid="ai-banner-prompt"
                />
              </div>

              {/* Aspect */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Shape</label>
                <div className="flex gap-1.5">
                  {[
                    { v: 'square', label: 'Square 1:1' },
                    { v: 'landscape', label: 'Landscape 16:9' },
                    { v: 'portrait', label: 'Portrait 3:4' },
                  ].map(o => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setAspect(o.v)}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-full border transition ${aspect === o.v ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}
                      data-testid={`ai-banner-aspect-${o.v}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {err && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2.5" data-testid="ai-banner-error">
                  {err}
                </div>
              )}

              {/* Result preview */}
              {result && (
                <div className="border-2 border-violet-200 rounded-xl p-2.5 bg-violet-50/40">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-violet-700 mb-1.5">Generated</div>
                  <img src={result} alt="generated" className="w-full max-h-72 object-contain rounded-lg bg-white" />
                </div>
              )}
            </div>

            <div className="border-t p-4 flex items-center justify-between gap-2 bg-gray-50/60 rounded-b-2xl">
              <button
                type="button"
                onClick={generate}
                disabled={busy || !prompt.trim()}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition"
                data-testid="ai-banner-generate"
              >
                {busy && !saved ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {result ? 'Generate again' : 'Generate'}
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={close} className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-2" data-testid="ai-banner-cancel">Cancel</button>
                {result && (
                  <button
                    type="button"
                    onClick={useThis}
                    disabled={busy}
                    className={`flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition ${saved ? 'bg-green-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                    data-testid="ai-banner-use"
                  >
                    {saved ? <Check size={14} /> : <Upload size={14} />}
                    {saved ? 'Saved' : 'Use this image'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
