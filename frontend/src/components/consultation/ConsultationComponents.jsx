/**
 * Consultation Page Components - Extracted for cleaner code
 * Contains UI components for the skin consultation flow
 */
import React, { memo, useRef } from 'react';
import { 
  ChevronRight, ChevronLeft, Check, Camera, X, Phone, 
  Download, Sun, Droplets, Sparkles, Heart, Dumbbell,
  AlertCircle, Shield, Star, Clock, Home
} from 'lucide-react';

// Landing Hero Section
export const ConsultationLanding = memo(function ConsultationLanding({ 
  t, 
  onStart, 
  languages, 
  language, 
  setLanguage 
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Language Selector */}
      <div className="flex justify-end p-4">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          {languages.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div className="px-5 pt-8 pb-20 text-center">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{t.title}</h1>
        <p className="text-gray-600 mb-8">{t.subtitle}</p>
        
        {/* Trust Badges */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white p-3 rounded-xl shadow-sm">
            <Clock className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <p className="text-xs text-gray-600">60 Seconds</p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm">
            <Shield className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-xs text-gray-600">100% Free</p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm">
            <Star className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-xs text-gray-600">AI Powered</p>
          </div>
        </div>
        
        <button
          onClick={onStart}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          data-testid="start-consultation-btn"
        >
          {t.start}
          <ChevronRight size={20} />
        </button>
        
        <p className="text-xs text-gray-500 mt-4">Trusted by 10,000+ customers</p>
      </div>
    </div>
  );
});

// Question Card Component
export const QuestionCard = memo(function QuestionCard({ 
  question, 
  answers, 
  onAnswer, 
  currentIndex, 
  totalQuestions,
  onNext,
  onBack,
  t
}) {
  const selectedValue = answers[question.id];
  const isMultiple = question.type === 'multiple';
  const selectedArray = isMultiple ? (selectedValue || []) : [];
  
  return (
    <div className="min-h-screen bg-white">
      {/* Progress Bar */}
      <div className="h-1 bg-gray-100">
        <div 
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
        />
      </div>
      
      <div className="px-5 py-8">
        <p className="text-sm text-gray-500 mb-2">
          Question {currentIndex + 1} of {totalQuestions}
        </p>
        
        <h2 className="text-xl font-bold text-gray-900 mb-6">{question.text}</h2>
        
        <div className="space-y-3">
          {question.options.map((option, idx) => {
            const isSelected = isMultiple 
              ? selectedArray.includes(option.value)
              : selectedValue === option.value;
            
            return (
              <button
                key={`${question.id}-option-${idx}`}
                onClick={() => onAnswer(question.id, option.value, isMultiple)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
                data-testid={`option-${question.id}-${idx}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">{option.label}</span>
                  {isSelected && (
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {currentIndex > 0 && (
            <button
              onClick={onBack}
              className="flex-1 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl flex items-center justify-center gap-2"
            >
              <ChevronLeft size={18} /> {t.back}
            </button>
          )}
          <button
            onClick={onNext}
            disabled={!selectedValue && (!isMultiple || selectedArray.length === 0)}
            className="flex-1 py-3 bg-purple-500 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="next-question-btn"
          >
            {t.next} <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
});

// Photo Upload Section
export const PhotoUploadSection = memo(function PhotoUploadSection({
  t,
  faceImages,
  onUpload,
  onRemove,
  onNext,
  onBack,
  uploadError
}) {
  const fileInputRef = useRef(null);
  const [uploadType, setUploadType] = React.useState(null);
  
  const handleFileSelect = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      onUpload(file, type);
    }
  };
  
  const triggerUpload = (type) => {
    setUploadType(type);
    fileInputRef.current?.click();
  };
  
  const hasAtLeastOnePhoto = faceImages.front || faceImages.left || faceImages.right;
  
  return (
    <div className="min-h-screen bg-white">
      <div className="px-5 py-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t.uploadTitle}</h2>
        <p className="text-gray-500 text-sm mb-6">{t.uploadSubtitle}</p>
        
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="user"
          onChange={(e) => handleFileSelect(e, uploadType)}
          className="hidden"
        />
        
        <div className="grid grid-cols-3 gap-3 mb-6">
          {['front', 'left', 'right'].map((type) => (
            <div key={type} className="relative">
              {faceImages[type] ? (
                <div className="relative aspect-square rounded-xl overflow-hidden">
                  <img 
                    src={faceImages[type]} 
                    alt={`${type} face`} 
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => onRemove(type)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => triggerUpload(type)}
                  className="aspect-square w-full border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-purple-400 transition-colors"
                >
                  <Camera size={24} className="text-gray-400" />
                  <span className="text-xs text-gray-500">
                    {type === 'front' ? t.uploadFront : type === 'left' ? t.uploadLeft : t.uploadRight}
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>
        
        {uploadError && (
          <p className="text-red-500 text-sm mb-4 flex items-center gap-1">
            <AlertCircle size={14} /> {uploadError}
          </p>
        )}
        
        {!hasAtLeastOnePhoto && (
          <p className="text-amber-600 text-sm mb-4 flex items-center gap-1">
            <AlertCircle size={14} /> {t.photoRequired}
          </p>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl flex items-center justify-center gap-2"
          >
            <ChevronLeft size={18} /> {t.back}
          </button>
          <button
            onClick={onNext}
            disabled={!hasAtLeastOnePhoto}
            className="flex-1 py-3 bg-purple-500 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="continue-after-upload-btn"
          >
            {t.next} <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
});

// Phone Input Section
export const PhoneInputSection = memo(function PhoneInputSection({
  t,
  phone,
  setPhone,
  phoneError,
  onSubmit,
  onBack,
  loading
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="px-5 py-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center mb-4">
            <Phone className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t.phoneTitle}</h2>
          <p className="text-gray-500 text-sm">{t.phoneSubtitle}</p>
        </div>
        
        <div className="mb-6">
          <div className="flex border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-purple-500">
            <span className="bg-gray-50 px-4 py-3 text-gray-500 border-r border-gray-200">+91</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder={t.phonePlaceholder}
              className="flex-1 px-4 py-3 outline-none"
              data-testid="phone-input"
            />
          </div>
          {phoneError && (
            <p className="text-red-500 text-sm mt-2">{phoneError}</p>
          )}
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl flex items-center justify-center gap-2"
          >
            <ChevronLeft size={18} /> {t.back}
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || phone.length !== 10}
            className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="view-results-btn"
          >
            {loading ? 'Analyzing...' : t.viewResults}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
});

// Analyzing Animation Section
export const AnalyzingSection = memo(function AnalyzingSection({
  progress,
  analyzeText
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 to-pink-600 flex items-center justify-center">
      <div className="text-center text-white px-8">
        <div className="w-24 h-24 mx-auto mb-6 relative">
          <div className="absolute inset-0 border-4 border-white/30 rounded-full" />
          <div 
            className="absolute inset-0 border-4 border-white rounded-full border-t-transparent animate-spin"
            style={{ animationDuration: '1s' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold">{progress}%</span>
          </div>
        </div>
        <p className="text-lg font-medium mb-2">Analyzing Your Skin...</p>
        <p className="text-white/80 text-sm">{analyzeText}</p>
      </div>
    </div>
  );
});

// Result Section Components
export const AgingScoreCard = memo(function AgingScoreCard({ score, level, t }) {
  const getColor = () => {
    if (score <= 3) return 'from-green-400 to-green-500';
    if (score <= 6) return 'from-yellow-400 to-orange-500';
    return 'from-red-400 to-pink-500';
  };
  
  return (
    <div className={`bg-gradient-to-r ${getColor()} rounded-2xl p-6 text-white mb-6`}>
      <p className="text-sm opacity-90 mb-1">{t.agingLevel}</p>
      <div className="flex items-end gap-3">
        <span className="text-5xl font-bold">{score}</span>
        <span className="text-xl mb-1">/10</span>
      </div>
      <p className="text-lg font-medium mt-2">
        {level === 'low' ? t.low : level === 'moderate' ? t.moderate : t.high}
      </p>
    </div>
  );
});

export const RoutineCard = memo(function RoutineCard({ title, icon: Icon, items, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-bold text-gray-900">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
            <Check size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});

export const ProductRecommendation = memo(function ProductRecommendation({
  t,
  onBuyNow,
  onDownloadPdf
}) {
  return (
    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-5 text-white">
      <h3 className="font-bold text-lg mb-3">{t.productRec}</h3>
      <p className="text-green-100 text-sm mb-4">
        Based on your skin analysis, Celesta Glow's Complete Anti-Aging Kit is perfect for you.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onDownloadPdf}
          className="flex-1 py-3 bg-white/20 text-white font-medium rounded-xl flex items-center justify-center gap-2"
        >
          <Download size={18} /> {t.downloadPdf}
        </button>
        <button
          onClick={onBuyNow}
          className="flex-1 py-3 bg-white text-green-600 font-semibold rounded-xl flex items-center justify-center gap-2"
          data-testid="buy-now-from-results"
        >
          {t.buyNow} <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
});
