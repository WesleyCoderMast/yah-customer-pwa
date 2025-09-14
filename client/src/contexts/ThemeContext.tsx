import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isAutoMode: boolean;
  setAutoMode: (auto: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Initialize theme from localStorage immediately to prevent flash
  const [theme, setTheme] = useState<Theme>(() => {
    const savedAutoMode = localStorage.getItem('theme-auto-mode');
    const savedTheme = localStorage.getItem('theme-manual');
    
    if (savedAutoMode === 'false' && savedTheme) {
      return savedTheme as Theme;
    }
    
    // Default or auto mode - determine by time
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= 18 || currentHour < 6 ? 'dark' : 'light';
  });
  
  const [isAutoMode, setIsAutoMode] = useState(() => {
    const savedAutoMode = localStorage.getItem('theme-auto-mode');
    return savedAutoMode ? JSON.parse(savedAutoMode) : true;
  });

  // Calculate seasonal sunrise/sunset times based on user's timezone and date
  const getSeasonalTimes = () => {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const latitude = 40.7128; // Default to NYC latitude, can be enhanced with geolocation
    
    // Approximate seasonal adjustments
    let sunriseHour = 6;
    let sunsetHour = 18;
    
    // Winter months (Dec, Jan, Feb) - shorter days
    if (month === 11 || month === 0 || month === 1) {
      sunriseHour = 7;
      sunsetHour = 17;
    }
    // Spring months (Mar, Apr, May)
    else if (month >= 2 && month <= 4) {
      sunriseHour = 6;
      sunsetHour = 19;
    }
    // Summer months (Jun, Jul, Aug) - longer days
    else if (month >= 5 && month <= 7) {
      sunriseHour = 5;
      sunsetHour = 20;
    }
    // Fall months (Sep, Oct, Nov)
    else if (month >= 8 && month <= 10) {
      sunriseHour = 6;
      sunsetHour = 18;
    }
    
    return { sunriseHour, sunsetHour };
  };

  const determineThemeByTime = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const { sunriseHour, sunsetHour } = getSeasonalTimes();
    
    // Dark mode between sunset and sunrise
    return currentHour >= sunsetHour || currentHour < sunriseHour ? 'dark' : 'light';
  };

  useEffect(() => {
    // Load saved preferences
    const savedAutoMode = localStorage.getItem('theme-auto-mode');
    const savedTheme = localStorage.getItem('theme-manual');
    
    // Set auto mode first
    if (savedAutoMode !== null) {
      const autoMode = JSON.parse(savedAutoMode);
      setIsAutoMode(autoMode);
      
      // If manual mode and we have a saved theme, use it
      if (!autoMode && savedTheme) {
        setTheme(savedTheme as Theme);
      } else {
        // Auto mode or first time - determine by time
        setTheme(determineThemeByTime());
      }
    } else {
      // First time - default to auto mode
      setIsAutoMode(true);
      setTheme(determineThemeByTime());
    }
  }, []);

  useEffect(() => {
    if (isAutoMode) {
      // Update theme based on current time
      setTheme(determineThemeByTime());
      
      // Set up interval to check every minute for theme changes
      const interval = setInterval(() => {
        const newTheme = determineThemeByTime();
        setTheme(current => {
          if (current !== newTheme) {
            return newTheme;
          }
          return current;
        });
      }, 60000); // Check every minute
      
      return () => clearInterval(interval);
    }
  }, [isAutoMode]);

  useEffect(() => {
    // Apply theme to document - Tailwind CSS only needs 'dark' class
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    setIsAutoMode(false);
    localStorage.setItem('theme-auto-mode', 'false');
    localStorage.setItem('theme-manual', newTheme);
  };

  const setAutoMode = (auto: boolean) => {
    setIsAutoMode(auto);
    localStorage.setItem('theme-auto-mode', JSON.stringify(auto));
    
    if (auto) {
      // Switch to time-based theme immediately
      setTheme(determineThemeByTime());
      localStorage.removeItem('theme-manual');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isAutoMode, setAutoMode }}>
      {children}
    </ThemeContext.Provider>
  );
};