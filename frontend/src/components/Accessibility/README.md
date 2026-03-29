# Accessibility Components

This directory contains comprehensive accessibility components and utilities for the Verinode application, designed to provide WCAG 2.2 AA compliance and enhance the user experience for people with disabilities.

## Components Overview

### 1. ScreenReader Component (`ScreenReader.tsx`)
Provides screen reader support and announcements for accessibility.

**Features:**
- Auto-detection of screen reader usage
- ARIA live regions for announcements
- Page navigation announcements
- Form validation announcements
- ARIA landmark setup
- Screen reader controls for developers

**Usage:**
```tsx
import { ScreenReader } from '../components/Accessibility/ScreenReader';

<ScreenReader announcements={true} autoDetect={true} />
```

### 2. KeyboardNavigation Component (`KeyboardNavigation.tsx`)
Provides comprehensive keyboard navigation support and shortcuts.

**Features:**
- Custom keyboard shortcuts
- Focus management and indicators
- Skip links
- Menu navigation
- Help modal for shortcuts
- Tab order management

**Default Shortcuts:**
- `Alt+H` - Show keyboard shortcuts help
- `Alt+S` - Skip to main content
- `Alt+N` - Go to navigation
- `Alt+F` - Go to search
- `Alt+A` - Toggle accessibility menu
- `Alt+C` - Toggle high contrast
- `Alt+M` - Toggle reduced motion
- `Alt+L` - Toggle large text
- `Escape` - Close dialogs

**Usage:**
```tsx
import { KeyboardNavigation } from '../components/Accessibility/KeyboardNavigation';

<KeyboardNavigation 
  enableShortcuts={true} 
  showHelp={true}
  customShortcuts={{
    'Alt+P': { description: 'Print page', action: () => window.print() }
  }}
/>
```

### 3. VoiceCommands Component (`VoiceCommands.tsx`)
Provides voice command functionality for hands-free navigation.

**Features:**
- Voice recognition integration
- Custom voice commands
- Visual feedback indicators
- Command history
- Microphone permission handling

**Default Commands:**
- "Navigate home" - Go to home page
- "Navigate dashboard" - Go to dashboard
- "Navigate search" - Go to search page
- "Toggle high contrast" - Toggle high contrast mode
- "Toggle voice commands" - Enable/disable voice commands
- "Help" - Announce available commands

**Usage:**
```tsx
import { VoiceCommands } from '../components/Accessibility/VoiceCommands';

<VoiceCommands 
  showIndicator={true}
  customCommands={{
    'scroll down': () => window.scrollBy(0, 500),
    'scroll up': () => window.scrollBy(0, -500)
  }}
/>
```

### 4. HighContrast Component (`HighContrast.tsx`)
Provides high contrast mode and color blind support.

**Features:**
- Multiple high contrast presets
- Color blind mode filters (protanopia, deuteranopia, tritanopia)
- Font size adjustments
- Large text support
- Visual accessibility controls

**Color Blind Modes:**
- None - Normal color vision
- Protanopia - Red-blind
- Deuteranopia - Green-blind
- Tritanopia - Blue-blind

**Font Sizes:**
- Small (14px)
- Medium (16px) - Default
- Large (18px)
- Extra Large (20px)

**Usage:**
```tsx
import { HighContrast } from '../components/Accessibility/HighContrast';

<HighContrast 
  showToggle={true} 
  colorBlindSupport={true}
/>
```

## Services and Utilities

### Accessibility Service (`accessibilityService.ts`)
Central service for managing accessibility features and preferences.

**Features:**
- Preference management and persistence
- System preference detection
- WCAG compliance validation
- Accessibility reporting
- ARIA announcements

**Key Methods:**
```typescript
// Update preferences
accessibilityService.updatePreference('highContrast', true);

// Get preferences
const prefs = accessibilityService.getAllPreferences();

// Validate WCAG compliance
const compliance = accessibilityService.validateWCAGCompliance();

// Generate report
const report = accessibilityService.generateAccessibilityReport();
```

### Accessibility Hook (`useAccessibility.ts`)
React hook for accessing accessibility features in components.

**Features:**
- Preference state management
- Screen reader detection
- Focus management utilities
- Voice command integration
- Accessibility validation

**Usage:**
```tsx
import { useAccessibility } from '../hooks/useAccessibility';

function MyComponent() {
  const { 
    preferences, 
    updatePreference, 
    announce, 
    trapFocus 
  } = useAccessibility();

  const handleModalOpen = () => {
    const releaseFocus = trapFocus(modalRef.current);
    // ... modal logic
    return releaseFocus;
  };
}
```

### Accessibility Utilities (`accessibilityUtils.ts`)
Helper functions for accessibility features and WCAG compliance.

