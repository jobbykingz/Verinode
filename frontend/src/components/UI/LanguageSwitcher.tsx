import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' }
];

const rtlLanguages = ['ar', 'he', 'fa'];

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    
    // Handle RTL layout changes
    const isRTL = rtlLanguages.includes(languageCode);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = languageCode;
    
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe className="w-4 h-4" />
        <span className="flex items-center space-x-1">
          <span>{currentLanguage.flag}</span>
          <span>{currentLanguage.name}</span>
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-48 bg-white border border-gray-300 rounded-md shadow-lg">
          <ul className="py-1" role="listbox">
            {languages.map((language) => (
              <li key={language.code}>
                <button
                  onClick={() => handleLanguageChange(language.code)}
                  className={`flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100 ${
                    i18n.language === language.code ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                  }`}
                  role="option"
                  aria-selected={i18n.language === language.code}
                >
                  <span className="mr-3">{language.flag}</span>
                  <span>{language.name}</span>
                  {i18n.language === language.code && (
                    <svg className="w-4 h-4 ml-auto text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
