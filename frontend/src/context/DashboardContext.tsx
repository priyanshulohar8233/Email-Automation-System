import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';

type TimeRange = 'week' | 'month' | 'quarter' | 'year';

interface DashboardContextType {
  timeRange: TimeRange;
  days: number;
  updateRange: (range: TimeRange) => void;
  selectedCompanies: string[];
  setSelectedCompanies: React.Dispatch<React.SetStateAction<string[]>>;
  companyFilter: string;
}

const rangeToDays: Record<TimeRange, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  const updateRange = (range: TimeRange) => {
    setTimeRange(range);
  };

  const companyFilter = useMemo(() => {
    return selectedCompanies.length > 0 ? selectedCompanies.join(",") : "all";
  }, [selectedCompanies]);

  const value = {
    timeRange,
    days: rangeToDays[timeRange],
    updateRange,
    selectedCompanies,
    setSelectedCompanies,
    companyFilter,
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
