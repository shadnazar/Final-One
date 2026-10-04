import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Globe } from 'lucide-react';

function LanguageSwitcher({ className = '' }) {
  const { language, changeLanguage, availableLanguages } = useLanguage();

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      <Globe size={16} className="text-gray-500" />
      <select
        value={language}
        onChange={(e) => changeLanguage(e.target.value)}
        className="bg-transparent border-none text-sm font-medium text-gray-700 cursor-pointer focus:outline-none appearance-none pr-6"
        data-testid="language-switcher"
      >
        {availableLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default LanguageSwitcher;
