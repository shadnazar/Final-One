/**
 * Shared state for live stats (viewers, sold today, location)
 * Synced across Homepage and Product page via localStorage
 * 
 * Time-based realistic numbers:
 * - Morning (6AM-12PM): Lower traffic, 15-25 viewing, base sold 12-20
 * - Afternoon (12PM-6PM): Peak traffic, 25-45 viewing, base sold 25-40
 * - Evening (6PM-10PM): High traffic, 30-50 viewing, base sold 35-55
 * - Night (10PM-6AM): Low traffic, 8-18 viewing, base sold 45-65 (cumulative)
 */

// Indian states with approximate customer counts
const INDIAN_STATES = [
  { state: 'Delhi', customerCount: 2200 },
  { state: 'Mumbai', customerCount: 3100 },
  { state: 'Bangalore', customerCount: 2800 },
  { state: 'Chennai', customerCount: 1900 },
  { state: 'Hyderabad', customerCount: 2100 },
  { state: 'Kolkata', customerCount: 1700 },
  { state: 'Pune', customerCount: 1500 },
  { state: 'Ahmedabad', customerCount: 1200 },
  { state: 'Jaipur', customerCount: 900 },
  { state: 'Lucknow', customerCount: 800 },
  { state: 'Kerala', customerCount: 1400 },
  { state: 'Gujarat', customerCount: 1100 },
  { state: 'Chandigarh', customerCount: 600 },
  { state: 'Goa', customerCount: 400 },
  { state: 'Indore', customerCount: 500 },
];

// Get time-based viewing count (realistic based on time of day)
const getTimeBasedViewingNow = () => {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  
  // Add some randomness based on minute
  const randomOffset = (minute % 7) - 3; // -3 to +3
  
  if (hour >= 6 && hour < 12) {
    // Morning: 15-25 viewers
    const base = 15 + Math.floor((hour - 6) * 1.5);
    return Math.max(12, Math.min(28, base + randomOffset));
  } else if (hour >= 12 && hour < 18) {
    // Afternoon (Peak): 25-45 viewers
    const base = 25 + Math.floor((hour - 12) * 3);
    return Math.max(22, Math.min(48, base + randomOffset));
  } else if (hour >= 18 && hour < 22) {
    // Evening (High): 30-50 viewers
    const base = 35 + Math.floor((hour - 18) * 4);
    return Math.max(28, Math.min(55, base + randomOffset));
  } else {
    // Night: 8-18 viewers
    const base = hour >= 22 ? 18 - (hour - 22) * 3 : 8 + hour * 1.5;
    return Math.max(6, Math.min(20, Math.floor(base) + randomOffset));
  }
};

// Get time-based sold today count (increases throughout the day)
const getTimeBasedSoldToday = () => {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  
  // Base sold count that increases throughout the day
  // Resets at midnight conceptually
  let baseSold = 0;
  
  if (hour >= 6 && hour < 12) {
    // Morning: Starts at 8, gradually increases
    baseSold = 8 + Math.floor((hour - 6) * 2) + Math.floor(minute / 20);
  } else if (hour >= 12 && hour < 18) {
    // Afternoon: 20 base + hourly increase
    baseSold = 20 + Math.floor((hour - 12) * 4) + Math.floor(minute / 15);
  } else if (hour >= 18 && hour < 22) {
    // Evening: 44 base + peak sales
    baseSold = 44 + Math.floor((hour - 18) * 5) + Math.floor(minute / 12);
  } else if (hour >= 22) {
    // Late night: 64 base, slower increase
    baseSold = 64 + Math.floor((hour - 22) * 2) + Math.floor(minute / 30);
  } else {
    // Early morning (0-6): Previous day carryover effect
    baseSold = 70 + Math.floor(hour * 1) + Math.floor(minute / 60);
  }
  
  // Add slight daily variation based on day of week
  const dayOfWeek = new Date().getDay();
  const dayMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 1.15 : 1; // Weekend boost
  
  // Add randomness
  const randomOffset = (minute % 5) - 2;
  
  return Math.max(5, Math.floor(baseSold * dayMultiplier) + randomOffset);
};

// Get or initialize shared stats with time-based values
export const getSharedStats = () => {
  const stored = sessionStorage.getItem('sharedStats');
  const now = Date.now();
  
  if (stored) {
    const parsed = JSON.parse(stored);
    // Refresh time-based values every 30 seconds
    if (now - parsed.lastUpdate > 30000) {
      const updated = {
        ...parsed,
        viewingNow: getTimeBasedViewingNow(),
        soldToday: getTimeBasedSoldToday(),
        lastUpdate: now
      };
      sessionStorage.setItem('sharedStats', JSON.stringify(updated));
      return updated;
    }
    return parsed;
  }
  
  // Initialize with time-based values
  const initial = {
    viewingNow: getTimeBasedViewingNow(),
    soldToday: getTimeBasedSoldToday(),
    locationIndex: Math.floor(Math.random() * INDIAN_STATES.length), // Random start location
    lastUpdate: now
  };
  sessionStorage.setItem('sharedStats', JSON.stringify(initial));
  return initial;
};

// Update shared stats
export const updateSharedStats = (updates) => {
  const current = getSharedStats();
  const updated = { ...current, ...updates, lastUpdate: Date.now() };
  sessionStorage.setItem('sharedStats', JSON.stringify(updated));
  return updated;
};

// Get current location (rotates through states)
export const getCurrentLocation = () => {
  const stats = getSharedStats();
  return INDIAN_STATES[stats.locationIndex % INDIAN_STATES.length];
};

// Rotate to next location
export const rotateLocation = () => {
  const stats = getSharedStats();
  const newIndex = (stats.locationIndex + 1) % INDIAN_STATES.length;
  updateSharedStats({ locationIndex: newIndex });
  return INDIAN_STATES[newIndex];
};

// Update viewing count with time-based bounds
export const updateViewingNow = (delta) => {
  const stats = getSharedStats();
  const timeBasedBase = getTimeBasedViewingNow();
  // Keep within ±5 of time-based value
  const newValue = Math.max(timeBasedBase - 5, Math.min(timeBasedBase + 5, stats.viewingNow + delta));
  updateSharedStats({ viewingNow: newValue });
  return newValue;
};

// Get refreshed time-based values (force update)
export const refreshTimeBasedStats = () => {
  const updated = {
    viewingNow: getTimeBasedViewingNow(),
    soldToday: getTimeBasedSoldToday(),
    locationIndex: getSharedStats().locationIndex,
    lastUpdate: Date.now()
  };
  sessionStorage.setItem('sharedStats', JSON.stringify(updated));
  return updated;
};

// Get all states for reference
export const getAllStates = () => INDIAN_STATES;

export default {
  getSharedStats,
  updateSharedStats,
  getCurrentLocation,
  rotateLocation,
  updateViewingNow,
  refreshTimeBasedStats,
  getAllStates
};