**Classes:**
- `FocusManager` - Focus management and trapping
- `AriaUtils` - ARIA attribute management
- `ColorContrast` - Color contrast calculations
- `KeyboardNavigation` - Keyboard navigation utilities
- `ScreenReaderUtils` - Screen reader detection and utilities
- `AccessibilityValidator` - WCAG validation helpers
- `VoiceCommandUtils` - Voice command utilities

**Usage Examples:**
```typescript
import { FocusManager, AriaUtils, ColorContrast } from '../utils/accessibilityUtils';

// Focus management
FocusManager.saveFocus();
const releaseFocus = FocusManager.trapFocus(modalElement);
FocusManager.restoreFocus();

// ARIA attributes
AriaUtils.setAriaAttributes(element, {
  'aria-label': 'Close dialog',
  'aria-expanded': 'false'
});

// Color contrast
const ratio = ColorContrast.getContrastRatio('#ffffff', '#000000');
const meetsAA = ColorContrast.meetsWCAG('#ffffff', '#000000', 'AA');
```

### Accessibility Testing (`accessibilityTesting.ts`)
Automated testing utilities for WCAG 2.2 compliance.

**Features:**
- Comprehensive WCAG 2.2 test suite
- Automated accessibility audit
- HTML and JSON report generation
- Compliance level assessment
- Recommendations generation

**Test Categories:**
- Images (alt text, decorative images)
- Headings (structure, hierarchy)
- Forms (labels, required fields)
- Focus (management, indicators)
- Color contrast (ratios, compliance)
- ARIA (attributes, roles)
- Links (purpose, text)
- Tables (structure, headers)
- Keyboard navigation
- Landmarks (page structure)

**Usage:**
```typescript
import { accessibilityTester } from '../utils/accessibilityTesting';

// Run full accessibility test
const report = accessibilityTester.runFullTest();

// Export as JSON
const jsonReport = accessibilityTester.exportReport(report, 'json');

// Export as HTML
const htmlReport = accessibilityTester.exportReport(report, 'html');
```

## Integration

### App.tsx Integration
All accessibility components are integrated into the main App component:

```tsx
import { ScreenReader } from './components/Accessibility/ScreenReader';
import { KeyboardNavigation } from './components/Accessibility/KeyboardNavigation';
import { VoiceCommands } from './components/Accessibility/VoiceCommands';
import { HighContrast } from './components/Accessibility/HighContrast';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        {/* Accessibility Components */}
        <ScreenReader />
        <KeyboardNavigation enableShortcuts={true} showHelp={true} />
        <VoiceCommands showIndicator={true} />
        <HighContrast showToggle={true} colorBlindSupport={true} />
        
        {/* Rest of app */}
        <div className="min-h-screen bg-gray-50">
          {/* ... */}
        </div>
      </Router>
    </QueryClientProvider>
  );
}
```

## CSS Classes and Styling

### Screen Reader Only Content
```css
.sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

.focus\:not-sr-only:focus {
  position: static !important;
  width: auto !important;
  height: auto !important;
  padding: inherit !important;
  margin: inherit !important;
  overflow: visible !important;
  clip: auto !important;
  white-space: normal !important;
}
```

### High Contrast Mode
```css
.high-contrast {
  /* Applied automatically when high contrast is enabled */
}

.reduced-motion * {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}

.large-text {
  font-size: 1.2em !important;
}

.keyboard-nav *:focus {
  outline: 2px solid #0066cc !important;
  outline-offset: 2px !important;
}
```

## WCAG 2.2 Compliance

This implementation addresses the following WCAG 2.2 requirements:

### Level A
- **1.1.1 Non-text Content**: All images have appropriate alt text
- **1.3.1 Info and Relationships**: Proper heading structure and semantic markup
- **1.3.2 Meaningful Sequence**: Content maintains logical order when styles are removed
- **1.4.1 Use of Color**: Information not conveyed by color alone
- **2.1.1 Keyboard**: All functionality available via keyboard
- **2.4.1 Bypass Blocks**: Skip links provided for navigation
- **2.4.2 Page Titled**: Each page has descriptive title
- **3.1.1 Language of Page**: Page language is programmatically determined
- **3.2.1 On Focus**: No unexpected context changes on focus
- **3.3.2 Labels or Instructions**: Form elements have proper labels
- **4.1.1 Parsing**: No markup errors
- **4.1.2 Name, Role, Value**: All interactive elements have proper roles

