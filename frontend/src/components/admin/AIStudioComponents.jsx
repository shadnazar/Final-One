/**
 * AI Studio Components - Extracted from AdminAIStudio.js
 * Modular components for the AI content generation studio
 */
import React, { memo } from 'react';
import { 
  Zap, Check, Loader2, Timer, RefreshCw, Globe, Tag, AlertCircle,
  FileText, MapPin, Lightbulb, TrendingUp, Copy, Save
} from 'lucide-react';

// Mode Tab Button
export const ModeTab = memo(function ModeTab({ mode, activeMode, setActiveMode, icon: Icon, label, colorClass, onClick }) {
  const isActive = activeMode === mode;
  return (
    <button
      onClick={onClick || (() => setActiveMode(mode))}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
        isActive 
          ? `${colorClass} text-white` 
          : 'bg-white text-gray-600 border border-gray-200'
      }`}
      data-testid={`tab-${mode}`}
    >
      <Icon size={18} /> {label}
    </button>
  );
});

// Cron Status Timer Card
export const CronStatusCard = memo(function CronStatusCard({ cronStatus, countdown, onRefresh }) {
  if (!cronStatus) return null;
  
  return (
    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 mb-6 text-white">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <p className="text-indigo-100 text-sm">Next: {cronStatus.next_run_type || 'Auto-Generation'}</p>
            <p className="text-2xl font-bold">{countdown || cronStatus.time_until_next_formatted}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-indigo-100 text-sm">{cronStatus.schedule}</p>
          <div className="flex items-center gap-4 mt-2">
            <div>
              <p className="text-xl font-bold">{cronStatus.today_blogs_generated}</p>
              <p className="text-xs text-indigo-200">Today</p>
            </div>
            <div>
              <p className="text-xl font-bold">{cronStatus.total_blogs}</p>
              <p className="text-xs text-indigo-200">Total</p>
            </div>
            <div>
              <p className="text-xl font-bold">{cronStatus.blogs_per_run}</p>
              <p className="text-xs text-indigo-200">Per Run</p>
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={onRefresh}
        className="mt-3 text-sm text-indigo-200 hover:text-white flex items-center gap-1"
      >
        <RefreshCw size={14} /> Refresh Status
      </button>
    </div>
  );
});

// Auto Generate Section
export const AutoGenerateSection = memo(function AutoGenerateSection({ 
  blogCount, 
  setBlogCount, 
  onGenerate, 
  generating, 
  result 
}) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Auto Blog Generator</h2>
            <p className="text-green-100 text-sm">Generate 12 SEO-optimized beauty blogs instantly</p>
          </div>
        </div>
        
        <div className="bg-white/10 rounded-xl p-4 mb-4">
          <p className="text-sm text-green-100 mb-3">What you'll get:</p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Check size={16} /> 12 unique, trending beauty topics
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} /> SEO-optimized titles & meta descriptions
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} /> Location-targeted content for Indian audience
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} /> Auto-published to your blog
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} /> Conversion-optimized with product mentions
            </li>
          </ul>
        </div>
        
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm">Number of blogs:</label>
          <select
            value={blogCount}
            onChange={(e) => setBlogCount(parseInt(e.target.value))}
            className="bg-white/20 border-0 rounded-lg px-3 py-2 text-white"
          >
            <option value="6">6 blogs</option>
            <option value="12">12 blogs</option>
          </select>
        </div>
        
        <button
          onClick={onGenerate}
          disabled={generating}
          className="w-full py-4 bg-white text-green-600 font-bold rounded-xl hover:bg-green-50 disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="auto-generate-btn"
        >
          {generating ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Generating {blogCount} blogs... (This may take a few minutes)
            </>
          ) : (
            <>
              <Zap size={20} />
              Generate {blogCount} Blogs Now
            </>
          )}
        </button>
      </div>
      
      {/* Auto Result */}
      {result && (
        <AutoGenerateResult result={result} />
      )}
    </div>
  );
});

// Auto Generate Result
export const AutoGenerateResult = memo(function AutoGenerateResult({ result }) {
  if (!result) return null;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Check className="text-green-500" size={24} />
        <h3 className="font-bold text-gray-900">Generation Complete!</h3>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{result.successful}</p>
          <p className="text-sm text-gray-600">Successful</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{result.failed}</p>
          <p className="text-sm text-gray-600">Failed</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{result.skipped || 0}</p>
          <p className="text-sm text-gray-600">Skipped</p>
        </div>
      </div>
      
      {result.generated_blogs && result.generated_blogs.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-gray-700 mb-2">Generated Blogs:</p>
          {result.generated_blogs.map((blog, idx) => (
            <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm">
              <p className="font-medium text-gray-800">{blog.title}</p>
              <p className="text-gray-500 text-xs">{blog.slug}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// Location Batch Section
export const LocationBatchSection = memo(function LocationBatchSection({
  selectedStates,
  setSelectedStates,
  onGenerate,
  generating,
  result
}) {
  const indianStates = [
    'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat',
    'Rajasthan', 'West Bengal', 'Uttar Pradesh', 'Kerala', 'Telangana',
    'Andhra Pradesh', 'Punjab', 'Madhya Pradesh', 'Bihar', 'Haryana'
  ];
  
  const toggleState = (state) => {
    setSelectedStates(prev => 
      prev.includes(state) 
        ? prev.filter(s => s !== state)
        : [...prev, state]
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Location-Based Blogs</h2>
            <p className="text-blue-100 text-sm">Generate SEO blogs targeting specific Indian states</p>
          </div>
        </div>
        
        <div className="bg-white/10 rounded-xl p-4 mb-4">
          <p className="text-sm text-blue-100 mb-3">Select states to target:</p>
          <div className="flex flex-wrap gap-2">
            {indianStates.map(state => (
              <button
                key={state}
                onClick={() => toggleState(state)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedStates.includes(state)
                    ? 'bg-white text-blue-600'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {state}
              </button>
            ))}
          </div>
        </div>
        
        <p className="text-sm text-blue-200 mb-4">
          Selected: {selectedStates.length} state{selectedStates.length !== 1 ? 's' : ''}
        </p>
        
        <button
          onClick={onGenerate}
          disabled={generating || selectedStates.length === 0}
          className="w-full py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="location-generate-btn"
        >
          {generating ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Generating location blogs...
            </>
          ) : (
            <>
              <Globe size={20} />
              Generate Location Blogs
            </>
          )}
        </button>
      </div>
      
      {result && <BatchResult result={result} />}
    </div>
  );
});

// Topic Batch Section
export const TopicBatchSection = memo(function TopicBatchSection({
  customTopics,
  setCustomTopics,
  onGenerate,
  generating,
  result,
  onLoadTrending,
  loadingTopics
}) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Topic-Based Blogs</h2>
            <p className="text-orange-100 text-sm">Generate blogs on specific topics</p>
          </div>
        </div>
        
        <div className="bg-white/10 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-orange-100">Enter topics (one per line):</p>
            <button
              onClick={onLoadTrending}
              disabled={loadingTopics}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg flex items-center gap-1"
            >
              {loadingTopics ? <Loader2 size={12} className="animate-spin" /> : <TrendingUp size={12} />}
              Load AI Suggestions
            </button>
          </div>
          <textarea
            value={customTopics}
            onChange={(e) => setCustomTopics(e.target.value)}
            rows={6}
            className="w-full bg-white/20 border-0 rounded-lg p-3 text-white placeholder-orange-200"
            placeholder="Best anti-aging serums in 2026&#10;How to reduce wrinkles naturally&#10;Retinol benefits for Indian skin"
          />
        </div>
        
        <button
          onClick={onGenerate}
          disabled={generating || !customTopics.trim()}
          className="w-full py-4 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="topic-generate-btn"
        >
          {generating ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Generating topic blogs...
            </>
          ) : (
            <>
              <Tag size={20} />
              Generate Topic Blogs
            </>
          )}
        </button>
      </div>
      
      {result && <BatchResult result={result} />}
    </div>
  );
});

// Batch Result Component (shared by location and topic)
export const BatchResult = memo(function BatchResult({ result }) {
  if (!result) return null;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Check className="text-green-500" size={24} />
        <h3 className="font-bold text-gray-900">Batch Generation Complete!</h3>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{result.successful || result.generated?.length || 0}</p>
          <p className="text-sm text-gray-600">Successful</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{result.failed || 0}</p>
          <p className="text-sm text-gray-600">Failed</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-yellow-600">{result.skipped || 0}</p>
          <p className="text-sm text-gray-600">Skipped</p>
        </div>
      </div>
      
      {result.generated && result.generated.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-gray-700 mb-2">Generated:</p>
          {result.generated.slice(0, 5).map((item, idx) => (
            <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm">
              <p className="font-medium text-gray-800">{item.title || item}</p>
            </div>
          ))}
          {result.generated.length > 5 && (
            <p className="text-gray-500 text-sm">...and {result.generated.length - 5} more</p>
          )}
        </div>
      )}
    </div>
  );
});

// Credit Warning Banner
export const CreditWarning = memo(function CreditWarning() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-amber-800">Credit Usage Warning</p>
        <p className="text-sm text-amber-700">Each AI generation uses credits. Use sparingly for best ROI.</p>
      </div>
    </div>
  );
});

// Generation History List
export const GenerationHistory = memo(function GenerationHistory({ history }) {
  if (!history || history.length === 0) return null;
  
  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <FileText size={20} />
        Recent Generations
      </h3>
      <div className="space-y-3">
        {history.slice(0, 10).map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium text-gray-800 text-sm">{item.title || item.type}</p>
              <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</p>
            </div>
            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
              item.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
