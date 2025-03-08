import { Page } from '@playwright/test';
import * as cheerio from 'cheerio';
import nlp from 'compromise';
import { JSDOM } from 'jsdom';

export interface GrammarError {
  message: string;
  context: string;
  suggestions: string[];
  ruleId: string;
  position: {
    offset: number;
    length: number;
  };
}

export interface CheckResult {
  url: string;
  totalErrors: number;
  errors: GrammarError[];
  rawText: string;
}

export class GrammarChecker {
  private processedFragments: Set<string>; // Track already processed fragments

  constructor(private options: {
    language?: string;
    motherTongue?: string;
    disabledRules?: string[];
    detectIncomplete?: boolean;
  } = {}) {
    this.options.language = this.options.language || 'en-US';
    this.options.detectIncomplete = this.options.detectIncomplete !== false;
    this.processedFragments = new Set<string>();
  }
  
  /**
   * Extract readable content from a webpage using Cheerio and Readability
   */
  async extractText(page: Page): Promise<string> {
    // Get the HTML content
    const html = await page.content();
    
    // Use Cheerio to extract text content
    const $ = cheerio.load(html);
    
    // Remove non-content elements
    $('script, style, noscript, svg, head, meta, link, nav, header, footer, .cookie-banner, [role="navigation"], button, .menu').remove();
    
    // Extract paragraphs and other text elements
    const paragraphs: string[] = [];
    
    // Extract paragraphs
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text) paragraphs.push(text);
    });
    
    // Extract headings
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const text = $(el).text().trim();
      if (text) paragraphs.push(text);
    });
    
    // Extract list items
    $('li').each((_, el) => {
      const text = $(el).text().trim();
      if (text) paragraphs.push(text);
    });
    
    // Extract div text that might contain content
    $('div').each((_, el) => {
      // Skip if it has children that are already processed
      if ($(el).find('p, h1, h2, h3, h4, h5, h6, li').length > 0) return;
      
      const text = $(el).text().trim();
      if (text && text.length > 20) paragraphs.push(text);
    });
    
    // Join paragraphs with double newlines
    return paragraphs.join('\n\n');
  }
  
  /**
   * Check a webpage for grammar and spelling errors
   */
  async checkPage(page: Page): Promise<CheckResult> {
    const url = page.url();
    const text = await this.extractText(page);
    
    // Main error detection
    const errors: GrammarError[] = [];
    
    // Use compromise for sentence analysis
    const nlpErrors = this.detectIncompleteWithCompromise(text);
    errors.push(...nlpErrors);
    
    // Add regex checks for specific patterns
    const regexErrors = this.checkRegexPatterns(text);
    errors.push(...regexErrors);
    
    // Deduplicate errors
    const uniqueErrors = this.deduplicateErrors(errors);
    
    return {
      url,
      totalErrors: uniqueErrors.length,
      errors: uniqueErrors,
      rawText: text
    };
  }
  
  /**
   * Deduplicate errors to avoid repeated reports for the same issue
   */
  private deduplicateErrors(errors: GrammarError[]): GrammarError[] {
    const uniqueErrors: GrammarError[] = [];
    const seenContexts = new Set<string>();
    
    for (const error of errors) {
      // Create a key combining the context and rule
      const key = `${error.context.trim()}|${error.ruleId}`;
      
      if (!seenContexts.has(key)) {
        seenContexts.add(key);
        uniqueErrors.push(error);
      }
    }
    
    return uniqueErrors;
  }
  
  /**
   * Enhanced method to detect headings, titles, and section markers
   * that should be exempt from grammar checking
   */
  private isHeadingOrTitle(text: string): boolean {
    const trimmedText = text.trim();
    
    // Skip if empty
    if (!trimmedText) return false;
    
    // Numbered or lettered section headings
    // Examples: "1. Introduction", "A. Information We Collect"
    if (/^([A-Z]|[0-9]+)\.(\s+[A-Z][a-zA-Z0-9\s]*)+$/.test(trimmedText)) {
      return true;
    }
    
    // Roman numeral headings
    // Examples: "I. Introduction", "IV. Terms of Service"
    if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\.(\s+[A-Z][a-zA-Z0-9\s]*)+$/.test(trimmedText)) {
      return true;
    }
    
    // Title case phrases (indicative of headings)
    // Only if they're relatively short and don't look like sentences
    if (/^([A-Z][a-z0-9]*\s+){1,7}[A-Z][a-z0-9]*$/.test(trimmedText) && 
        trimmedText.length < 60 && 
        !trimmedText.includes(',')) {
      return true;
    }
    
    // Common heading patterns for legal documents
    // Example: "Collection of Personal Information"
    if (/^([A-Z][a-z]+\s+){0,2}of(\s+[A-Z][a-z]+){1,3}$/.test(trimmedText)) {
      return true;
    }
    
    // Phrases starting with "The Right to"
    // Example: "The Right to Deletion"
    if (/^The\s+Right\s+to\s+[A-Z][a-zA-Z\s]*$/.test(trimmedText)) {
      return true;
    }
    
    // Phrases starting with "How to" or "How We"
    // Example: "How to Exercise Access and Deletion Rights"
    if (/^How\s+(to|We)\s+[A-Z][a-zA-Z\s]*$/.test(trimmedText)) {
      return true;
    }
    
    // Document title followed by organization name in parentheses
    if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*:.*\([""][^)]+[""]\)$/.test(trimmedText)) {
      return true;
    }
    
    // Common legal document section titles
    const commonTitles = [
      'introduction', 'purpose', 'scope', 'definitions', 
      'privacy policy', 'terms of service', 'disclaimer',
      'collection of information', 'use of information',
      'information sharing', 'data protection', 'security measures',
      'your rights', 'contact us', 'effective date'
    ];
    
    for (const title of commonTitles) {
      if (trimmedText.toLowerCase() === title) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Improved method to detect document sections that should be skipped
   */
  private shouldSkipText(text: string): boolean {
    const trimmedText = text.trim();
    
    // Skip if empty
    if (!trimmedText) return true;
    
    // Skip if it's a heading or title
    if (this.isHeadingOrTitle(trimmedText)) {
      return true;
    }
    
    // Skip headings that end with colons (they're intentionally not full sentences)
    if (/^[A-Z][A-Za-z\s]{3,}:$/.test(trimmedText)) {
      return true;
    }
    
    // Skip list introductions ending with colons
    if (/^[A-Za-z\s]+(include|are|following|include but are not limited to):$/.test(trimmedText)) {
      return true;
    }
    
    // Skip bulleted or numbered list items that are intentionally fragments
    if (/^(\d+\.|\*|\-|\•)\s+[A-Za-z]/.test(trimmedText) && !trimmedText.includes('.', 2)) {
      return true;
    }
    
    // Skip navigation, buttons, and common UI elements
    const uiPatterns = [
      /^(Home|About|Contact|Login|Signup|Videos|Menu)$/i,
      /^(Accept|Decline|Submit|Cancel|Next|Previous)$/i,
      /^(Terms and Conditions|Privacy Policy)$/i,
      /^(Skip to content|Log In|Sign Up)$/i
    ];
    
    if (uiPatterns.some(pattern => pattern.test(trimmedText))) {
      return true;
    }
    
    // Skip cookie consent banners
    if (/cookie|consent|accept|decline|privacy/i.test(trimmedText) && 
        /website|experience|browse|uses/i.test(trimmedText)) {
      return true;
    }
    
    // Skip version, date, and metadata lines
    if (/^Version\s+Date:|^Last\s+Updated:|^Effective\s+Date:/i.test(trimmedText)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Improved detection for prepositions in headings vs. actual grammar errors
   */
  private isPrepositionInHeading(text: string): boolean {
    // Check if this looks like a heading with a preposition
    
    // Common heading patterns with prepositions
    const headingWithPrepositionPatterns = [
      // "X of Y" pattern - e.g., "Collection of Personal Information"
      /^([A-Z][a-z]+\s+){0,2}(of|to|for|with|by|from|in|on|at|about)(\s+[A-Z][a-z]+){1,3}$/,
      
      // "The X of/to Y" pattern - e.g., "The Right to Deletion"
      /^The\s+[A-Z][a-z]+\s+(of|to|for|with|by|from|in|on|at|about)\s+[A-Z][a-z]+/,
      
      // "How to X" pattern - e.g., "How to Exercise Access"
      /^How\s+to\s+[A-Z][a-z]+/
    ];
    
    return headingWithPrepositionPatterns.some(pattern => pattern.test(text.trim()));
  }
  
  /**
   * Check text for specific regex patterns that indicate grammar issues,
   * with improved heading detection
   */
  private checkRegexPatterns(text: string): GrammarError[] {
    const errors: GrammarError[] = [];
    
    // Patterns to check
    const patterns = [
      // Incomplete sentences ending with common words that should have objects
      {
        regex: /\b(please note|it is important to note).*\b(do not|does not|will not|cannot)\b.*\b(recognize|respond|reply|acknowledge)\b[^.!?]*$/gim,
        message: 'Incomplete sentence missing object after transitive verb',
        ruleId: 'INCOMPLETE_TRANSITIVE_VERB',
        suggestion: 'Complete the sentence by specifying what is recognized or responded to'
      },
      // Sentences ending with prepositions (but not headings)
      {
        regex: /\b[A-Z][^.!?]{10,}(to|for|with|by|from|in|on|at|about|upon)[^.!?]*$/gm,
        message: 'Sentence ends with a preposition',
        ruleId: 'HANGING_PREPOSITION',
        suggestion: 'Complete the prepositional phrase with an object'
      },
      // Sentences with "browser-initiated" without proper ending
      {
        regex: /[^.!?]*\bbrowser-initiated\b[^.!?]*$/gm,
        message: 'Incomplete sentence with "browser-initiated"',
        ruleId: 'INCOMPLETE_BROWSER_INITIATED',
        suggestion: 'Complete the sentence with what happens with browser-initiated requests/actions'
      }
    ];
    
    // Check each pattern
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const context = match[0].trim();
        
        // Skip if this fragment has already been processed
        if (this.processedFragments.has(context)) continue;
        this.processedFragments.add(context);
        
        // Skip if it's a heading or title
        if (this.isHeadingOrTitle(context)) continue;
        
        // For hanging preposition check, skip if it's a common heading pattern
        if (pattern.ruleId === 'HANGING_PREPOSITION' && this.isPrepositionInHeading(context)) {
          continue;
        }
        
        errors.push({
          message: pattern.message,
          context,
          suggestions: [pattern.suggestion, 'Add proper punctuation'],
          ruleId: pattern.ruleId,
          position: {
            offset: match.index,
            length: match[0].length
          }
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Use compromise NLP to detect incomplete sentences,
   * with improved heading detection
   */
  private detectIncompleteWithCompromise(text: string): GrammarError[] {
    if (!this.options.detectIncomplete) {
      return [];
    }
    
    const errors: GrammarError[] = [];
    const doc = nlp(text);
    
    // Get all sentences
    const sentences = doc.sentences().out('array');
    
    // Process each sentence for incompleteness
    for (const sentenceText of sentences) {
      // Skip empty or very short sentences
      if (!sentenceText.trim() || sentenceText.trim().length < 10) continue;
      
      // Skip if this fragment has already been processed
      if (this.processedFragments.has(sentenceText.trim())) continue;
      this.processedFragments.add(sentenceText.trim());
      
      // Skip sections that should not be grammar checked
      if (this.shouldSkipText(sentenceText)) continue;
      
      // Skip if it's a heading or title
      if (this.isHeadingOrTitle(sentenceText.trim())) continue;
      
      // Check for ending punctuation
      if (!sentenceText.trim().match(/[.!?]$/)) {
        // Check if it contains meaningful content (not just a UI element)
        if (this.isContentSentence(sentenceText)) {
          errors.push({
            message: 'Sentence does not end with proper punctuation',
            context: sentenceText.trim(),
            suggestions: ['Add appropriate ending punctuation (period, exclamation mark, or question mark)'],
            ruleId: 'MISSING_END_PUNCTUATION',
            position: {
              offset: text.indexOf(sentenceText),
              length: sentenceText.length
            }
          });
        }
      }
    }
    
    return errors;
  }
  
  /**
   * Determine if a text is likely a content sentence 
   * (as opposed to UI element or code fragment)
   */
  private isContentSentence(text: string): boolean {
    // UI elements, code, and other non-content tend to be short
    if (text.length < 15) return false;
    
    // Check word count - real sentences typically have multiple words
    const words = text.split(/\s+/).filter(word => word.length > 0);
    if (words.length < 4) return false;
    
    // Look for proper sentence structure
    const hasSubjectVerb = /\b(the|a|an|this|that|these|those|we|you|they|he|she|it|I)\b.*\b(am|is|are|was|were|have|has|had|do|does|did|will|shall|may|might|can|could|would|should|must)\b/i.test(text);
    
    // Common words in CSS/code to filter out
    const codeWords = ['width', 'height', 'margin', 'padding', 'color', 'font', 'grid', 'flex', 'style', 'class', 'display', 'position'];
    const hasCodeWords = codeWords.some(word => text.toLowerCase().includes(word));
    
    // High density of special characters suggests code
    const specialChars = (text.match(/[{}\[\]()=<>:;$&#%~`^\\|]/g) || []).length;
    const specialCharDensity = specialChars / text.length;
    
    // Skip headings that end with colons
    if (/:[^.]?$/.test(text.trim())) {
      return false;
    }
    
    // Return true if it looks like a real sentence and not code
    return (hasSubjectVerb || 
           (words.length >= 7 && !hasCodeWords && specialCharDensity < 0.05));
  }
}