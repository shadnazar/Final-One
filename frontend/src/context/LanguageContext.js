import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Default translations (fallback)
const defaultTranslations = {
  en: {
    "nav.home": "Home",
    "nav.shop": "Shop",
    "nav.blog": "Blog",
    "hero.badge": "NO MORE SKIN PROBLEMS",
    "hero.cta": "Order Now",
    "product.price": "₹399",
    "product.discount": "73% OFF",
    "trust.guarantee": "7-Day Sealed Return",
    "trust.delivery": "Free Delivery",
    "common.loading": "Loading...",
  },
  hi: {
    "nav.home": "होम",
    "nav.shop": "दुकान",
    "nav.blog": "ब्लॉग",
    "hero.badge": "अब कोई त्वचा समस्या नहीं",
    "hero.cta": "अभी ऑर्डर करें",
    "product.price": "₹399",
    "product.discount": "73% छूट",
    "trust.guarantee": "7 दिन मनी बैक गारंटी",
    "trust.delivery": "मुफ्त डिलीवरी",
    "common.loading": "लोड हो रहा है...",
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    // Get from localStorage or default to 'en'
    return localStorage.getItem('lang') || 'en';
  });
  const [translations, setTranslations] = useState(defaultTranslations[language] || defaultTranslations.en);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTranslations(language);
  }, [language]);

  const fetchTranslations = async (lang) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/i18n/translations/${lang}`);
      setTranslations(res.data.translations);
    } catch (err) {
      // Use default translations on error
      setTranslations(defaultTranslations[lang] || defaultTranslations.en);
    } finally {
      setLoading(false);
    }
  };

  const changeLanguage = useCallback((newLang) => {
    localStorage.setItem('lang', newLang);
    setLanguage(newLang);
  }, []);

  // Translation function with variable substitution
  const t = useCallback((key, vars = {}) => {
    let text = translations[key] || defaultTranslations.en[key] || key;
    
    // Replace variables like {count}
    Object.keys(vars).forEach(varKey => {
      text = text.replace(`{${varKey}}`, vars[varKey]);
    });
    
    return text;
  }, [translations]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    language, 
    changeLanguage, 
    t, 
    loading,
    availableLanguages: [
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'हिन्दी' }
    ]
  }), [language, changeLanguage, t, loading]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default LanguageContext;
