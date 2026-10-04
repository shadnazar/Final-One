import React, { memo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Stat card component - reusable across admin pages
const StatCard = memo(({ 
  title, 
  value, 
  change, 
  changeType = 'neutral', // 'up', 'down', 'neutral'
  icon: Icon,
  iconColor = 'text-green-600',
  bgColor = 'bg-green-50'
}) => {
  const changeIcon = changeType === 'up' ? TrendingUp : changeType === 'down' ? TrendingDown : Minus;
  const changeColor = changeType === 'up' ? 'text-green-600' : changeType === 'down' ? 'text-red-600' : 'text-gray-500';
  
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{title}</span>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center`}>
            <Icon size={16} className={iconColor} />
          </div>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${changeColor}`}>
            {React.createElement(changeIcon, { size: 12 })}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
    </div>
  );
});
StatCard.displayName = 'StatCard';

// Stats grid for dashboard
const StatsGrid = memo(({ stats }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    {stats.map((stat) => (
      <StatCard key={stat.id} {...stat} />
    ))}
  </div>
));
StatsGrid.displayName = 'StatsGrid';

// Loading spinner
const LoadingSpinner = memo(({ size = 'md', message = 'Loading...' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };
  
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className={`${sizeClasses[size]} border-4 border-green-200 border-t-green-600 rounded-full animate-spin`} />
      {message && <p className="text-gray-500 mt-3 text-sm">{message}</p>}
    </div>
  );
});
LoadingSpinner.displayName = 'LoadingSpinner';

// Empty state component
const EmptyState = memo(({ icon: Icon, title, description, action }) => (
  <div className="text-center py-12">
    {Icon && (
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Icon size={24} className="text-gray-400" />
      </div>
    )}
    <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
    {description && <p className="text-gray-500 text-sm mb-4">{description}</p>}
    {action}
  </div>
));
EmptyState.displayName = 'EmptyState';

// Tab navigation
const TabNav = memo(({ tabs, activeTab, onTabChange }) => (
  <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
          activeTab === tab.id
            ? 'border-green-600 text-green-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        {tab.icon && <tab.icon size={16} className="inline mr-2" />}
        {tab.label}
        {tab.count !== undefined && (
          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
            activeTab === tab.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {tab.count}
          </span>
        )}
      </button>
    ))}
  </div>
));
TabNav.displayName = 'TabNav';

// Data table with unique keys
const DataTable = memo(({ columns, data, keyField = 'id', onRowClick, emptyMessage = 'No data available' }) => {
  if (!data || data.length === 0) {
    return <p className="text-center text-gray-500 py-8">{emptyMessage}</p>;
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="text-left px-4 py-3 font-medium text-gray-600">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row) => (
            <tr 
              key={row[keyField] || `row-${Math.random()}`}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
            >
              {columns.map((col) => (
                <td key={`${row[keyField]}-${col.key}`} className="px-4 py-3 text-gray-700">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
DataTable.displayName = 'DataTable';

export { StatCard, StatsGrid, LoadingSpinner, EmptyState, TabNav, DataTable };
