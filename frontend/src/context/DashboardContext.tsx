import React, { createContext, useContext, useState, ReactNode } from 'react';

type TimeRange = 'week' | 'month' | 'quarter' | 'year';

interface DashboardContextType {
  timeRange: TimeRange;
  days: number;
  updateRange: (range: TimeRange) => void;
}

const rangeToDays: Record<TimeRange, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('month');

  const updateRange = (range: TimeRange) => {
    setTimeRange(range);
  };

  const value = {
    timeRange,
    days: rangeToDays[timeRange],
    updateRange,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
