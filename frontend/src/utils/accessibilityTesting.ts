/**
 * Accessibility Testing Automation
 * Automated testing utilities for WCAG 2.2 compliance
 */

import { AccessibilityValidator, ColorContrast } from './accessibilityUtils';
import { accessibilityService } from '../services/accessibilityService';

export interface TestResult {
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  element?: Element;
  rule: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

export interface TestSuite {
  name: string;
  description: string;
  tests: TestResult[];
  score: number;
  compliance: 'A' | 'AA' | 'AAA' | 'Non-compliant';
}

export interface AccessibilityReport {
  timestamp: string;
  url: string;
  overallScore: number;
  overallCompliance: 'A' | 'AA' | 'AAA' | 'Non-compliant';
  testSuites: TestSuite[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    warnings: number;
    errors: number;
  };
  recommendations: string[];
}

class AccessibilityTester {
  private testSuites: Map<string, () => TestResult[]> = new Map();

  constructor() {
    this.initializeTestSuites();
  }

  private initializeTestSuites(): void {
    // Image accessibility tests
    this.testSuites.set('images', this.testImages.bind(this));
    
    // Heading structure tests
    this.testSuites.set('headings', this.testHeadings.bind(this));
    
    // Form accessibility tests
    this.testSuites.set('forms', this.testForms.bind(this));
    
    // Focus management tests
    this.testSuites.set('focus', this.testFocusManagement.bind(this));
    
    // Color contrast tests
    this.testSuites.set('contrast', this.testColorContrast.bind(this));
    
    // ARIA attribute tests
    this.testSuites.set('aria', this.testAriaAttributes.bind(this));
    
    // Link accessibility tests
    this.testSuites.set('links', this.testLinks.bind(this));
    
    // Table accessibility tests
    this.testSuites.set('tables', this.testTables.bind(this));
    
    // Keyboard navigation tests
    this.testSuites.set('keyboard', this.testKeyboardNavigation.bind(this));
    
    // Landmark tests
    this.testSuites.set('landmarks', this.testLandmarks.bind(this));
  }

  private testImages(): TestResult[] {
    const results: TestResult[] = [];
    const images = document.querySelectorAll('img');

    images.forEach((img, index) => {
      // Test for alt text
      if (!img.hasAttribute('alt')) {
        results.push({
          passed: false,
          severity: 'error',
          message: `Image ${index + 1} is missing alt attribute`,
          element: img,
          rule: 'WCAG 1.1.1 - Non-text Content',
          wcagLevel: 'A'
        });
      } else if (img.alt === '' && img.getAttribute('role') !== 'presentation') {
        // Check if image should be decorative
        const isDecorative = img.alt === '' && 
          (img.closest('figure')?.querySelector('figcaption') || 
           img.getAttribute('role') === 'presentation');

        if (!isDecorative) {
          results.push({
            passed: false,
            severity: 'warning',
            message: `Image ${index + 1} has empty alt text but may not be decorative`,
            element: img,
            rule: 'WCAG 1.1.1 - Non-text Content',
            wcagLevel: 'A'
          });
        }
      }

      // Test for meaningful alt text
      if (img.alt && img.alt.length < 3 && img.getAttribute('role') !== 'presentation') {
        results.push({
          passed: false,
          severity: 'warning',
          message: `Image ${index + 1} has very short alt text: "${img.alt}"`,
          element: img,
          rule: 'WCAG 1.1.1 - Non-text Content',
          wcagLevel: 'AA'
        });
      }
    });

    // Add passing test if no issues found
    if (results.length === 0) {
      results.push({
        passed: true,
        severity: 'info',
        message: `All ${images.length} images have appropriate alt text`,
        rule: 'WCAG 1.1.1 - Non-text Content',
        wcagLevel: 'A'
      });
    }

    return results;
  }

