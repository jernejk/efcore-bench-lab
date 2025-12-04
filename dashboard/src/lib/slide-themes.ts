// Slide theme definitions

export interface SlideTheme {
  id: string;
  name: string;
  background: string; // CSS background value (gradient or color)
  backgroundColor: string; // Solid fallback color for image export
  backgroundImage?: string; // Optional background image URL
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  accent: {
    primary: string;
    success: string;
    warning: string;
    error: string;
    purple: string;
  };
  card: {
    background: string;
    border: string;
  };
  chart: {
    grid: string;
    colors: string[]; // Chart bar colors (avoid blue for SSW)
  };
  footer: {
    text: string;
  };
}

// Default fallback colors
export const THEME_DEFAULTS = {
  DARK_BG: "#1a1a2e",
  DARK_VIBRANT_BG: "#0f172a",
  SSW_BG: "#f5f5f5",
} as const;

export const SLIDE_THEMES: Record<string, SlideTheme> = {
  dark: {
    id: "dark",
    name: "Dark (Default)",
    background: "linear-gradient(160deg, #1e1e24 0%, #252530 50%, #1e1e24 100%)",
    backgroundColor: THEME_DEFAULTS.DARK_BG,
    text: {
      primary: "#ffffff",
      secondary: "#d1d5db",
      muted: "#9ca3af",
    },
    accent: {
      primary: "#7c9a92",      // Sage green (matches first chart bar)
      success: "#5cb176",      // Muted green for success text
      warning: "#e5a83b",      // Warm amber/gold
      error: "#e57373",        // Muted coral red
      purple: "#a78bfa",
    },
    card: {
      background: "rgba(45,48,56,0.75)",
      border: "rgba(90,95,105,0.35)",
    },
    chart: {
      grid: "#3a3f4a",
      // Muted, professional colors: sage, teal, orange, coral, purple, pink
      colors: ["#8a9f97", "#7a9e8e", "#e5a83b", "#e57373", "#a78bfa", "#d17ba3"],
    },
    footer: {
      text: "#6b7280",
    },
  },
  "dark-vibrant": {
    id: "dark-vibrant",
    name: "Dark Vibrant",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
    backgroundColor: THEME_DEFAULTS.DARK_VIBRANT_BG,
    text: {
      primary: "#ffffff",
      secondary: "#e2e8f0",
      muted: "#94a3b8",
    },
    accent: {
      primary: "#3b82f6",
      success: "#4ade80",
      warning: "#fbbf24",
      error: "#f87171",
      purple: "#a78bfa",
    },
    card: {
      background: "rgba(30,41,59,0.6)",
      border: "rgba(51,65,85,0.5)",
    },
    chart: {
      grid: "#334155",
      colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"],
    },
    footer: {
      text: "#64748b",
    },
  },
  ssw: {
    id: "ssw",
    name: "SSW Light",
    background: "#f5f5f5",
    backgroundColor: THEME_DEFAULTS.SSW_BG,
    backgroundImage: "/ssw-slide.png",
    text: {
      primary: "#333333",
      secondary: "#333333",
      muted: "#797979",
    },
    accent: {
      primary: "#CC4141",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#CC4141",
      purple: "#7c3aed",
    },
    card: {
      background: "rgba(255,255,255,0.85)",
      border: "rgba(170,170,170,0.3)",
    },
    chart: {
      grid: "#AAAAAA",
      // SSW colors - avoid blue, use red as primary
      colors: ["#CC4141", "#10b981", "#f59e0b", "#7c3aed", "#ec4899", "#333333"],
    },
    footer: {
      text: "#797979",
    },
  },
};

// Resource chart colors per theme (consistent across variants)
export const RESOURCE_CHART_COLORS: Record<string, { cpu: string; memory: string; peak: string }> = {
  dark: {
    cpu: "#7a9e8e",    // Teal green
    memory: "#8a9f97", // Sage
    peak: "#e5a83b",   // Warm amber
  },
  "dark-vibrant": {
    cpu: "#06b6d4",
    memory: "#8b5cf6", 
    peak: "#ec4899",
  },
  ssw: {
    cpu: "#10b981",    // Green (no blue)
    memory: "#CC4141", // SSW Red
    peak: "#7c3aed",   // Purple
  },
};

// LocalStorage key
const THEME_STORAGE_KEY = "efcore-perf-slide-theme";

export function getSavedTheme(): string {
  if (typeof window === "undefined") return "dark";
  return localStorage.getItem(THEME_STORAGE_KEY) || "dark";
}

export function saveTheme(themeId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, themeId);
}

export function getTheme(themeId: string): SlideTheme {
  return SLIDE_THEMES[themeId] || SLIDE_THEMES.dark;
}

/**
 * Get the solid background color for image export.
 * Uses the theme's explicit backgroundColor property.
 */
export function getThemeBackgroundColor(theme: SlideTheme): string {
  return theme.backgroundColor;
}

/**
 * Build the CSS background styles for a theme.
 * Handles both gradient and image backgrounds correctly.
 */
export function getThemeBackgroundStyles(theme: SlideTheme): React.CSSProperties {
  if (theme.backgroundImage) {
    // Image background: use solid color + image overlay
    return {
      backgroundColor: theme.backgroundColor,
      backgroundImage: `url(${theme.backgroundImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  // Gradient background
  return {
    background: theme.background,
  };
}

