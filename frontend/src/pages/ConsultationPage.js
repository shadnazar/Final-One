import React, { useState, useEffect, useRef } from 'react';
import BackButton from '../components/BackButton';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import { 
  ChevronRight, ChevronLeft, Check, Camera, X, Phone, 
  Download, Sun, Droplets, Sparkles, Heart, Dumbbell,
  AlertCircle, Shield, Star, Clock, Home
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// SEO Meta Data for Skin Analysis Page
const SEO_DATA = {
  title: "Book a Free Skincare Consultation | Celesta Glow | Kerala",
  description: "Discover Celesta Glow, Kerala's dermatologist-recommended skin care brand offering dermatologist-approved skincare and clean vegan skin care.",
  keywords: "dermatologist recommended skin care brand, dermatologist approved skin care, vegan skin care kerala, best skin care products recommended by dermatologists, kerala skincare consultation, free skin analysis, personalized skincare routine",
  canonical: "https://celestaglow.com/consultation",
  ogImage: "https://celestaglow.com/og-skin-analysis.jpg"
};

// Language options - Main Indian languages
const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
  { code: 'ml', label: 'മലയാളം', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'bn', label: 'বাংলা', flag: '🇮🇳' },
  { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
];

// UI Text translations
const UI_TEXT = {
  en: {
    title: "Free Skin Consultation",
    subtitle: "Get personalized skincare recommendations in 60 seconds",
    start: "Start Consultation",
    next: "Next",
    back: "Back",
    skip: "Skip",
    uploadTitle: "Upload Your Photo",
    uploadSubtitle: "Required: Upload at least one photo for accurate skin analysis",
    uploadFront: "Front Face",
    uploadLeft: "Left Side",
    uploadRight: "Right Side",
    phoneTitle: "Almost Done!",
    phoneSubtitle: "Enter your mobile number to view your personalized results",
    phonePlaceholder: "Enter 10-digit number",
    viewResults: "View My Results",
    resultTitle: "Your Personalized Skin Analysis",
    agingLevel: "Aging Level",
    causes: "What's Causing Your Skin Concerns",
    morningRoutine: "Morning Routine",
    nightRoutine: "Night Routine",
    rules: "Important Rules",
    diet: "Diet Tips",
    exercise: "Exercise Tips",
    productRec: "Your Recommended Solution",
    downloadPdf: "Download Report",
    buyNow: "Buy Now",
    low: "Low",
    moderate: "Moderate",
    high: "High",
    photoRequired: "Please upload at least one photo to continue"
  },
  hi: {
    title: "मुफ्त त्वचा परामर्श",
    subtitle: "60 सेकंड में व्यक्तिगत स्किनकेयर सलाह पाएं",
    start: "परामर्श शुरू करें",
    next: "अगला",
    back: "वापस",
    skip: "छोड़ें",
    uploadTitle: "अपनी फोटो अपलोड करें",
    uploadSubtitle: "आवश्यक: सटीक त्वचा विश्लेषण के लिए कम से कम एक फोटो अपलोड करें",
    uploadFront: "सामने का चेहरा",
    uploadLeft: "बाईं तरफ",
    uploadRight: "दाईं तरफ",
    phoneTitle: "लगभग हो गया!",
    phoneSubtitle: "अपने व्यक्तिगत परिणाम देखने के लिए मोबाइल नंबर दर्ज करें",
    phonePlaceholder: "10 अंकों का नंबर दर्ज करें",
    viewResults: "मेरे परिणाम देखें",
    resultTitle: "आपका व्यक्तिगत त्वचा विश्लेषण",
    agingLevel: "उम्र बढ़ने का स्तर",
    causes: "आपकी त्वचा की समस्याओं का कारण",
    morningRoutine: "सुबह की दिनचर्या",
    nightRoutine: "रात की दिनचर्या",
    rules: "महत्वपूर्ण नियम",
    diet: "आहार सुझाव",
    exercise: "व्यायाम सुझाव",
    productRec: "आपका अनुशंसित समाधान",
    downloadPdf: "रिपोर्ट डाउनलोड करें",
    buyNow: "अभी खरीदें",
    low: "कम",
    moderate: "मध्यम",
    high: "उच्च"
  },
  ml: {
    title: "സൗജന്യ ത്വക്ക് കൺസൾട്ടേഷൻ",
    subtitle: "60 സെക്കൻഡിൽ വ്യക്തിഗത സ്കിൻകെയർ ശുപാർശകൾ നേടുക",
    start: "കൺസൾട്ടേഷൻ ആരംഭിക്കുക",
    next: "അടുത്തത്",
    back: "തിരികെ",
    skip: "ഒഴിവാക്കുക",
    uploadTitle: "നിങ്ങളുടെ ഫോട്ടോകൾ അപ്‌ലോഡ് ചെയ്യുക",
    uploadSubtitle: "ഓപ്ഷണൽ: നിങ്ങളുടെ ത്വക്ക് നന്നായി മനസ്സിലാക്കാൻ സഹായിക്കുക",
    uploadFront: "മുൻഭാഗം",
    uploadLeft: "ഇടത് വശം",
    uploadRight: "വലത് വശം",
    phoneTitle: "ഏതാണ്ട് പൂർത്തിയായി!",
    phoneSubtitle: "നിങ്ങളുടെ ഫലങ്ങൾ കാണാൻ മൊബൈൽ നമ്പർ നൽകുക",
    phonePlaceholder: "10 അക്ക നമ്പർ നൽകുക",
    viewResults: "എന്റെ ഫലങ്ങൾ കാണുക",
    resultTitle: "നിങ്ങളുടെ വ്യക്തിഗത ത്വക്ക് വിശകലനം",
    agingLevel: "പ്രായമാകൽ നില",
    causes: "നിങ്ങളുടെ ത്വക്ക് പ്രശ്നങ്ങളുടെ കാരണം",
    morningRoutine: "രാവിലെ ദിനചര്യ",
    nightRoutine: "രാത്രി ദിനചര്യ",
    rules: "പ്രധാന നിയമങ്ങൾ",
    diet: "ഭക്ഷണ നിർദ്ദേശങ്ങൾ",
    exercise: "വ്യായാമ നിർദ്ദേശങ്ങൾ",
    productRec: "നിങ്ങൾക്ക് ശുപാർശ ചെയ്യുന്ന പരിഹാരം",
    downloadPdf: "റിപ്പോർട്ട് ഡൗൺലോഡ് ചെയ്യുക",
    buyNow: "ഇപ്പോൾ വാങ്ങുക",
    low: "കുറവ്",
    moderate: "മിതമായ",
    high: "ഉയർന്ന"
  },
  // Tamil - basic support (falls back to English for detailed text)
  ta: {
    title: "இலவச தோல் ஆலோசனை",
    subtitle: "60 வினாடிகளில் தனிப்பயனாக்கப்பட்ட பரிந்துரைகள்",
    start: "ஆலோசனையைத் தொடங்கு",
    next: "அடுத்து",
    back: "பின்",
    skip: "தவிர்",
    uploadTitle: "உங்கள் புகைப்படங்களை பதிவேற்றவும்",
    uploadSubtitle: "விருப்பம்: உங்கள் தோலை நன்கு புரிந்துகொள்ள உதவுங்கள்",
    uploadFront: "முன் முகம்",
    uploadLeft: "இடது பக்கம்",
    uploadRight: "வலது பக்கம்",
    phoneTitle: "கிட்டத்தட்ட முடிந்தது!",
    phoneSubtitle: "உங்கள் முடிவுகளைப் பார்க்க மொபைல் எண்ணை உள்ளிடவும்",
    phonePlaceholder: "10 இலக்க எண்ணை உள்ளிடவும்",
    viewResults: "எனது முடிவுகளைக் காண்க",
    resultTitle: "உங்கள் தோல் பகுப்பாய்வு",
    agingLevel: "வயதான நிலை",
    causes: "காரணங்கள்",
    morningRoutine: "காலை வழக்கம்",
    nightRoutine: "இரவு வழக்கம்",
    rules: "முக்கிய விதிகள்",
    diet: "உணவு குறிப்புகள்",
    exercise: "உடற்பயிற்சி குறிப்புகள்",
    productRec: "பரிந்துரைக்கப்பட்ட தீர்வு",
    downloadPdf: "அறிக்கையைப் பதிவிறக்கு",
    buyNow: "இப்போது வாங்கு",
    low: "குறைவு",
    moderate: "மிதமான",
    high: "உயர்ந்த"
  },
  // Telugu - basic support
  te: {
    title: "ఉచిత చర్మ సంప్రదింపు",
    subtitle: "60 సెకన్లలో వ్యక్తిగత సిఫార్సులు",
    start: "సంప్రదింపును ప్రారంభించండి",
    next: "తదుపరి",
    back: "వెనుకకు",
    skip: "దాటవేయి",
    uploadTitle: "మీ ఫోటోలను అప్‌లోడ్ చేయండి",
    uploadSubtitle: "ఐచ్ఛికం: మీ చర్మాన్ని అర్థం చేసుకోవడానికి సహాయపడండి",
    uploadFront: "ముందు ముఖం",
    uploadLeft: "ఎడమ వైపు",
    uploadRight: "కుడి వైపు",
    phoneTitle: "దాదాపు పూర్తయింది!",
    phoneSubtitle: "మీ ఫలితాలను చూడటానికి మొబైల్ నంబర్ నమోదు చేయండి",
    phonePlaceholder: "10 అంకెల నంబర్ నమోదు చేయండి",
    viewResults: "నా ఫలితాలను చూడండి",
    resultTitle: "మీ చర్మ విశ్లేషణ",
    agingLevel: "వృద్ధాప్య స్థాయి",
    causes: "కారణాలు",
    morningRoutine: "ఉదయం దినచర్య",
    nightRoutine: "రాత్రి దినచర్య",
    rules: "ముఖ్యమైన నియమాలు",
    diet: "ఆహార చిట్కాలు",
    exercise: "వ్యాయామ చిట్కాలు",
    productRec: "సిఫార్సు చేసిన పరిష్కారం",
    downloadPdf: "నివేదికను డౌన్‌లోడ్ చేయండి",
    buyNow: "ఇప్పుడు కొనండి",
    low: "తక్కువ",
    moderate: "మధ్యస్థం",
    high: "అధిక"
  },
  // Bengali - basic support
  bn: {
    title: "বিনামূল্যে ত্বক পরামর্শ",
    subtitle: "60 সেকেন্ডে ব্যক্তিগত সুপারিশ",
    start: "পরামর্শ শুরু করুন",
    next: "পরবর্তী",
    back: "পিছনে",
    skip: "এড়িয়ে যান",
    uploadTitle: "আপনার ছবি আপলোড করুন",
    uploadSubtitle: "ঐচ্ছিক: আপনার ত্বক বুঝতে সাহায্য করুন",
    uploadFront: "সামনের মুখ",
    uploadLeft: "বাম দিক",
    uploadRight: "ডান দিক",
    phoneTitle: "প্রায় শেষ!",
    phoneSubtitle: "আপনার ফলাফল দেখতে মোবাইল নম্বর লিখুন",
    phonePlaceholder: "10 সংখ্যার নম্বর লিখুন",
    viewResults: "আমার ফলাফল দেখুন",
    resultTitle: "আপনার ত্বক বিশ্লেষণ",
    agingLevel: "বার্ধক্যের স্তর",
    causes: "কারণসমূহ",
    morningRoutine: "সকালের রুটিন",
    nightRoutine: "রাতের রুটিন",
    rules: "গুরুত্বপূর্ণ নিয়ম",
    diet: "খাদ্য টিপস",
    exercise: "ব্যায়াম টিপস",
    productRec: "প্রস্তাবিত সমাধান",
    downloadPdf: "রিপোর্ট ডাউনলোড করুন",
    buyNow: "এখনই কিনুন",
    low: "কম",
    moderate: "মাঝারি",
    high: "উচ্চ"
  },
  // Kannada - basic support
  kn: {
    title: "ಉಚಿತ ಚರ್ಮ ಸಮಾಲೋಚನೆ",
    subtitle: "60 ಸೆಕೆಂಡುಗಳಲ್ಲಿ ವೈಯಕ್ತಿಕ ಶಿಫಾರಸುಗಳು",
    start: "ಸಮಾಲೋಚನೆ ಪ್ರಾರಂಭಿಸಿ",
    next: "ಮುಂದೆ",
    back: "ಹಿಂದೆ",
    skip: "ಬಿಟ್ಟುಬಿಡಿ",
    uploadTitle: "ನಿಮ್ಮ ಫೋಟೋಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
    uploadSubtitle: "ಐಚ್ಛಿಕ: ನಿಮ್ಮ ಚರ್ಮವನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಸಹಾಯ ಮಾಡಿ",
    uploadFront: "ಮುಂಭಾಗದ ಮುಖ",
    uploadLeft: "ಎಡ ಬದಿ",
    uploadRight: "ಬಲ ಬದಿ",
    phoneTitle: "ಬಹುತೇಕ ಮುಗಿದಿದೆ!",
    phoneSubtitle: "ನಿಮ್ಮ ಫಲಿತಾಂಶಗಳನ್ನು ನೋಡಲು ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ",
    phonePlaceholder: "10 ಅಂಕಿ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ",
    viewResults: "ನನ್ನ ಫಲಿತಾಂಶಗಳನ್ನು ನೋಡಿ",
    resultTitle: "ನಿಮ್ಮ ಚರ್ಮ ವಿಶ್ಲೇಷಣೆ",
    agingLevel: "ವಯಸ್ಸಾಗುವ ಮಟ್ಟ",
    causes: "ಕಾರಣಗಳು",
    morningRoutine: "ಬೆಳಗಿನ ದಿನಚರಿ",
    nightRoutine: "ರಾತ್ರಿ ದಿನಚರಿ",
    rules: "ಪ್ರಮುಖ ನಿಯಮಗಳು",
    diet: "ಆಹಾರ ಸಲಹೆಗಳು",
    exercise: "ವ್ಯಾಯಾಮ ಸಲಹೆಗಳು",
    productRec: "ಶಿಫಾರಸು ಮಾಡಿದ ಪರಿಹಾರ",
    downloadPdf: "ವರದಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ",
    buyNow: "ಈಗ ಖರೀದಿಸಿ",
    low: "ಕಡಿಮೆ",
    moderate: "ಮಧ್ಯಮ",
    high: "ಹೆಚ್ಚು"
  }
};

function ConsultationPage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState('en');
  const [step, setStep] = useState('landing'); // landing, questions, upload, phone, analyzing, result
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [faceImages, setFaceImages] = useState({ front: null, left: null, right: null });
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [sessionId] = useState(() => `consult_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const fileInputRef = useRef(null);
  const [uploadType, setUploadType] = useState(null);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analyzeText, setAnalyzeText] = useState('');
  const [uploadError, setUploadError] = useState('');

  const t = UI_TEXT[language] || UI_TEXT.en;

  // Compress image for faster loading
  const compressImage = (file, maxWidth = 800, quality = 0.7) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          
          // Scale down if larger than maxWidth
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to compressed base64
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    // Track visit
    axios.post(`${API}/track-visit?page=consultation&session_id=${sessionId}`).catch(() => {});
  }, [sessionId]);

  // Fetch questions when language changes
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await axios.get(`${API}/consultation/questions?lang=${language}`);
        setQuestions(res.data.questions);
      } catch (err) {
        console.error('Failed to fetch questions');
      }
    };
    fetchQuestions();
  }, [language]);

  // Track consultation events
  const trackEvent = async (eventType, stepNum = null) => {
    try {
      await axios.post(`${API}/consultation/track-event`, {
        session_id: sessionId,
        event_type: eventType,
        step: stepNum,
        page: 'consultation'
      });
    } catch (err) {
      // Silent fail
    }
  };

  const handleStart = () => {
    trackEvent('started');
    setStep('questions');
  };

  const handleAnswer = (questionId, value, isMultiple = false) => {
    if (isMultiple) {
      const current = answers[questionId] || [];
      const maxSelect = questions[currentQuestion]?.max_select || 2;
      
      if (current.includes(value)) {
        setAnswers({ ...answers, [questionId]: current.filter(v => v !== value) });
      } else if (current.length < maxSelect) {
        setAnswers({ ...answers, [questionId]: [...current, value] });
      }
    } else {
      setAnswers({ ...answers, [questionId]: value });
    }
  };

  const handleFollowupAnswer = (value) => {
    setAnswers({ ...answers, sunscreen: value });
  };

  const canProceed = () => {
    const q = questions[currentQuestion];
    if (!q) return false;
    
    if (q.id === 3) { // Concerns - need at least 1
      return (answers[q.id] || []).length >= 1;
    }
    if (q.id === 4) { // Sun + Sunscreen
      return answers[q.id] && answers.sunscreen;
    }
    return !!answers[q.id];
  };

  const handleNext = () => {
    const q = questions[currentQuestion];
    trackEvent(`step_${q.id}_completed`, q.id);
    
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setStep('upload');
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    } else {
      setStep('landing');
    }
  };

  const handleImageUpload = (type) => {
    setUploadType(type);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file && uploadType) {
      try {
        // Compress the image before storing
        const compressedImage = await compressImage(file, 800, 0.7);
        setFaceImages({ ...faceImages, [uploadType]: compressedImage });
        trackEvent('face_uploaded');
      } catch (err) {
        console.error('Failed to compress image');
        // Fallback to original if compression fails
        const reader = new FileReader();
        reader.onloadend = () => {
          setFaceImages({ ...faceImages, [uploadType]: reader.result });
          trackEvent('face_uploaded');
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  const handleSkipUpload = () => {
    setStep('phone');
  };

  const handleContinueToPhone = () => {
    // Check if at least one photo is uploaded (MANDATORY)
    const hasPhoto = Object.values(faceImages).some(img => img !== null);
    if (!hasPhoto) {
      setUploadError(t.photoRequired || 'Please upload at least one photo to continue');
      return;
    }
    setUploadError('');
    trackEvent('face_upload_completed');
    setStep('phone');
  };

  const handlePhoneSubmit = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      setPhoneError('Please enter a valid 10-digit mobile number');
      return;
    }
    
    setPhoneError('');
    setLoading(true);
    trackEvent('phone_entered');
    
    // Show analyzing screen with progress animation
    setStep('analyzing');
    setAnalyzeProgress(0);
    
    // Analyzing progress animation
    const analyzeSteps = [
      { progress: 15, text: 'Analyzing your skin profile...' },
      { progress: 35, text: 'Evaluating aging factors...' },
      { progress: 55, text: 'Calculating personalized routine...' },
      { progress: 75, text: 'Preparing your recommendations...' },
      { progress: 90, text: 'Finalizing results...' },
    ];
    
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < analyzeSteps.length) {
        setAnalyzeProgress(analyzeSteps[stepIndex].progress);
        setAnalyzeText(analyzeSteps[stepIndex].text);
        stepIndex++;
      }
    }, 600);
    
    try {
      // Prepare answers in correct format
      const formattedAnswers = {
        age_group: answers[1],
        skin_type: answers[2],
        concerns: answers[3] || [],
        sun_exposure: answers[4],
        sunscreen_usage: answers.sunscreen,
        lifestyle: answers[5],
        skincare_usage: answers[6]
      };
      
      const res = await axios.post(`${API}/consultation/submit`, {
        answers: formattedAnswers,
        phone: cleanPhone,
        face_images: Object.values(faceImages).filter(Boolean),
        language,
        session_id: sessionId
      });
      
      // Clear interval and complete progress
      clearInterval(progressInterval);
      setAnalyzeProgress(100);
      setAnalyzeText('Analysis complete!');
      
      // Wait a moment to show 100% then show results
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setResult(res.data);
      setStep('result');
    } catch (err) {
      clearInterval(progressInterval);
      setPhoneError(err.response?.data?.detail || 'Something went wrong. Please try again.');
      setStep('phone');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!result) return;
    
    // Track PDF download
    trackEvent('pdf_downloaded');
    await axios.post(`${API}/consultation/${result.id}/pdf-downloaded?session_id=${sessionId}`);
    
    // Generate PDF
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(34, 197, 94);
    doc.text('Celesta Glow', 105, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Personalized Skin Analysis Report', 105, 30, { align: 'center' });
    
    // Date & Phone
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 45);
    doc.text(`Phone: +91 ${result.phone}`, 20, 52);
    
    // Add uploaded photo if available
    const uploadedImages = result.face_images?.length > 0 ? result.face_images : Object.values(faceImages).filter(Boolean);
    let yPosition = 60;
    
    if (uploadedImages.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Your Photo:', 20, yPosition);
      yPosition += 5;
      
      try {
        // Add the first uploaded image
        const imgData = uploadedImages[0];
        if (imgData) {
          doc.addImage(imgData, 'JPEG', 20, yPosition, 40, 40);
          yPosition += 50;
        }
      } catch (e) {
        console.log('Could not add image to PDF');
        yPosition += 10;
      }
    }
    
    // AI Skin Scores
    if (result.ai_skin_analysis?.combined_scores) {
      doc.setFontSize(14);
      doc.setTextColor(128, 90, 213);
      doc.text('AI Skin Analysis Scores', 20, yPosition);
      yPosition += 8;
      
      const scores = result.ai_skin_analysis.combined_scores;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`Beauty Score: ${scores.beauty_score || 7}/10`, 25, yPosition);
      yPosition += 6;
      doc.text(`Aging Score: ${scores.aging_score || 6}/10`, 25, yPosition);
      yPosition += 6;
      doc.text(`Acne Score: ${scores.acne_score || 7}/10`, 25, yPosition);
      yPosition += 6;
      doc.text(`Dullness Score: ${scores.dullness_score || 6}/10`, 25, yPosition);
      yPosition += 10;
    }
    
    // Aging Level
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Aging Level:', 20, yPosition);
    const levelColor = result.result.aging_level === 'high' ? [239, 68, 68] : 
                       result.result.aging_level === 'moderate' ? [245, 158, 11] : [34, 197, 94];
    doc.setTextColor(...levelColor);
    doc.text(result.result.aging_level.toUpperCase(), 70, yPosition);
    yPosition += 15;
    
    // Causes
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('Causes:', 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    result.result.causes.forEach(cause => {
      doc.text(`• ${cause}`, 25, yPosition);
      yPosition += 6;
    });
    
    // Morning Routine
    yPosition += 5;
    doc.setFontSize(12);
    doc.text('Morning Routine:', 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    result.result.morning_routine.forEach(item => {
      doc.text(`• ${item}`, 25, yPosition);
      yPosition += 6;
    });
    
    // Night Routine
    yPosition += 5;
    doc.setFontSize(12);
    doc.text('Night Routine:', 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    result.result.night_routine.forEach(item => {
      doc.text(`• ${item}`, 25, yPosition);
      yPosition += 6;
    });
    
    // Check if need new page
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }
    
    // Rules
    yPosition += 5;
    doc.setFontSize(12);
    doc.text('Important Rules:', 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    result.result.rules.forEach(rule => {
      const lines = doc.splitTextToSize(`• ${rule}`, 170);
      lines.forEach(line => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, 25, yPosition);
        yPosition += 5;
      });
    });
    
    // Diet
    yPosition += 5;
    doc.setFontSize(12);
    doc.text('Diet Tips:', 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    result.result.diet_tips.forEach(tip => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(`• ${tip}`, 25, yPosition);
      yPosition += 6;
    });
    
    // Exercise
    yPosition += 5;
    doc.setFontSize(12);
    doc.text('Exercise Tips:', 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    result.result.exercise_tips.forEach(tip => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(`• ${tip}`, 25, yPosition);
      yPosition += 6;
    });
    
    // Product Recommendation
    if (yPosition > 240) {
      doc.addPage();
      yPosition = 20;
    }
    yPosition += 10;
    doc.setFontSize(14);
    doc.setTextColor(34, 197, 94);
    doc.text('Recommended: Celesta Glow Complete Anti-Aging Kit', 20, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const usageLines = doc.splitTextToSize(result.result.product_usage, 170);
    usageLines.forEach(line => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, 20, yPosition);
      yPosition += 5;
    });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Celesta Glow | www.celestaglow.com', 105, 285, { align: 'center' });
    
    doc.save(`CelestaGlow_SkinReport_${result.phone}.pdf`);
  };

  // ==================== RENDER SECTIONS ====================

  // Landing Page
  if (step === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 pb-24">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4"><BackButton /></div>
        {/* SEO Meta Tags */}
        <Helmet>
          <title>{SEO_DATA.title}</title>
          <meta name="description" content={SEO_DATA.description} />
          <meta name="keywords" content={SEO_DATA.keywords} />
          <link rel="canonical" href={SEO_DATA.canonical} />
          
          {/* Open Graph */}
          <meta property="og:type" content="website" />
          <meta property="og:title" content={SEO_DATA.title} />
          <meta property="og:description" content={SEO_DATA.description} />
          <meta property="og:url" content={SEO_DATA.canonical} />
          <meta property="og:site_name" content="Celesta Glow" />
          
          {/* Twitter Card */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={SEO_DATA.title} />
          <meta name="twitter:description" content={SEO_DATA.description} />
          
          {/* Additional SEO */}
          <meta name="robots" content="index, follow" />
          <meta name="author" content="Celesta Glow" />
          <meta name="language" content="English, Hindi" />
          <meta name="geo.region" content="IN" />
          <meta name="geo.country" content="India" />
          
          {/* Schema.org structured data */}
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Celesta Glow Skin Analysis",
              "description": SEO_DATA.description,
              "url": SEO_DATA.canonical,
              "applicationCategory": "HealthApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "INR"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "2847"
              }
            })}
          </script>
        </Helmet>

        {/* Back to Home Button */}
        <div className="px-4 pt-4">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-green-600 transition-colors bg-white/80 px-3 py-2 rounded-full shadow-sm"
          >
            <Home size={18} />
            <span className="text-sm font-medium">Home</span>
          </Link>
        </div>

        {/* Language Selector */}
        <div className="flex flex-wrap justify-center gap-2 pt-2 px-4">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                language === lang.code
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {lang.flag} {lang.label}
            </button>
          ))}
        </div>

        <div className="px-5 pt-10 pb-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3" data-testid="consultation-title">
            {t.title}
          </h1>
          <p className="text-gray-600 mb-8 max-w-sm mx-auto">
            {t.subtitle}
          </p>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3 mb-8 max-w-sm mx-auto">
            {[
              { id: 'consult-time', icon: Clock, text: '60 seconds' },
              { id: 'consult-free', icon: Shield, text: '100% Free' },
              { id: 'consult-personal', icon: Star, text: 'Personalized' },
              { id: 'consult-expert', icon: Heart, text: 'Expert Tips' }
            ].map((item) => (
              <div key={item.id} className="bg-white rounded-xl p-3 flex items-center gap-2 shadow-sm">
                <item.icon className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-700">{item.text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleStart}
            className="btn-cg-primary w-full max-w-sm py-4"
            data-testid="start-consultation-btn"
          >
            {t.start} <ChevronRight size={20} />
          </button>

          <p className="text-xs text-gray-500 mt-4">
            No signup required • Results in 60 seconds
          </p>
        </div>

        {/* Trust badges */}
        <div className="px-5">
          <div className="bg-white rounded-2xl p-5 shadow-sm max-w-sm mx-auto">
            <p className="text-center text-sm text-gray-600 mb-3">Trusted by 10,000+ users</p>
            <div className="flex justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={`consult-star-${i}`} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <p className="text-center text-xs text-gray-500 mt-2">4.8 average rating</p>
          </div>
        </div>
      </div>
    );
  }

  // Questions Flow
  if (step === 'questions' && questions.length > 0) {
    const q = questions[currentQuestion];
    const progress = ((currentQuestion + 1) / questions.length) * 100;

    return (
      <div className="min-h-screen bg-white pb-24">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-100">
          <div 
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={handleBack} className="p-2 -ml-2">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <span className="text-sm text-gray-500">
            {currentQuestion + 1} / {questions.length}
          </span>
          <div className="w-10" />
        </div>

        <div className="px-5 pt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2" data-testid="question-title">
            {q.question}
          </h2>
          {q.subtitle && (
            <p className="text-gray-500 text-sm mb-6">{q.subtitle}</p>
          )}

          {/* Options */}
          <div className="space-y-3 mb-6">
            {q.options.map((option) => {
              const isSelected = q.type === 'multiple'
                ? (answers[q.id] || []).includes(option.value)
                : answers[q.id] === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(q.id, option.value, q.type === 'multiple')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  data-testid={`option-${option.value}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${isSelected ? 'text-green-700' : 'text-gray-900'}`}>
                        {option.label}
                      </p>
                      {option.desc && (
                        <p className="text-sm text-gray-500 mt-0.5">{option.desc}</p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Followup question (for Q4 - sunscreen) */}
          {q.followup && answers[q.id] && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">{q.followup.question}</h3>
              <div className="space-y-2">
                {q.followup.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleFollowupAnswer(option.value)}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                      answers.sunscreen === option.value
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={answers.sunscreen === option.value ? 'text-green-700 font-medium' : 'text-gray-700'}>
                        {option.label}
                      </span>
                      {answers.sunscreen === option.value && (
                        <Check className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Next Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className={`w-full py-4 rounded-full font-semibold flex items-center justify-center gap-2 transition-all ${
              canProceed()
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            data-testid="next-btn"
          >
            {t.next} <ChevronRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  // Upload Page
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-white pb-24">
        <div className="px-5 pt-8">
          <button onClick={() => setStep('questions')} className="mb-4">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>

          <h2 className="text-xl font-bold text-gray-900 mb-2">{t.uploadTitle}</h2>
          <p className="text-gray-500 text-sm mb-6">{t.uploadSubtitle}</p>

          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { key: 'front', label: t.uploadFront },
              { key: 'left', label: t.uploadLeft },
              { key: 'right', label: t.uploadRight }
            ].map((item) => (
              <div key={item.key} className="text-center">
                <button
                  onClick={() => handleImageUpload(item.key)}
                  className={`w-full aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                    faceImages[item.key]
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {faceImages[item.key] ? (
                    <div className="relative w-full h-full">
                      <img 
                        src={faceImages[item.key]} 
                        alt={item.label}
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFaceImages({ ...faceImages, [item.key]: null });
                        }}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <Camera className="w-8 h-8 text-gray-400" />
                  )}
                </button>
                <p className="text-xs text-gray-600 mt-2">{item.label}</p>
              </div>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-700">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Photo upload is required for accurate AI skin analysis. Your photos are stored securely.
            </p>
          </div>

          {uploadError && (
            <div className="bg-red-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {uploadError}
              </p>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
          <button
            onClick={handleContinueToPhone}
            className={`w-full py-4 rounded-full font-semibold flex items-center justify-center gap-2 ${
              Object.values(faceImages).some(img => img !== null)
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {t.next} <ChevronRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  // Phone Page
  if (step === 'phone') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="px-5 pt-8 flex-1">
          <button onClick={() => setStep('upload')} className="mb-4">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t.phoneTitle}</h2>
            <p className="text-gray-500 text-sm">{t.phoneSubtitle}</p>
          </div>

          <div className="max-w-sm mx-auto">
            <div className="flex">
              <span className="inline-flex items-center px-4 border border-r-0 border-gray-200 bg-gray-50 text-gray-500 rounded-l-xl">
                +91
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="flex-1 px-4 py-4 border border-gray-200 rounded-r-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-lg"
                placeholder={t.phonePlaceholder}
                data-testid="phone-input"
              />
            </div>
            {phoneError && (
              <p className="text-red-500 text-sm mt-2">{phoneError}</p>
            )}

            <p className="text-xs text-gray-400 text-center mt-4">
              Your number is used to generate your personalized report
            </p>
          </div>
        </div>

        <div className="p-4 bg-white border-t border-gray-100">
          <button
            onClick={handlePhoneSubmit}
            disabled={loading || phone.length !== 10}
            className={`w-full py-4 rounded-full font-semibold flex items-center justify-center gap-2 transition-all ${
              phone.length === 10 && !loading
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            data-testid="view-results-btn"
          >
            {loading ? (
              <span className="animate-pulse">Analyzing...</span>
            ) : (
              <>{t.viewResults} <ChevronRight size={20} /></>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Analyzing Screen (loading with progress)
  if (step === 'analyzing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Animated Logo */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20" />
            <div className="absolute inset-2 bg-green-400 rounded-full animate-ping opacity-30 animation-delay-200" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center shadow-lg">
              <Sparkles className="w-12 h-12 text-white animate-pulse" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="h-3 bg-white rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${analyzeProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-sm text-green-700 font-medium">{analyzeProgress}%</span>
              <span className="text-sm text-green-600">Analyzing</span>
            </div>
          </div>

          {/* Status Text */}
          <p className="text-center text-green-800 font-medium animate-pulse" data-testid="analyze-text">
            {analyzeText || 'Starting analysis...'}
          </p>

          {/* Decorative dots */}
          <div className="flex justify-center gap-2 mt-6">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // Result Page
  if (step === 'result' && result) {
    const agingColors = {
      low: 'bg-green-100 text-green-700 border-green-200',
      moderate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      high: 'bg-red-100 text-red-700 border-red-200'
    };

    // Get uploaded images from result or state
    const uploadedImages = result.face_images?.length > 0 ? result.face_images : Object.values(faceImages).filter(Boolean);

    return (
      <div className="min-h-screen bg-gray-50 pb-32">
        {/* Header */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white px-5 py-8 text-center">
          <h1 className="text-2xl font-bold mb-2">{t.resultTitle}</h1>
          <p className="text-green-100">Based on your responses</p>
        </div>

        <div className="px-5 -mt-6 space-y-4">
          {/* Your Photos Card - Show uploaded images */}
          {uploadedImages.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-500" />
                Your Photos
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {uploadedImages.map((img, i) => (
                  <div key={`uploaded-photo-${i}`} className="flex-shrink-0">
                    <img 
                      src={img} 
                      alt={`Photo ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-xl border-2 border-purple-100"
                      data-testid={`result-photo-${i}`}
                    />
                    <p className="text-xs text-gray-500 text-center mt-1">
                      {i === 0 ? 'Front' : i === 1 ? 'Left' : 'Right'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Skin Analysis Scores Card */}
          {result.ai_skin_analysis && result.ai_skin_analysis.combined_scores && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 shadow-sm border border-purple-100">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-purple-500" />
                AI Skin Analysis Scores
              </h3>
              
              {/* Beauty Score - Main Score */}
              <div className="bg-white rounded-xl p-4 mb-4 text-center">
                <div className="text-4xl font-bold text-purple-600 mb-1">
                  {result.ai_skin_analysis.combined_scores.beauty_score || 7}/10
                </div>
                <div className="text-sm font-medium text-gray-700 mb-2">Overall Beauty Score</div>
                <p className="text-xs text-gray-500">
                  {result.ai_skin_analysis.combined_scores.beauty_reason || 
                   result.ai_skin_analysis.individual_analyses?.[0]?.beauty_reason ||
                   "Based on overall skin health and clarity"}
                </p>
              </div>
              
              {/* Individual Scores Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Aging Score */}
                <div className="bg-white rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Aging</span>
                    <span className="text-lg font-bold text-orange-500">
                      {result.ai_skin_analysis.combined_scores.aging_score || 6}/10
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full" 
                      style={{width: `${(result.ai_skin_analysis.combined_scores.aging_score || 6) * 10}%`}}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {result.ai_skin_analysis.combined_scores.aging_reason?.slice(0, 50) || "Fine lines detected"}...
                  </p>
                </div>
                
                {/* Acne Score */}
                <div className="bg-white rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Acne</span>
                    <span className="text-lg font-bold text-red-500">
                      {result.ai_skin_analysis.combined_scores.acne_score || 7}/10
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full" 
                      style={{width: `${(result.ai_skin_analysis.combined_scores.acne_score || 7) * 10}%`}}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {result.ai_skin_analysis.combined_scores.acne_reason?.slice(0, 50) || "Minor blemishes"}...
                  </p>
                </div>
                
                {/* Dullness Score */}
                <div className="bg-white rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Radiance</span>
                    <span className="text-lg font-bold text-yellow-500">
                      {result.ai_skin_analysis.combined_scores.dullness_score || 5}/10
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full" 
                      style={{width: `${(result.ai_skin_analysis.combined_scores.dullness_score || 5) * 10}%`}}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {result.ai_skin_analysis.combined_scores.dullness_reason?.slice(0, 50) || "Needs more glow"}...
                  </p>
                </div>
                
                {/* Pigmentation Score */}
                <div className="bg-white rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Even Tone</span>
                    <span className="text-lg font-bold text-blue-500">
                      {result.ai_skin_analysis.combined_scores.pigmentation_score || 6}/10
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{width: `${(result.ai_skin_analysis.combined_scores.pigmentation_score || 6) * 10}%`}}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {result.ai_skin_analysis.combined_scores.pigmentation_reason?.slice(0, 50) || "Some uneven areas"}...
                  </p>
                </div>
              </div>
              
              {/* Primary Concern & Tips */}
              {result.ai_skin_analysis.overall_assessment && (
                <div className="mt-4 bg-white rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-gray-700">Primary Concern:</span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium capitalize">
                      {result.ai_skin_analysis.overall_assessment.primary_concern || 'Aging'}
                    </span>
                  </div>
                  {result.ai_skin_analysis.overall_assessment.personalized_tips?.[0] && (
                    <p className="text-xs text-gray-600 mt-2">
                      <strong>Tip:</strong> {result.ai_skin_analysis.overall_assessment.personalized_tips[0]}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Aging Level Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-500" />
              {t.agingLevel}
            </h3>
            <div className={`inline-block px-4 py-2 rounded-full text-lg font-bold border ${agingColors[result.result.aging_level]}`}>
              {t[result.result.aging_level] || result.result.aging_level.toUpperCase()}
            </div>
          </div>

          {/* Causes Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              {t.causes}
            </h3>
            <ul className="space-y-2">
              {result.result.causes.map((cause, i) => (
                <li key={`cause-${i}-${cause.substring(0, 20)}`} className="flex items-start gap-2 text-gray-600 text-sm">
                  <span className="text-orange-500 mt-1">•</span>
                  {cause}
                </li>
              ))}
            </ul>
          </div>

          {/* Morning Routine */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Sun className="w-5 h-5 text-yellow-500" />
              {t.morningRoutine}
            </h3>
            <ol className="space-y-2">
              {result.result.morning_routine.map((item, i) => (
                <li key={`morning-${i}`} className="flex items-start gap-3 text-gray-600 text-sm">
                  <span className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-medium text-xs flex-shrink-0">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>

          {/* Night Routine */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-indigo-500" />
              {t.nightRoutine}
            </h3>
            <ol className="space-y-2">
              {result.result.night_routine.map((item, i) => (
                <li key={`night-${i}`} className="flex items-start gap-3 text-gray-600 text-sm">
                  <span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-medium text-xs flex-shrink-0">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>

          {/* Rules */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              {t.rules}
            </h3>
            <ul className="space-y-2">
              {result.result.rules.map((rule, i) => (
                <li key={`rule-${i}`} className="flex items-start gap-2 text-gray-600 text-sm">
                  <Check className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          {/* Diet */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              {t.diet}
            </h3>
            <ul className="space-y-2">
              {result.result.diet_tips.map((tip, i) => (
                <li key={`diet-${i}`} className="flex items-start gap-2 text-gray-600 text-sm">
                  <span className="text-pink-500">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Exercise */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-purple-500" />
              {t.exercise}
            </h3>
            <ul className="space-y-2">
              {result.result.exercise_tips.map((tip, i) => (
                <li key={`exercise-${i}`} className="flex items-start gap-2 text-gray-600 text-sm">
                  <span className="text-purple-500">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Product Recommendation - Highlighted */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Star className="w-5 h-5" />
              {t.productRec}
            </h3>
            <div className="bg-white/10 rounded-xl p-4 mb-4">
              <p className="text-green-50 text-sm leading-relaxed">
                {result.result.product_usage}
              </p>
            </div>
            <div className="text-center">
              <p className="text-green-200 text-sm mb-2">Celesta Glow Complete Anti-Aging Kit</p>
              <p className="text-2xl font-bold">From ₹499 <span className="text-sm font-normal text-green-200 line-through">₹1,499</span></p>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Actions */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 space-y-2">
          <button
            onClick={() => navigate('/shop')}
            className="w-full py-4 bg-green-500 text-white rounded-full font-semibold flex items-center justify-center gap-2"
            data-testid="buy-now-btn"
          >
            {t.buyNow} — Shop Now <ChevronRight size={20} />
          </button>
          <button
            onClick={handleDownloadPDF}
            className="w-full py-3 border-2 border-gray-200 rounded-full font-medium text-gray-700 flex items-center justify-center gap-2"
            data-testid="download-pdf-btn"
          >
            <Download size={18} />
            {t.downloadPdf}
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default ConsultationPage;
