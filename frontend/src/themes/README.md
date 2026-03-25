# Advanced Theme System

A comprehensive, accessible, and customizable theme system for the Verinode frontend application.

## Features

### ✅ Core Features
- **Multiple Built-in Themes**: Light, Dark, and High Contrast themes
- **Custom Theme Creation**: Create and edit custom themes with live preview
- **Dynamic Theme Switching**: Switch themes without page reload
- **Brand Customization**: Enterprise-level branding support
- **Accessibility Focus**: WCAG-compliant color schemes and contrast ratios
- **Theme Persistence**: Automatic saving and synchronization
- **CSS Variable Based**: Modern CSS custom properties for optimal performance
- **Component-Level Overrides**: Fine-grained theme control
- **Theme Preview & Testing**: Built-in testing suite and preview tools
- **Performance Optimized**: Efficient theme switching and minimal re-renders

### 🎨 Theme Components
- **ThemeManager**: Central theme state management
- **ThemeSelector**: User-friendly theme selection interface
- **ColorPicker**: Advanced color selection with accessibility checks
- **CustomTheme**: Theme creation and editing interface
- **BrandCustomization**: Enterprise branding tools

### 🔧 Technical Features
- **TypeScript Support**: Full type safety and IntelliSense
- **React Hooks**: Modern React patterns with custom hooks
- **Service Layer**: Backend integration with API services
- **Local Storage**: Client-side persistence
- **Import/Export**: Theme sharing and backup
- **Validation**: Built-in theme validation and accessibility checks

## File Structure

```
src/
├── themes/
│   ├── ThemeManager.tsx      # Central theme management
│   ├── CustomTheme.tsx        # Custom theme creation
│   ├── BrandCustomization.tsx # Enterprise branding
│   └── README.md             # This documentation
├── components/Theme/
│   ├── ThemeSelector.tsx      # Theme selection UI
│   ├── ColorPicker.tsx        # Color picker component
│   └── ThemeTest.tsx          # Testing and preview
├── services/
│   └── themeService.ts        # Backend integration
├── hooks/
│   └── useTheme.ts            # Theme management hooks
└── types/
    └── theme.ts               # TypeScript definitions
```

## Quick Start

### 1. Wrap your app with ThemeProvider

```tsx
import { ThemeProvider } from './themes/ThemeManager';

function App() {
  return (
    <ThemeProvider>
      <Router>
        {/* Your app components */}
      </Router>
    </ThemeProvider>
  );
}
```

### 2. Use the theme hooks

```tsx
import { useTheme } from './hooks/useTheme';

function MyComponent() {
  const { currentTheme, switchTheme, getColor } = useTheme();
  
  return (
    <div style={{ backgroundColor: getColor('background') }}>
      <h1 style={{ color: getColor('text') }}>
        Hello, {currentTheme.name} Theme!
      </h1>
    </div>
  );
}
```

### 3. Add theme selector

```tsx
import ThemeSelector from './components/Theme/ThemeSelector';

function Navbar() {
  return (
    <nav>
      <ThemeSelector />
    </nav>
  );
}
```

## Built-in Themes

### Light Theme
- Clean, modern design with bright colors
- Optimized for daytime use
- High readability and comfort

### Dark Theme
- Dark background with light text
- Reduced eye strain in low-light environments
- Modern, professional appearance

### High Contrast Theme
- Maximum contrast for accessibility
- WCAG AAA compliant
- Optimized for users with visual impairments

## Custom Theme Creation

### Creating a Custom Theme

```tsx
import { useTheme } from './hooks/useTheme';

function ThemeCreator() {
  const { createCustomTheme } = useTheme();
  
  const handleCreateTheme = () => {
    createCustomTheme({
      name: 'My Custom Theme',
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        background: '#ffffff',
        // ... other colors
      },
      typography: {
        fontFamily: 'Inter, sans-serif',
        // ... typography settings
      },
      // ... other theme properties
    });
  };
  
  return <button onClick={handleCreateTheme}>Create Theme</button>;
}
```

### Using the Custom Theme Editor

The `CustomTheme` component provides a full-featured theme editor:

```tsx
import CustomTheme from './themes/CustomTheme';

function App() {
  const [showEditor, setShowEditor] = useState(false);
  
  return (
    <>
      <button onClick={() => setShowEditor(true)}>
        Create Custom Theme
      </button>
      {showEditor && (
        <CustomTheme onClose={() => setShowEditor(false)} />
      )}
    </>
  );
}
```

## Brand Customization

### Enterprise Branding

```tsx
import BrandCustomization from './themes/BrandCustomization';

function BrandSettings() {
  return (
    <BrandCustomization
      onSave={(settings) => {
        console.log('Brand settings saved:', settings);
      }}
    />
  );
}
```

### Brand Settings Include

- **Logo Management**: Upload and customize company logos
- **Brand Colors**: Define brand-specific color palettes
- **Typography**: Set brand fonts and typography
- **Custom CSS**: Add custom CSS for advanced branding
- **Meta Tags**: Configure SEO and social media metadata

## Theme Hooks

### useTheme Hook

Main hook for theme management:

```tsx
const {
  currentTheme,
  currentThemeId,
  switchTheme,
  createCustomTheme,
  updateTheme,
  deleteTheme,
  exportTheme,
  importTheme,
  getColor,
  isDarkTheme,
  isLightTheme,
  toggleTheme,
} = useTheme();
```

