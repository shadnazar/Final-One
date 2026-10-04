import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Upload, Play, Pause, X, RefreshCw, ChevronLeft, Database,
  CheckCircle2, AlertCircle, Loader2, FileSpreadsheet, Layers, Image as ImageIcon,
} from 'lucide-react';
import { ProductGroupsPanel } from './AdminMasterTools';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_COLOR = {
  queued: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-50 text-blue-700',
  paused: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-700',
  failed: 'bg-rose-50 text-rose-700',
};

const ITEM_BADGE = {
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-50 text-blue-700',
  done: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-rose-50 text-rose-700',
  skipped: 'bg-amber-50 text-amber-700',
};

function ProgressBar({ done, failed, skipped, total }) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  const fpct = total > 0 ? (failed / total) * 100 : 0;
  const spct = total > 0 ? (skipped / total) * 100 : 0;
  return (
    <div className="w-full">
      <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex" data-testid="bulk-progress-bar">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${spct}%` }} />
        <div className="h-full bg-rose-500 transition-all" style={{ width: `${fpct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-600 mt-1.5">
        <span><b>{done.toLocaleString()}</b> done</span>
        <span><b>{skipped.toLocaleString()}</b> skipped</span>
        <span><b>{failed.toLocaleString()}</b> failed</span>
        <span><b>{(done + failed + skipped).toLocaleString()}</b> / {total.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function AdminBulkImport() {
  const navigate = useNavigate();
  const adminToken = sessionStorage.getItem('adminToken');
  const fileRef = useRef(null);

  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [concurrency, setConcurrency] = useState(8);
  const [coverage, setCoverage] = useState(null);
  const [refetching, setRefetching] = useState(false);

  const headers = { 'X-Admin-Token': adminToken };

  // Redirect to admin login if no token
  useEffect(() => {
    if (!adminToken) navigate('/admin');
  }, [adminToken, navigate]);

  const loadJobs = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/bulk-import/jobs`, { headers });
      setJobs(r.data.jobs || []);
    } catch (e) {
      console.error('list jobs failed', e);
    }
  }, [adminToken]);

  const loadActiveJob = useCallback(async (jobId) => {
    if (!jobId) return;
    try {
      const r = await axios.get(`${API}/admin/bulk-import/${jobId}`, { headers });
      setActiveJob(r.data);
    } catch (e) {
      console.error('get job failed', e);
    }
  }, [adminToken]);

  const loadCoverage = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/bulk-import/stats/image-coverage`, { headers });
      setCoverage(r.data);
    } catch (e) {
      console.error('coverage stats failed', e);
    }
  }, [adminToken]);

  const refetchAllImages = async () => {
    if (!window.confirm('Re-fetch images for ALL products currently missing a real image? This runs in the background.')) return;
    setRefetching(true);
    try {
      const r = await axios.post(`${API}/admin/bulk-import/refetch-images?only_needs_image=true&limit=2000`, null, { headers });
      alert(`Queued ${r.data.queued} products for image re-fetch. Refresh coverage in 1-2 min to see progress.`);
    } catch (e) {
      alert('Failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setRefetching(false);
    }
  };

  useEffect(() => { loadJobs(); loadCoverage(); }, [loadJobs, loadCoverage]);

  // Poll active job every 2s while it is running
  useEffect(() => {
    if (!activeJob?.job_id) return;
    const id = setInterval(() => {
      loadActiveJob(activeJob.job_id);
      loadJobs();
      loadCoverage();
    }, 2500);
    return () => clearInterval(id);
  }, [activeJob?.job_id, loadActiveJob, loadJobs, loadCoverage]);

  const handleUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await axios.post(`${API}/admin/bulk-import/upload`, fd, { headers });
      await loadJobs();
      await loadActiveJob(r.data.job.job_id);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  };

  const startJob = async (jobId) => {
    try {
      await axios.post(
        `${API}/admin/bulk-import/${jobId}/start`,
        null,
        { headers, params: { concurrency } }
      );
      loadActiveJob(jobId);
    } catch (e) { alert('Start failed: ' + (e.response?.data?.detail || e.message)); }
  };
  const pauseJob = async (jobId) => {
    try { await axios.post(`${API}/admin/bulk-import/${jobId}/pause`, null, { headers }); loadActiveJob(jobId); }
    catch (e) { alert('Pause failed: ' + e.message); }
  };
  const cancelJob = async (jobId) => {
    if (!window.confirm('Cancel this import? Already-imported products will remain.')) return;
    try { await axios.post(`${API}/admin/bulk-import/${jobId}/cancel`, null, { headers }); loadActiveJob(jobId); }
    catch (e) { alert('Cancel failed: ' + e.message); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-emerald-50/30 to-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard" className="text-stone-600 hover:text-stone-900" data-testid="bulk-back-dashboard">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Bulk Product Import</h1>
              <p className="text-sm text-stone-600 mt-0.5">
                Upload Excel · auto-enrich · auto-categorize · band-margin pricing
              </p>
            </div>
          </div>
          <button
            onClick={loadJobs}
            className="px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg flex items-center gap-2"
            data-testid="bulk-refresh-btn"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Upload card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-7 shadow-sm">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-7 h-7 text-emerald-700" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-stone-900">Upload pricing workbook</h2>
              <p className="text-sm text-stone-600 mt-1 max-w-2xl">
                Drop an .xlsx with one sheet per brand. Each row must have <i>Item Name, MRP, Dealer Price,
                Applied Margin %, Website Listing Price</i>. The system parses every sheet, then enriches each
                product (description, ingredients, niche, category) using brand-site scraping + Claude Sonnet.
              </p>
              <div className="mt-5 flex items-center gap-4 flex-wrap">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleUpload}
                  data-testid="bulk-file-input"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="px-5 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 disabled:opacity-60 flex items-center gap-2 font-medium shadow-sm"
                  data-testid="bulk-upload-btn"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Parsing…' : 'Upload Excel'}
                </button>
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-stone-700 font-medium">Worker concurrency</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={concurrency}
                    onChange={(e) => setConcurrency(Math.max(1, Math.min(20, parseInt(e.target.value || '5'))))}
                    className="w-16 px-2 py-1 border border-stone-300 rounded text-center"
                    data-testid="bulk-concurrency-input"
                  />
                  <span className="text-xs text-stone-500">parallel LLM calls</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Groups editor — 80 products per group, inline rename,
            and one-click product edit. Sits right beneath the upload card so
            admin can manage what they just imported without leaving the page. */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm" data-testid="bulk-import-groups-section">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Layers className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Product Groups (80 per group)</h2>
              <p className="text-sm text-stone-600 mt-1">
                Imported products are auto-bucketed into groups of 80 per niche. Rename a group, click any
                product to edit it (name, brand, tagline, description, ingredients, stock, size), or use the
                URL Analyze + Fill-with-AI shortcuts inside the editor.
              </p>
            </div>
          </div>
          <ProductGroupsPanel />
        </div>

        {/* Image coverage panel */}
        {coverage && coverage.total > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm" data-testid="image-coverage-panel">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-6 h-6 text-violet-700" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-stone-900">Image coverage</h3>
                  <p className="text-sm text-stone-600 mt-0.5">
                    <span className="text-emerald-700 font-semibold" data-testid="coverage-verified">{coverage.verified_brand_images.toLocaleString()}</span>
                    {' '}of <span className="font-semibold">{coverage.total.toLocaleString()}</span> products have verified brand-site images
                    {' '}({coverage.total > 0 ? Math.round((coverage.verified_brand_images / coverage.total) * 100) : 0}%).
                    {' '}<span className="text-amber-700 font-semibold" data-testid="coverage-manual">{coverage.needs_manual_upload.toLocaleString()}</span> need manual upload.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {coverage.by_source.map((s) => (
                      <span
                        key={s.source}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          s.source === 'brand-site' ? 'bg-emerald-50 text-emerald-700'
                          : s.source === 'needs_manual' ? 'bg-amber-50 text-amber-700'
                          : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {s.source}: {s.count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={refetchAllImages}
                disabled={refetching || coverage.needs_manual_upload === 0}
                className="px-4 py-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white rounded-xl font-medium text-sm flex items-center gap-2 shadow-sm"
                data-testid="refetch-images-btn"
              >
                {refetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Re-fetch missing images ({coverage.needs_manual_upload})
              </button>
            </div>
          </div>
        )}

        {/* Active job card */}
        {activeJob && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden" data-testid="bulk-active-job">
            <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-stone-900 truncate" data-testid="active-job-filename">
                    {activeJob.filename}
                  </h3>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${STATUS_COLOR[activeJob.status] || 'bg-gray-100 text-gray-600'}`} data-testid="active-job-status">
                    {activeJob.status}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Job ID: <span className="font-mono">{activeJob.job_id}</span> · Created {new Date(activeJob.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {['queued', 'paused'].includes(activeJob.status) && (
                  <button
                    onClick={() => startJob(activeJob.job_id)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium flex items-center gap-1.5 text-sm"
                    data-testid="bulk-start-btn"
                  >
                    <Play className="w-4 h-4" /> {activeJob.status === 'paused' ? 'Resume' : 'Start'}
                  </button>
                )}
                {activeJob.status === 'running' && (
                  <button
                    onClick={() => pauseJob(activeJob.job_id)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium flex items-center gap-1.5 text-sm"
                    data-testid="bulk-pause-btn"
                  >
                    <Pause className="w-4 h-4" /> Pause
                  </button>
                )}
                {!['completed', 'cancelled'].includes(activeJob.status) && (
                  <button
                    onClick={() => cancelJob(activeJob.job_id)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-medium flex items-center gap-1.5 text-sm"
                    data-testid="bulk-cancel-btn"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              <ProgressBar
                done={activeJob.done || 0}
                failed={activeJob.failed || 0}
                skipped={activeJob.skipped || 0}
                total={activeJob.total || 0}
              />

              {activeJob.brand_counts && (
                <div>
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Brands in this import ({Object.keys(activeJob.brand_counts).length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(activeJob.brand_counts).map(([b, n]) => (
                      <span key={b} className="px-2 py-1 bg-stone-100 text-stone-700 rounded text-xs font-medium">
                        {b} <span className="text-stone-500">×{n}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {activeJob.items && activeJob.items.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Latest activity</h4>
                  <div className="space-y-1.5 max-h-96 overflow-auto border border-stone-100 rounded-lg" data-testid="bulk-items-feed">
                    {[...activeJob.items].reverse().map((it) => (
                      <div key={it.idx} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-stone-50">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${ITEM_BADGE[it.status]}`}>
                          {it.status === 'processing' && <Loader2 className="w-3 h-3 inline animate-spin mr-1" />}
                          {it.status === 'done' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                          {it.status === 'failed' && <AlertCircle className="w-3 h-3 inline mr-1" />}
                          {it.status}
                        </span>
                        <span className="text-stone-500 text-xs font-mono w-12 flex-shrink-0">#{it.idx}</span>
                        <span className="text-stone-700 font-medium text-xs truncate w-32 flex-shrink-0">{it.brand}</span>
                        <span className="text-stone-900 flex-1 truncate">{it.name}</span>
                        <span className="text-emerald-700 text-xs font-mono">₹{it.listing_price}</span>
                        {it.slug && <span className="text-stone-400 text-xs font-mono truncate max-w-[160px]">{it.slug}</span>}
                        {it.error && <span className="text-rose-600 text-xs truncate max-w-[160px]" title={it.error}>{it.error}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Past jobs */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-stone-500" />
            <h3 className="text-base font-semibold text-stone-900">All import jobs</h3>
            <span className="text-sm text-stone-500">({jobs.length})</span>
          </div>
          {jobs.length === 0 ? (
            <p className="text-sm text-stone-500 py-8 text-center">No imports yet. Upload an Excel file above to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="bulk-jobs-table">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-stone-500 border-b border-stone-200">
                    <th className="py-2 pr-3">File</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Progress</th>
                    <th className="py-2 px-3 text-right">Done / Failed / Skipped</th>
                    <th className="py-2 px-3">Created</th>
                    <th className="py-2 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {jobs.map((j) => {
                    const pct = j.total ? Math.round(((j.done + j.failed + j.skipped) / j.total) * 100) : 0;
                    return (
                      <tr key={j.job_id} className="hover:bg-stone-50 transition" data-testid={`bulk-job-row-${j.job_id}`}>
                        <td className="py-3 pr-3">
                          <div className="font-medium text-stone-900">{j.filename}</div>
                          <div className="text-xs text-stone-500 font-mono">{j.job_id}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-1 text-[11px] font-semibold rounded uppercase ${STATUS_COLOR[j.status] || 'bg-gray-100 text-gray-600'}`}>
                            {j.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">{pct}%</td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          <span className="text-emerald-700">{j.done}</span>
                          <span className="text-stone-400 mx-0.5">/</span>
                          <span className="text-rose-600">{j.failed}</span>
                          <span className="text-stone-400 mx-0.5">/</span>
                          <span className="text-amber-600">{j.skipped}</span>
                          <span className="text-stone-400 mx-0.5">of</span>
                          <span className="text-stone-700">{j.total}</span>
                        </td>
                        <td className="py-3 px-3 text-stone-600 text-xs">
                          {new Date(j.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <button
                            onClick={() => loadActiveJob(j.job_id)}
                            className="px-3 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 rounded-lg font-medium"
                            data-testid={`bulk-job-open-${j.job_id}`}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