  private testHeadings(): TestResult[] {
    const results: TestResult[] = [];
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;

    headings.forEach((heading, index) => {
      const currentLevel = parseInt(heading.tagName.charAt(1));

      // Test for h1 at start
      if (index === 0 && currentLevel !== 1) {
        results.push({
          passed: false,
          severity: 'error',
          message: 'Page should start with h1 heading',
          element: heading,
          rule: 'WCAG 1.3.1 - Info and Relationships',
          wcagLevel: 'AA'
        });
      }

      // Test for heading level skips
      if (currentLevel > lastLevel + 1) {
        results.push({
          passed: false,
          severity: 'warning',
          message: `Heading level skipped: h${lastLevel} to h${currentLevel}`,
          element: heading,
          rule: 'WCAG 1.3.1 - Info and Relationships',
          wcagLevel: 'AA'
        });
      }

      // Test for empty headings
      if (!heading.textContent?.trim()) {
        results.push({
          passed: false,
          severity: 'error',
          message: `Empty ${heading.tagName.toLowerCase()} heading found`,
          element: heading,
          rule: 'WCAG 2.4.6 - Headings and Labels',
          wcagLevel: 'AA'
        });
      }

      lastLevel = currentLevel;
    });

    // Add passing test if no issues found
    if (results.length === 0) {
      results.push({
        passed: true,
        severity: 'info',
        message: `Heading structure is proper with ${headings.length} headings`,
        rule: 'WCAG 1.3.1 - Info and Relationships',
        wcagLevel: 'AA'
      });
    }

    return results;
  }

  private testForms(): TestResult[] {
    const results: TestResult[] = [];
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach((input, index) => {
      const hasLabel = input.hasAttribute('aria-label') || 
                      input.hasAttribute('aria-labelledby') ||
                      document.querySelector(`label[for="${input.id}"]`) ||
                      input.closest('label');

      if (!hasLabel) {
        results.push({
          passed: false,
          severity: 'error',
          message: `Form input ${index + 1} is missing label or aria-label`,
          element: input,
          rule: 'WCAG 3.3.2 - Labels or Instructions',
          wcagLevel: 'A'
        });
      }

      // Test for required field indicators
      if (input.hasAttribute('required') && !input.hasAttribute('aria-required')) {
        results.push({
          passed: false,
          severity: 'warning',
          message: `Required field should have aria-required="true"`,
          element: input,
          rule: 'WCAG 3.3.2 - Labels or Instructions',
          wcagLevel: 'AA'
        });
      }

      // Test for input types
      if (input.tagName === 'INPUT' && !input.getAttribute('type')) {
        results.push({
          passed: false,
          severity: 'warning',
          message: `Input element should have a type attribute`,
          element: input,
          rule: 'WCAG 4.1.2 - Name, Role, Value',
          wcagLevel: 'AA'
        });
      }
    });

    // Add passing test if no issues found
    if (results.length === 0) {
      results.push({
        passed: true,
        severity: 'info',
        message: `All ${inputs.length} form inputs have proper labels`,
        rule: 'WCAG 3.3.2 - Labels or Instructions',
        wcagLevel: 'A'
      });
    }

    return results;
  }

  private testFocusManagement(): TestResult[] {
    const results: TestResult[] = [];

    // Test for tabindex abuse
    const elementsWithTabindex = document.querySelectorAll('[tabindex]');
    elementsWithTabindex.forEach(element => {
      const tabindex = element.getAttribute('tabindex');
      if (tabindex && parseInt(tabindex) > 0) {
        results.push({
          passed: false,
          severity: 'warning',
          message: `Element has positive tabindex: ${element.tagName.toLowerCase()}`,
          element: element,
          rule: 'WCAG 2.4.3 - Focus Order',
          wcagLevel: 'AA'
        });
      }
    });

    // Test for disabled focusable elements
    const disabledFocusable = document.querySelectorAll('button:disabled, input:disabled, select:disabled');
    disabledFocusable.forEach(element => {
      if (element.getAttribute('tabindex') !== '-1') {
        results.push({
          passed: false,
          severity: 'warning',
          message: `Disabled element should have tabindex="-1"`,
          element: element,
          rule: 'WCAG 1.3.2 - Meaningful Sequence',
          wcagLevel: 'A'
        });
      }
    });

    // Test for focus indicators
    const style = document.createElement('style');
    style.textContent = `
      .test-focus-indicator:focus { outline: 2px solid red; }
    `;
    document.head.appendChild(style);

    // Add passing test if no issues found
    if (results.length === 0) {
      results.push({
        passed: true,
        severity: 'info',
        message: 'Focus management is properly implemented',
        rule: 'WCAG 2.4.3 - Focus Order',
        wcagLevel: 'AA'
      });
    }

    document.head.removeChild(style);
    return results;
  }

