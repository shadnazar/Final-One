import React, { memo } from 'react';
import { Sparkles } from 'lucide-react';

// Ingredient data with unique IDs
const INGREDIENTS = [
  { 
    id: 'ing-retinol',
    name: 'Retinol 2.5%', 
    desc: 'Gold standard for anti-aging', 
    color: 'bg-amber-100 text-amber-800'
  },
  { 
    id: 'ing-hyaluronic',
    name: 'Hyaluronic Acid', 
    desc: '72hr deep hydration', 
    color: 'bg-blue-100 text-blue-800'
  },
  { 
    id: 'ing-vitamin-c',
    name: 'Vitamin C 15%', 
    desc: 'Brightens & evens tone', 
    color: 'bg-orange-100 text-orange-800'
  },
  { 
    id: 'ing-niacinamide',
    name: 'Niacinamide 5%', 
    desc: 'Minimizes pores', 
    color: 'bg-purple-100 text-purple-800'
  },
];

// Single ingredient item
const IngredientItem = memo(({ ingredient }) => (
  <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${ingredient.color}`}>
      {ingredient.name}
    </span>
    <span className="text-sm text-gray-600">{ingredient.desc}</span>
  </div>
));
IngredientItem.displayName = 'IngredientItem';

// Ingredients list component
function IngredientsList() {
  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </span>
        Powerful Active Ingredients
      </h3>
      <div className="space-y-3">
        {INGREDIENTS.map((ingredient) => (
          <IngredientItem key={ingredient.id} ingredient={ingredient} />
        ))}
      </div>
    </div>
  );
}

export default memo(IngredientsList);
export { INGREDIENTS, IngredientItem };
