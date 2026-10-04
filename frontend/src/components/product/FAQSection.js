import React, { memo, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

// FAQ data with unique IDs
const FAQ_DATA = [
  {
    id: 'faq-suitable',
    question: 'Is this suitable for all skin types?',
    answer: 'Yes! Our serum is dermatologist-tested and suitable for all skin types including sensitive skin. It\'s non-comedogenic and free from harsh chemicals.'
  },
  {
    id: 'faq-results',
    question: 'How soon will I see results?',
    answer: 'Most customers notice visible improvements within 2-4 weeks. For best results, use consistently for 8-12 weeks as part of your daily skincare routine.'
  },
  {
    id: 'faq-usage',
    question: 'How do I use this serum?',
    answer: 'Apply 3-4 drops on clean face and neck, morning and night. Gently massage in upward motions until fully absorbed. Follow with moisturizer and sunscreen (AM).'
  },
  {
    id: 'faq-pregnant',
    question: 'Can I use this during pregnancy?',
    answer: 'We recommend consulting your doctor before using any skincare products containing retinol during pregnancy or breastfeeding.'
  },
  {
    id: 'faq-shelf',
    question: 'What is the shelf life?',
    answer: '24 months unopened, 12 months after opening. Store in a cool, dry place away from direct sunlight.'
  },
];

// Single FAQ item with accordion
const FAQItem = memo(({ faq, isOpen, onToggle }) => (
  <div className="border border-gray-100 rounded-xl overflow-hidden">
    <button 
      onClick={onToggle}
      className="w-full p-4 flex items-center justify-between text-left bg-white hover:bg-gray-50 transition-colors"
      aria-expanded={isOpen}
    >
      <span className="font-medium text-gray-900 text-sm pr-4">{faq.question}</span>
      {isOpen ? (
        <ChevronUp size={18} className="text-green-600 flex-shrink-0" />
      ) : (
        <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />
      )}
    </button>
    {isOpen && (
      <div className="px-4 pb-4 text-sm text-gray-600 bg-gray-50">
        {faq.answer}
      </div>
    )}
  </div>
));
FAQItem.displayName = 'FAQItem';

// FAQ Section
function FAQSection() {
  const [openId, setOpenId] = useState(null);
  
  const handleToggle = useCallback((id) => {
    setOpenId(prev => prev === id ? null : id);
  }, []);

  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <HelpCircle size={18} className="text-green-500" />
        Frequently Asked Questions
      </h3>
      
      <div className="space-y-2">
        {FAQ_DATA.map((faq) => (
          <FAQItem 
            key={faq.id} 
            faq={faq} 
            isOpen={openId === faq.id}
            onToggle={() => handleToggle(faq.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(FAQSection);
export { FAQItem, FAQ_DATA };