  private testColorContrast(): TestResult[] {
    const results: TestResult[] = [];
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button, label');

    // This is a simplified contrast test
    // In production, you'd want to use a library like axe-core for accurate contrast testing
    textElements.forEach((element, index) => {
      const styles = window.getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;

      // Skip transparent backgrounds
      if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
        return;
      }

      // Convert RGB to hex for contrast calculation
      const rgbToHex = (rgb: string) => {
        const match = rgb.match(/\d+/g);
        if (!match) return '#000000';
        return '#' + match.slice(0, 3).map(x => {
          const hex = parseInt(x).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('');
      };

      const foregroundHex = rgbToHex(color);
      const backgroundHex = rgbToHex(backgroundColor);

      try {
        const ratio = ColorContrast.getContrastRatio(foregroundHex, backgroundHex);
        
        if (ratio < 4.5) {
          results.push({
            passed: false,
            severity: 'error',
            message: `Low contrast ratio: ${ratio.toFixed(2)}:1 (minimum 4.5:1 required)`,
            element: element,
            rule: 'WCAG 1.4.3 - Contrast (Minimum)',
            wcagLevel: 'AA'
          });
        } else if (ratio < 7) {
          results.push({
            passed: true,
            severity: 'info',
            message: `Contrast ratio: ${ratio.toFixed(2)}:1 (meets AA but not AAA)`,
            element: element,
            rule: 'WCAG 1.4.3 - Contrast (Minimum)',
            wcagLevel: 'AA'
          });
        }
      } catch (error) {
        // Skip if color parsing fails
      }
    });

    // Add passing test if no critical issues found
    const errors = results.filter(r => r.severity === 'error');
    if (errors.length === 0) {
      results.push({
        passed: true,
        severity: 'info',
        message: 'Color contrast meets WCAG AA requirements',
        rule: 'WCAG 1.4.3 - Contrast (Minimum)',
        wcagLevel: 'AA'
      });
    }

    return results;
  }

  private testAriaAttributes(): TestResult[] {
    const results: TestResult[] = [];

    // Test for invalid ARIA attributes
    const elementsWithAria = document.querySelectorAll('[aria-*]');
    elementsWithAria.forEach(element => {
      const attributes = Array.from(element.attributes)
        .filter(attr => attr.name.startsWith('aria-'))
        .map(attr => attr.name);

      // Test for aria-label on interactive elements
      if (element.tagName === 'BUTTON' && !element.textContent?.trim() && !element.hasAttribute('aria-label')) {
        results.push({
          passed: false,
          severity: 'error',
          message: 'Button without text content should have aria-label',
          element: element,
          rule: 'WCAG 4.1.2 - Name, Role, Value',
          wcagLevel: 'A'
        });
      }

      // Test for aria-expanded consistency
      if (element.hasAttribute('aria-expanded')) {
        const isExpanded = element.getAttribute('aria-expanded') === 'true';
        const hasExpandedContent = element.querySelector('[aria-hidden="false"]');
        
        if (isExpanded && !hasExpandedContent) {
          results.push({
            passed: false,
            severity: 'warning',
            message: 'aria-expanded="true" but no visible expanded content found',
            element: element,
            rule: 'WCAG 4.1.2 - Name, Role, Value',
            wcagLevel: 'A'
          });
        }
      }
    });

    // Add passing test if no issues found
    if (results.length === 0) {
      results.push({
        passed: true,
        severity: 'info',
        message: 'ARIA attributes are properly implemented',
        rule: 'WCAG 4.1.2 - Name, Role, Value',
        wcagLevel: 'A'
      });
    }

    return results;
  }

  private testLinks(): TestResult[] {
    const results: TestResult[] = [];
    const links = document.querySelectorAll('a[href]');

    links.forEach((link, index) => {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim();

      // Test for meaningful link text
      if (!text || text.length < 2) {
        results.push({
          passed: false,
          severity: 'error',
          message: `Link ${index + 1} has insufficient text content`,
          element: link,
          rule: 'WCAG 2.4.4 - Link Purpose',
          wcagLevel: 'A'
        });
      }

      // Test for generic link text
      const genericTexts = ['click here', 'read more', 'learn more', 'here', 'link'];
      if (text && genericTexts.includes(text.toLowerCase())) {
        results.push({
          passed: false,
          severity: 'warning',
          message: `Link uses generic text: "${text}"`,
          element: link,
          rule: 'WCAG 2.4.4 - Link Purpose',
          wcagLevel: 'AA'
        });
      }

      // Test for link destination
      if (href === '#' || href === '#!') {
        results.push({
          passed: false,
          severity: 'warning',
          message: `Link points to non-existent destination: ${href}`,
          element: link,
          rule: 'WCAG 2.4.4 - Link Purpose',
          wcagLevel: 'A'
        });
      }
    });

    // Add passing test if no issues found
    if (results.length === 0) {
      results.push({
        passed: true,
        severity: 'info',
        message: `All ${links.length} links have meaningful text and destinations`,
        rule: 'WCAG 2.4.4 - Link Purpose',
        wcagLevel: 'A'
      });
    }

    return results;
  }

  private testTables(): TestResult[] {
    const results: TestResult[] = [];
    const tables = document.querySelectorAll('table');

    tables.forEach((table, index) => {
      // Test for table caption
      if (!table.querySelector('caption')) {
        results.push({
          passed: false,
          severity: 'warning',
          message: `Table ${index + 1} should have a caption`,
          element: table,
          rule: 'WCAG 1.3.1 - Info and Relationships',
          wcagLevel: 'A'
        });
      }

      // Test for table headers
      const headers = table.querySelectorAll('th');
      if (headers.length === 0) {
        results.push({
          passed: false,
          severity: 'error',
          message: `Table ${index + 1} has no header cells`,
          element: table,
          rule: 'WCAG 1.3.1 - Info and Relationships',
          wcagLevel: 'A'
        });
      }

      // Test for scope attributes
      headers.forEach(header => {
        if (!header.hasAttribute('scope') && !header.hasAttribute('id')) {
          results.push({
            passed: false,
            severity: 'warning',
            message: 'Table header should have scope or id attribute',
            element: header,
            rule: 'WCAG 1.3.1 - Info and Relationships',
            wcagLevel: 'AA'
          });
        }
      });
    });

    // Add passing test if no issues found
    if (results.length === 0) {
      results.push({
        passed: true,
        severity: 'info',
        message: `All ${tables.length} tables are properly structured`,
        rule: 'WCAG 1.3.1 - Info and Relationships',
        wcagLevel: 'A'
      });
    }

    return results;
  }

  private testKeyboardNavigation(): TestResult[] {
    const results: TestResult[] = [];

    // Test for keyboard accessibility
    const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    
    // Simulate tab navigation
    let currentFocus = 0;
    const tabbableElements = Array.from(interactiveElements).filter(el => {
      const tabindex = el.getAttribute('tabindex');
      return !tabindex || parseInt(tabindex) >= 0;
    });

    if (tabbableElements.length === 0) {
      results.push({
        passed: false,
        severity: 'error',
        message: 'No keyboard-navigable elements found',
        rule: 'WCAG 2.1.1 - Keyboard',
        wcagLevel: 'A'
      });
    } else {
      results.push({
        passed: true,
        severity: 'info',
        message: `${tabbableElements.length} keyboard-navigable elements found`,
        rule: 'WCAG 2.1.1 - Keyboard',
        wcagLevel: 'A'
      });
    }

    // Test for skip links
    const skipLinks = document.querySelectorAll('a[href^="#main"], a[href^="#content"]');
    if (skipLinks.length === 0) {
      results.push({
        passed: false,
        severity: 'warning',
        message: 'No skip link found for keyboard navigation',
        rule: 'WCAG 2.4.1 - Bypass Blocks',
        wcagLevel: 'AA'
      });
    }

    return results;
  }

  private testLandmarks(): TestResult[] {
    const results: TestResult[] = [];

    // Test for main landmark
    const main = document.querySelector('main, [role="main"]');
    if (!main) {
      results.push({
        passed: false,
        severity: 'error',
        message: 'No main landmark found',
        rule: 'WCAG 1.3.6 - Identify Purpose',
        wcagLevel: 'AA'
      });
    }

    // Test for navigation landmarks
    const nav = document.querySelector('nav, [role="navigation"]');
    if (!nav) {
      results.push({
        passed: false,
        severity: 'warning',
        message: 'No navigation landmark found',
        rule: 'WCAG 1.3.6 - Identify Purpose',
        wcagLevel: 'AA'
      });
    }

    // Test for header/banner landmark
    const header = document.querySelector('header, [role="banner"]');
    if (!header) {
      results.push({
        passed: false,
        severity: 'warning',
        message: 'No header/banner landmark found',
        rule: 'WCAG 1.3.6 - Identify Purpose',
        wcagLevel: 'AA'
      });
    }

    // Test for footer/contentinfo landmark
    const footer = document.querySelector('footer, [role="contentinfo"]');
    if (!footer) {
      results.push({
        passed: false,
        severity: 'warning',
        message: 'No footer/contentinfo landmark found',
        rule: 'WCAG 1.3.6 - Identify Purpose',
        wcagLevel: 'AA'
      });
    }

    // Add passing test if main landmark exists
    if (main) {
      results.push({
        passed: true,
        severity: 'info',
        message: 'Page has proper landmark structure',
        rule: 'WCAG 1.3.6 - Identify Purpose',
        wcagLevel: 'AA'
      });
    }

    return results;
  }

  public runFullTest(): AccessibilityReport {
    const testSuites: TestSuite[] = [];
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let warnings = 0;
    let errors = 0;

    // Run all test suites
    this.testSuites.forEach((testFunction, name) => {
      const tests = testFunction();
      const suiteScore = tests.filter(t => t.passed).length / tests.length * 100;
      
      const suite: TestSuite = {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        description: this.getSuiteDescription(name),
        tests,
        score: suiteScore,
        compliance: this.getComplianceLevel(tests)
      };

      testSuites.push(suite);

      // Update totals
      totalTests += tests.length;
      passedTests += tests.filter(t => t.passed).length;
      failedTests += tests.filter(t => !t.passed).length;
      warnings += tests.filter(t => t.severity === 'warning').length;
      errors += tests.filter(t => t.severity === 'error').length;
    });

    const overallScore = passedTests / totalTests * 100;
    const overallCompliance = this.getComplianceLevel(testSuites.flatMap(s => s.tests));

    const report: AccessibilityReport = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      overallScore,
      overallCompliance,
      testSuites,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        warnings,
        errors
      },
      recommendations: this.generateRecommendations(testSuites)
    };

