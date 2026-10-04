/**
 * ShareButton — wraps the native Web Share API with a clipboard fallback.
 * Call `shareProduct(slug, name)` to get a nice share/copy UX on every device.
 */
export async function shareProduct({ slug, name }) {
  const url = `${window.location.origin}/product/${slug}`;
  const title = name || 'Celesta Glow';
  const text = `Check out ${name || 'this product'} on Celesta Glow`;

  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, text, url });
      return { shared: true };
    }
  } catch (err) {
    // user cancelled share - treat as no-op
    if (err && err.name === 'AbortError') return { shared: false };
  }

  // Fallback: copy to clipboard
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      return { copied: true, url };
    }
    // Ancient-browser fallback
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return { copied: true, url };
  } catch (e) {
    return { copied: false, url };
  }
}