### Specialized Hooks

```tsx
// Get a specific theme color
const primaryColor = useThemeColor('primary');

// Get CSS variable value
const spacing = useThemeCSSVariable('spacing-md');

// Check color contrast
const { ratio, isAACompliant } = useThemeContrast('background', 'text');

// Responsive breakpoints
const { isMobile, isDesktop } = useThemeBreakpoints();

// Animation preferences
const { prefersReducedMotion } = useThemeAnimation();
```

## CSS Variables

The theme system automatically generates CSS variables:

```css
:root {
  /* Colors */
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
  --color-background: #ffffff;
  /* ... more colors */
  
  /* Typography */
  --font-family: 'Inter', sans-serif;
  --font-size-base: 1rem;
  --font-weight-medium: 500;
  
  /* Spacing */
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  
  /* Border Radius */
  --radius-sm: 0.125rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
```

## Accessibility Features

### WCAG Compliance

- **Contrast Ratios**: Automatic contrast checking
- **Color Blindness**: Considerate color choices
- **Reduced Motion**: Respects user preferences
- **Focus States**: Clear keyboard navigation
- **Screen Readers**: Semantic HTML and ARIA labels

### Accessibility Testing

```tsx
// Check if theme meets accessibility standards
const { isAACompliant, isAAACompliant } = useThemeContrast('background', 'text');

// Respect reduced motion preferences
const { prefersReducedMotion, enableAnimations } = useThemeAnimation();
```

## Performance Optimization

### Efficient Theme Switching

- **CSS Variables**: Instant theme changes without re-render
- **Local Storage**: Fast persistence and retrieval
- **Lazy Loading**: Components load themes on demand
- **Memoization**: Prevents unnecessary re-renders

### Best Practices

```tsx
// ✅ Good: Use CSS variables for styling
const StyledComponent = styled.div`
  background-color: var(--color-background);
  color: var(--color-text);
`;

// ✅ Good: Use theme hooks for dynamic values
const { getColor } = useTheme();
const dynamicStyle = { color: getColor('primary') };

// ❌ Avoid: Inline styles that cause re-renders
const badStyle = { color: currentTheme.colors.primary };
```

## Backend Integration

### Theme Service API

```tsx
import { themeService } from './services/themeService';

// Save theme to backend
await themeService.createTheme(customTheme);

// Sync theme with cloud
await themeService.syncThemeWithCloud(themeId);

// Get theme analytics
const analytics = await themeService.getThemeAnalytics(themeId);
```

### API Endpoints

- `GET /api/themes` - Get all themes
- `POST /api/themes` - Create new theme
- `PUT /api/themes/:id` - Update theme
- `DELETE /api/themes/:id` - Delete theme
- `POST /api/themes/:id/export` - Export theme
- `POST /api/themes/import` - Import theme

## Testing

### Theme Test Component

Access the theme test suite at `/theme-test` to:

- Test theme switching functionality
- Verify color palette application
- Check component rendering
- Validate accessibility compliance
- Test import/export features

### Automated Testing

```tsx
// Example test for theme switching
test('should switch themes correctly', () => {
  const { result } = renderHook(() => useTheme());
  
  act(() => {
    result.current.switchTheme('dark');
  });
  
  expect(result.current.currentThemeId).toBe('dark');
  expect(result.current.isDarkTheme).toBe(true);
});
```

## Migration Guide

### From Old Theme System

1. **Replace CSS Classes**: Move from static classes to CSS variables
2. **Update Components**: Use theme hooks instead of hardcoded colors
3. **Add ThemeProvider**: Wrap your application
4. **Update Imports**: Import from new theme modules

### Example Migration

```tsx
// Before
<div className="bg-gray-100 text-gray-900">
  <h1 className="text-xl font-bold">Title</h1>
</div>

// After
<div style={{ backgroundColor: getColor('surface'), color: getColor('text') }}>
  <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>
    Title
  </h1>
</div>
```

## Troubleshooting

### Common Issues

**Theme not applying:**
- Ensure ThemeProvider wraps your app
- Check CSS variables are being set
- Verify theme data structure

**Performance issues:**
- Use CSS variables instead of inline styles
- Avoid excessive re-renders
- Check for memory leaks

**Accessibility problems:**
- Run contrast ratio checks
- Test with screen readers
- Verify keyboard navigation

### Debug Tools

```tsx
// Enable debug mode
const { state } = useThemeManager();
console.log('Current theme state:', state);

// Check CSS variables
console.log(getComputedStyle(document.documentElement).getPropertyValue('--color-primary'));
```

## Contributing

### Adding New Features

1. **Type Definitions**: Update `types/theme.ts`
2. **Theme Manager**: Add logic to `ThemeManager.tsx`
3. **Components**: Create new components in `components/Theme/`
4. **Tests**: Add tests in `ThemeTest.tsx`
5. **Documentation**: Update this README

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public APIs
- Ensure accessibility compliance

## License

This theme system is part of the Verinode project and follows the same license terms.

## Support

For questions, issues, or feature requests:

1. Check the troubleshooting section
2. Review the test suite at `/theme-test`
3. Create an issue in the project repository
4. Contact the development team