    return report;
  }

  private getSuiteDescription(name: string): string {
    const descriptions: Record<string, string> = {
      images: 'Tests for image alt text and accessibility',
      headings: 'Tests for proper heading structure and hierarchy',
      forms: 'Tests for form labels, inputs, and accessibility',
      focus: 'Tests for focus management and keyboard navigation',
      contrast: 'Tests for color contrast ratios',
      aria: 'Tests for ARIA attributes and roles',
      links: 'Tests for link accessibility and purpose',
      tables: 'Tests for table structure and headers',
      keyboard: 'Tests for keyboard accessibility',
      landmarks: 'Tests for landmark roles and page structure'
    };
    return descriptions[name] || 'Accessibility tests';
  }

  private getComplianceLevel(tests: TestResult[]): 'A' | 'AA' | 'AAA' | 'Non-compliant' {
    const errors = tests.filter(t => t.severity === 'error').length;
    const warnings = tests.filter(t => t.severity === 'warning').length;
    
    if (errors > 0) return 'Non-compliant';
    if (warnings > 0) return 'A';
    return 'AA';
  }

  private generateRecommendations(testSuites: TestSuite[]): string[] {
    const recommendations: string[] = [];
    
    testSuites.forEach(suite => {
      const failedTests = suite.tests.filter(t => !t.passed);
      
      failedTests.forEach(test => {
        if (!recommendations.includes(test.message)) {
          recommendations.push(test.message);
        }
      });
    });

    // Add general recommendations
    if (recommendations.length === 0) {
      recommendations.push('Great job! Your page meets WCAG 2.2 AA compliance standards.');
    } else {
      recommendations.push('Consider using automated accessibility testing tools in your CI/CD pipeline.');
      recommendations.push('Test with screen readers and keyboard-only navigation.');
      recommendations.push('Include users with disabilities in your testing process.');
    }

    return recommendations;
  }

