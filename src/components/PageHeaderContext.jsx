import React, { createContext, useContext, useState, useCallback } from 'react';

const PageHeaderContext = createContext(null);

export function PageHeaderProvider({ children }) {
  const [headerConfig, setHeaderConfig] = useState({
    title: '',
    showBackButton: false,
    backPath: null,
    onBackClick: null,
    rightAction: null,
    show: false
  });

  const setPageHeader = useCallback((config) => {
    setHeaderConfig({
      title: config.title || '',
      showBackButton: config.showBackButton || false,
      backPath: config.backPath || null,
      onBackClick: config.onBackClick || null,
      rightAction: config.rightAction || null,
      show: true
    });
  }, []);

  const hidePageHeader = useCallback(() => {
    setHeaderConfig(prev => ({ ...prev, show: false }));
  }, []);

  return (
    <PageHeaderContext.Provider value={{ headerConfig, setPageHeader, hidePageHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader(config) {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error('usePageHeader must be used within a PageHeaderProvider');
  }

  // Auto-set header on mount if config provided
  React.useEffect(() => {
    if (config) {
      context.setPageHeader(config);
    }
    return () => {
      context.hidePageHeader();
    };
  }, []);

  return context;
}

export function usePageHeaderContext() {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error('usePageHeaderContext must be used within a PageHeaderProvider');
  }
  return context;
}