### Level AA
- **1.2.4 Captions (Live)**: Live audio content has captions
- **1.2.5 Audio Descriptions (Pre-recorded)**: Video content has audio descriptions
- **1.4.3 Contrast (Minimum)**: Text has minimum 4.5:1 contrast ratio
- **1.4.5 Images of Text**: Text in images has minimum contrast
- **1.4.6 Contrast (Enhanced)**: Large text has minimum 3:1 contrast ratio
- **2.4.3 Focus Order**: Logical focus sequence
- **2.4.4 Link Purpose**: Link text is descriptive
- **2.4.5 Multiple Ways**: Multiple navigation methods provided
- **2.4.6 Headings and Labels**: Descriptive headings and labels
- **2.4.7 Focus Visible**: Clear focus indicators
- **3.2.2 On Input**: No unexpected context changes on input
- **3.2.3 Consistent Navigation**: Consistent navigation patterns
- **3.2.4 Consistent Identification**: Consistent element identification
- **3.3.1 Error Identification**: Error messages are clearly identified
- **3.3.3 Error Suggestion**: Suggestions for error correction provided
- **3.3.4 Error Prevention (Legal, Financial, Data)**: Confirmation for critical actions

### Level AAA
- **1.2.6 Sign Language (Pre-recorded)**: Sign language interpretation provided
- **1.2.7 Extended Audio Description (Pre-recorded)**: Extended audio descriptions
- **1.2.8 Media Alternative (Prerecorded)**: Text alternatives for media
- **1.2.9 Audio-only (Live)**: Text alternatives for live audio
- **1.4.7 Low or No Background Audio**: Background audio can be turned off
- **1.4.8 Visual Presentation**: Text spacing and alignment options
- **1.4.9 Images of Text (No Exception)**: No text in images
- **2.1.3 Keyboard (No Exception)**: All functionality keyboard accessible
- **2.2.1 Timing Adjustable**: Time limits can be extended
- **2.2.2 Pause, Stop, Hide**: Moving content can be paused
- **2.3.1 Three Flashes or Below**: No seizure-inducing content
- **2.5.1 Pointer Gestures**: Complex gestures not required
- **2.5.2 Pointer Cancellation**: Actions can be canceled
- **2.5.3 Label in Name**: Accessible name contains visible label
- **2.5.4 Motion Actuation**: Motion can be disabled
- **3.1.2 Language of Parts**: Language changes are identified
- **3.1.3 Unusual Words**: Definitions for unusual words
- **3.1.4 Abbreviations**: Abbreviations are explained
- **3.1.5 Reading Level**: Content written at lower secondary level
- **3.1.6 Pronunciation**: Pronunciation provided for unusual words

## Testing and Validation

### Automated Testing
Run the accessibility test suite:

```typescript
import { accessibilityTester } from '../utils/accessibilityTesting';

const report = accessibilityTester.runFullTest();
console.log('Accessibility Score:', report.overallScore);
console.log('Compliance Level:', report.overallCompliance);
```

### Manual Testing Checklist
- [ ] Test with screen readers (NVDA, JAWS, VoiceOver)
- [ ] Test keyboard-only navigation
- [ ] Test with high contrast mode
- [ ] Test with color blind simulators
- [ ] Test with various font sizes
- [ ] Test with reduced motion preferences
- [ ] Test voice commands functionality
- [ ] Verify focus indicators are visible
- [ ] Check all interactive elements are reachable
- [ ] Validate form labels and error messages

### Browser Developer Tools
Use browser accessibility tools:
- Chrome DevTools Accessibility tab
- Firefox Accessibility Inspector
- Safari Accessibility Inspector
- axe DevTools extension

## Best Practices

### Development Guidelines
1. **Semantic HTML**: Use appropriate HTML elements for their intended purpose
2. **ARIA Attributes**: Use ARIA to enhance, not replace, semantic HTML
3. **Keyboard Navigation**: Ensure all functionality is keyboard accessible
4. **Focus Management**: Provide clear focus indicators and logical tab order
5. **Color Contrast**: Meet minimum contrast ratios for text and UI elements
6. **Alternative Text**: Provide descriptive alt text for meaningful images
7. **Form Accessibility**: Label all form inputs and provide clear error messages
8. **Testing**: Include accessibility testing in your development workflow

### Code Review Checklist
- [ ] Semantic HTML elements used appropriately
- [ ] All interactive elements have keyboard access
- [ ] Focus indicators are visible and clear
- [ ] Images have appropriate alt text
- [ ] Form elements have proper labels
- [ ] Color contrast meets WCAG requirements
- [ ] ARIA attributes used correctly
- [ ] Heading structure is logical
- [ ] Skip links provided for navigation
- [ ] No content conveyed only by color

## Support and Resources

### Documentation
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Web Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

### Testing Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Web Accessibility Evaluator](https://wave.webaim.org/)
- [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/)
- [Screen Reader Simulators](https://webaim.org/articles/screenreader_simulator/)

### Browser Extensions
- axe DevTools
- WAVE Extension
- Accessibility Insights for Web
- Color Contrast Analyzer

## Contributing

When contributing to accessibility features:
1. Test with multiple screen readers
2. Verify keyboard navigation
3. Check color contrast ratios
4. Run automated accessibility tests
5. Include accessibility in unit tests
6. Update documentation as needed

## License

This accessibility implementation follows WCAG 2.2 guidelines and is designed to be inclusive for all users.
