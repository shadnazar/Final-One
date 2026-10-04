import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Award, Quote } from 'lucide-react';

// Only 5 key dermatologists - focused and impactful
const DERMATOLOGISTS = [
  {
    id: 1,
    name: "Dr. Ariana Vashti",
    credentials: "MD, FAAD",
    specialty: "Cosmetic Dermatology",
    experience: "18 years",
    color: "from-violet-500 to-purple-600",
    quote: "The Retinol-Niacinamide fusion delivers anti-aging benefits without irritation. This is what modern skincare should be.",
    ingredient: "Retinol Complex"
  },
  {
    id: 2,
    name: "Dr. Kavitha Menon",
    credentials: "MBBS, DVD, DNB",
    specialty: "Clinical Dermatology",
    experience: "15 years",
    color: "from-green-500 to-teal-600",
    quote: "The molecular weight of Hyaluronic Acid penetrates deeper than standard formulations. Visible hydration within days.",
    ingredient: "Hyaluronic Acid"
  },
  {
    id: 3,
    name: "Dr. Zara Irani",
    credentials: "MD Dermatology",
    specialty: "Aesthetic Medicine",
    experience: "12 years",
    color: "from-rose-500 to-pink-600",
    quote: "The stabilized Vitamin C remains potent throughout the product's lifespan. That's pharmaceutical-grade quality.",
    ingredient: "Vitamin C"
  },
  {
    id: 4,
    name: "Dr. Nyla Chakraborty",
    credentials: "MBBS, MD, FRCP",
    specialty: "Regenerative Dermatology",
    experience: "20 years",
    color: "from-amber-500 to-orange-600",
    quote: "The peptide complex stimulates natural collagen production. I've seen remarkable improvements in skin elasticity.",
    ingredient: "Collagen Peptides"
  },
  {
    id: 5,
    name: "Dr. Rehan Malhotra",
    credentials: "MD, DM Dermatology",
    specialty: "Anti-Aging Research",
    experience: "14 years",
    color: "from-blue-500 to-indigo-600",
    quote: "The encapsulation technology ensures active ingredients reach the dermis layer. This is where real anti-aging happens.",
    ingredient: "Delivery System"
  }
];

function DermatologistSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % DERMATOLOGISTS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setActiveIndex(prev => (prev - 1 + DERMATOLOGISTS.length) % DERMATOLOGISTS.length);
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setActiveIndex(prev => (prev + 1) % DERMATOLOGISTS.length);
  };

  const currentDoc = DERMATOLOGISTS[activeIndex];

  return (
    <section className="py-12 bg-gradient-to-b from-slate-50 to-white" data-testid="dermatologist-section">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-violet-100 px-3 py-1.5 rounded-full mb-3">
            <Award className="w-4 h-4 text-violet-600" />
            <span className="text-violet-700 text-xs font-semibold">EXPERT ENDORSED</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Trusted by Dermatologists
          </h2>
        </div>

        {/* Card */}
        <div className="relative">
          {/* Navigation */}
          <button
            onClick={handlePrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-500 hover:text-violet-600 -ml-5"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-500 hover:text-violet-600 -mr-5"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Main Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mx-6">
            {/* Gradient Top */}
            <div className={`h-1 bg-gradient-to-r ${currentDoc.color}`}></div>
            
            <div className="p-6">
              {/* Doctor Info */}
              <div className="flex items-center gap-4 mb-5">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${currentDoc.color} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                  {currentDoc.name.split(' ')[1]?.[0] || currentDoc.name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{currentDoc.name}</h3>
                  <p className="text-xs text-gray-500">{currentDoc.credentials} • {currentDoc.experience}</p>
                  <p className="text-xs text-violet-600 font-medium">{currentDoc.specialty}</p>
                </div>
              </div>

              {/* Ingredient Focus */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${currentDoc.color} text-white mb-4`}>
                {currentDoc.ingredient}
              </div>

              {/* Quote */}
              <div className="relative pl-4 border-l-2 border-violet-200">
                <Quote className="absolute -left-2.5 -top-1 w-5 h-5 text-violet-300 bg-white" />
                <p className="text-gray-600 text-sm leading-relaxed italic">
                  "{currentDoc.quote}"
                </p>
              </div>
            </div>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {DERMATOLOGISTS.map((doc, idx) => (
              <button
                key={doc.id || `derma-dot-${idx}`}
                onClick={() => {
                  setIsAutoPlaying(false);
                  setActiveIndex(idx);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === activeIndex ? 'bg-violet-600 w-5' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 bg-violet-50 rounded-xl p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-violet-600">5+</p>
              <p className="text-xs text-gray-600">Expert Dermatologists</p>
            </div>
            <div>
              <p className="text-xl font-bold text-violet-600">80+</p>
              <p className="text-xs text-gray-600">Years Experience</p>
            </div>
            <div>
              <p className="text-xl font-bold text-violet-600">50K+</p>
              <p className="text-xs text-gray-600">Recommended</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DermatologistSection;
