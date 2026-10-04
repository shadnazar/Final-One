import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ShoppingBag, CheckCircle, Sparkles, X, Star } from 'lucide-react';

// User's custom notification sound
const NOTIFICATION_SOUND_URL = 'https://customer-assets.emergentagent.com/job_26148967-6968-4918-8b5d-0a2c0e5259b2/artifacts/sa3jziee_universfield-new-notification-057-494255.mp3';

// Product image
const PRODUCT_IMAGE = 'https://customer-assets.emergentagent.com/job_26148967-6968-4918-8b5d-0a2c0e5259b2/artifacts/ccpjeqd2_IMG_9115.png';

// 50+ unique authentic names
const ALL_NAMES = [
  "Ritika", "Tanisha", "Neha", "Sanya", "Kriti", "Aditi", "Nisha", "Pooja",
  "Megha", "Shruti", "Divya", "Tanya", "Swati", "Rashmi", "Snehal", "Pallavi",
  "Prerna", "Ishita", "Aanya", "Riya", "Kiara", "Anushka", "Mira", "Saanvi",
  "Avni", "Diya", "Kavya", "Myra", "Zara", "Aisha", "Navya", "Shanaya",
  "Anika", "Ira", "Pari", "Ahana", "Trisha", "Vanya", "Reena", "Komal",
  "Jiya", "Sana", "Preeti", "Radhika", "Simran", "Kajal", "Shweta", "Sonam",
  "Mansi", "Garima", "Deepa", "Richa", "Archana", "Bhavna", "Chandni", "Damini"
];

// All Indian cities
const ALL_LOCATIONS = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Pune", "Kolkata",
  "Jaipur", "Ahmedabad", "Lucknow", "Kerala", "Chandigarh", "Indore", "Nagpur",
  "Surat", "Gurgaon", "Noida", "Thane", "Vadodara", "Coimbatore", "Bhopal",
  "Visakhapatnam", "Patna", "Ludhiana", "Agra", "Nashik", "Rajkot", "Varanasi"
];

// Products for notification rotation
const PRODUCT_NAMES = [
  "Complete Anti-Aging Kit",
  "Advanced Face Serum",
  "Retinoid Night Cream",
  "Caffeine Under Eye Cream",
  "SPF 50 Sunscreen",
  "Gentle Cleanser",
  "Day & Night Power Duo",
  "Glow Essentials Trio"
];

const getRandomProduct = () => PRODUCT_NAMES[Math.floor(Math.random() * PRODUCT_NAMES.length)];

