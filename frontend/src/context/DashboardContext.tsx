import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

type PeriodLabel = 'week' | 'month' | 'quarter' | 'year';

interface DashboardContextType {
  days: number;
  setDays: (days: number) => void;
  selectedCompanies: string[];
  setSelectedCompanies: (companies: string[] | ((prev: string[]) => string[])) => void;
  periodLabel: PeriodLabel;
  companyString: string;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [days, setDaysState] = useState<number>(() => {
    const saved = localStorage.getItem("dashboard_days");
    return saved ? parseInt(saved) : 30;
  });

  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  const setDays = (d: number) => {
    setDaysState(d);
    localStorage.setItem("dashboard_days", d.toString());
  };

  const periodLabel = useMemo((): PeriodLabel => {
    if (days === 7) return 'week';
    if (days === 90) return 'quarter';
    if (days === 365) return 'year';
    return 'month';
  }, [days]);

  const companyString = useMemo(() => {
    return selectedCompanies.length > 0 ? selectedCompanies.join(",") : "all";
  }, [selectedCompanies]);

  return (
    <DashboardContext.Provider value={{ 
      days, 
      setDays, 
      selectedCompanies, 
      setSelectedCompanies, 
      periodLabel,
      companyString
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