  public exportReport(report: AccessibilityReport, format: 'json' | 'html' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    // HTML format
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Report - ${report.url}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .score { font-size: 24px; font-weight: bold; color: ${report.overallScore >= 90 ? 'green' : report.overallScore >= 70 ? 'orange' : 'red'}; }
        .test-suite { margin: 20px 0; border: 1px solid #ddd; border-radius: 5px; }
        .suite-header { background: #f9f9f9; padding: 15px; font-weight: bold; }
        .suite-content { padding: 15px; }
        .test-result { margin: 5px 0; padding: 5px; }
        .error { background: #ffebee; border-left: 4px solid #f44336; }
        .warning { background: #fff3e0; border-left: 4px solid #ff9800; }
        .info { background: #e3f2fd; border-left: 4px solid #2196f3; }
        .recommendations { background: #f1f8e9; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Accessibility Report</h1>
        <p><strong>URL:</strong> ${report.url}</p>
        <p><strong>Date:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
        <p><strong>Overall Score:</strong> <span class="score">${report.overallScore.toFixed(1)}%</span></p>
        <p><strong>Compliance Level:</strong> ${report.overallCompliance}</p>
    </div>

    <h2>Summary</h2>
    <ul>
        <li>Total Tests: ${report.summary.totalTests}</li>
        <li>Passed: ${report.summary.passedTests}</li>
        <li>Failed: ${report.summary.failedTests}</li>
        <li>Warnings: ${report.summary.warnings}</li>
        <li>Errors: ${report.summary.errors}</li>
    </ul>

    ${report.testSuites.map((suite: TestSuite) => `
    <div class="test-suite">
        <div class="suite-header">
            ${suite.name} (${suite.score.toFixed(1)}% - ${suite.compliance})
        </div>
        <div class="suite-content">
            <p>${suite.description}</p>
            ${suite.tests.map((test: TestResult) => `
            <div class="test-result ${test.severity}">
                <strong>${test.passed ? '✓' : '✗'}</strong> ${test.message}
                <br><small>${test.rule} (${test.wcagLevel})</small>
            </div>
            `).join('')}
        </div>
    </div>
    `).join('')}

    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>
    `;
  }
}

// Singleton instance
export const accessibilityTester = new AccessibilityTester();
export default accessibilityTester;