function RecentPurchaseNotification() {
  const [currentNotif, setCurrentNotif] = useState(null);
  const usedNamesRef = useRef([]);
  const audioRef = useRef(null);
  const countRef = useRef(0);
  const timerRef = useRef(null);
  
  const MAX_NOTIFS = 5;
  const DISPLAY_TIME = 6000;

  // Play notification sound
  const playSound = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
      audioRef.current.volume = 0.3;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };

  // Get unique name
  const getUniqueName = () => {
    const available = ALL_NAMES.filter(n => !usedNamesRef.current.includes(n));
    if (available.length === 0) {
      usedNamesRef.current = [];
      return ALL_NAMES[Math.floor(Math.random() * ALL_NAMES.length)];
    }
    const name = available[Math.floor(Math.random() * available.length)];
    usedNamesRef.current.push(name);
    return name;
  };

  // Get random location
  const getLocation = () => ALL_LOCATIONS[Math.floor(Math.random() * ALL_LOCATIONS.length)];

  // Show order notification
  const showOrderNotif = () => {
    if (sessionStorage.getItem('notifDismissed') || countRef.current >= MAX_NOTIFS) return;
    
    setCurrentNotif({
      type: 'order',
      name: getUniqueName(),
      location: getLocation(),
      product: getRandomProduct(),
      id: Date.now()
    });
    countRef.current++;
    playSound();
    
    // Hide after display time, then schedule next
    timerRef.current = setTimeout(() => {
      setCurrentNotif(null);
      
      // Schedule next notification
      if (!sessionStorage.getItem('notifDismissed') && countRef.current < MAX_NOTIFS) {
        const nextDelay = 15000 + Math.random() * 5000; // 15-20 seconds
        timerRef.current = setTimeout(showOrderNotif, nextDelay);
      }
    }, DISPLAY_TIME);
  };

  // Show welcome notification
  const showWelcomeNotif = () => {
    if (sessionStorage.getItem('notifDismissed')) return;
    
    setCurrentNotif({ type: 'welcome', id: Date.now() });
    countRef.current++;
    playSound();
    sessionStorage.setItem('welcomeShown', 'true');
    localStorage.setItem('celestaVisitor', 'true');
    
    // Hide after display time, then show order notifications
    timerRef.current = setTimeout(() => {
      setCurrentNotif(null);
      
      // Start order notifications after 3 seconds
      if (!sessionStorage.getItem('notifDismissed')) {
        timerRef.current = setTimeout(showOrderNotif, 3000);
      }
    }, DISPLAY_TIME);
  };

  // Dismiss handler
  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentNotif(null);
    sessionStorage.setItem('notifDismissed', 'true');
    localStorage.setItem('celestaVisitor', 'true');
  };

  // Start notification sequence on mount
  useEffect(() => {
    // Check if already dismissed
    if (sessionStorage.getItem('notifDismissed')) return;
    
    // Determine if new user (before any state changes)
    const isNewUser = !localStorage.getItem('celestaVisitor');
    const welcomeShown = sessionStorage.getItem('welcomeShown');
    
    // Start after 4 seconds
    timerRef.current = setTimeout(() => {
      if (isNewUser && !welcomeShown) {
        showWelcomeNotif();
      } else {
        showOrderNotif();
      }
    }, 4000);
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Don't render if no notification
  if (!currentNotif) return null;

  // Welcome Notification
  if (currentNotif.type === 'welcome') {
    return (
      <div 
        key={currentNotif.id}
        className="fixed top-20 right-4 z-[9999]"
        style={{ animation: 'slideIn 0.5s ease-out forwards' }}
        data-testid="welcome-notification"
      >
        <div className="bg-gradient-to-br from-green-500 via-green-500 to-teal-500 rounded-2xl shadow-2xl overflow-hidden w-[300px] text-white relative border border-green-400/30">
          <button 
            onClick={handleDismiss}
            className="absolute top-3 right-3 w-7 h-7 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all hover:scale-110 z-10"
            data-testid="close-notification-btn"
          >
            <X size={16} className="text-white" />
          </button>
          
          <div className="p-5 pr-12">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="font-bold text-base">Welcome to Celesta Glow!</span>
            </div>
            <p className="text-sm opacity-95 leading-relaxed">
              India's #1 Anti-Aging Brand trusted by 50,000+ women. Complete anti-aging routine — 5 products for younger-looking skin!
            </p>
            <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-3 text-xs opacity-90">
              <span className="flex items-center gap-1">
                <CheckCircle size={12} /> Clinically Proven
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle size={12} /> Free Delivery
              </span>
            </div>
          </div>
        </div>
        
        <style>{`
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(100px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}</style>
      </div>
    );
  }

  // Order Notification
  return (
    <div 
      key={currentNotif.id}
      className="fixed top-20 right-4 z-[9999]"
      style={{ animation: 'slideIn 0.5s ease-out forwards' }}
      data-testid="recent-purchase-notification"
    >
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-[300px] relative border border-gray-200">
        <button 
          onClick={handleDismiss}
          className="absolute top-2.5 right-3 w-6 h-6 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all hover:scale-110 z-10"
          data-testid="close-notification-btn"
        >
          <X size={14} className="text-white" />
        </button>
        
        <div className="bg-gradient-to-r from-green-500 to-green-500 px-4 py-2.5 pr-10 flex items-center gap-2">
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
          <span className="text-white text-sm font-semibold">New Order Placed</span>
        </div>
        
        <div className="p-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-green-50 to-green-50 border-2 border-green-100 p-1">
              <img 
                src={PRODUCT_IMAGE} 
                alt="Celesta Glow Products" 
                className="w-full h-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 font-bold text-base truncate">{currentNotif.name}</p>
              <p className="text-gray-500 text-sm flex items-center gap-1.5 mt-1">
                <MapPin size={14} className="text-green-500 flex-shrink-0" />
                <span className="truncate">{currentNotif.location}</span>
              </p>
              <p className="text-green-600 text-sm font-medium mt-2 flex items-center gap-1.5">
                <ShoppingBag size={14} />
                Celesta Glow {currentNotif.product || 'Anti-Aging Kit'}
              </p>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={`notif-star-${i}`} size={11} className="fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span className="text-[10px] text-gray-400">Just now</span>
            </div>
            <span className="text-[10px] text-green-600 font-medium flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              Verified
            </span>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

export default RecentPurchaseNotification;
