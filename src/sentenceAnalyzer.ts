// Modified part of sentenceAnalyzer.ts for handling suggestions
private analyzeText(text: string): GrammarError[] {
  const errors: GrammarError[] = [];
  
  // Track which text fragments we've already reported
  const reportedFragments = new Set<string>();
  
  // Split text into paragraphs
  const paragraphs = text.split(/\n\n+/);
  
  // Process each paragraph to find sentences
  for (const paragraph of paragraphs) {
    // Skip empty paragraphs
    if (!paragraph.trim()) continue;
    
    // Skip cookie consent banners and similar UI overlays
    if (this.isCookieConsent(paragraph)) {
      continue;
    }
    
    // Skip paragraphs that match ignore patterns
    if (this.ignorePatterns.some(pattern => pattern.test(paragraph.trim()))) {
      continue;
    }
    
    // Skip if it looks like code or CSS
    if (this.looksLikeCodeOrCSS(paragraph)) {
      continue;
    }
    
    // Skip if it looks like navigation
    if (this.looksLikeNavigation(paragraph)) {
      continue;
    }
    
    // Skip paragraphs that contain fragments we've already reported
    let shouldSkipParagraph = false;
    for (const fragment of reportedFragments) {
      if (paragraph.includes(fragment)) {
        shouldSkipParagraph = true;
        break;
      }
    }
    if (shouldSkipParagraph) continue;
    
    // Extract sentences
    const sentences = this.extractSentences(paragraph);
    
    // Check each sentence for incomplete patterns
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      // Skip empty sentences or very short ones
      if (!trimmedSentence || trimmedSentence.length < 10) continue;
      
      // Skip cookie consent banners and similar UI overlays
      if (this.isCookieConsent(trimmedSentence)) {
        continue;
      }
      
      // Skip sentences that match ignore patterns
      if (this.ignorePatterns.some(pattern => pattern.test(trimmedSentence))) {
        continue;
      }
      
      // Skip if it looks like code or CSS
      if (this.looksLikeCodeOrCSS(trimmedSentence)) {
        continue;
      }
      
      // Skip if it looks like navigation
      if (this.looksLikeNavigation(trimmedSentence)) {
        continue;
      }
      
      // Skip if it's likely a UI element or metadata
      if (this.isLikelyUIElement(trimmedSentence)) {
        continue;
      }
      
      // Skip if we've already reported this fragment
      let shouldSkipSentence = false;
      for (const fragment of reportedFragments) {
        if (trimmedSentence.includes(fragment) || fragment.includes(trimmedSentence)) {
          shouldSkipSentence = true;
          break;
        }
      }
      if (shouldSkipSentence) continue;
      
      // Check if the sentence doesn't end with punctuation and contains words
      if (!trimmedSentence.match(/[.!?]$/) && /[a-zA-Z]{5,}/.test(trimmedSentence)) {
        // Only report if it's likely an actual sentence, not UI
        if (this.isLikelySentence(trimmedSentence)) {
          errors.push({
            message: 'Sentence does not end with proper punctuation',
            context: trimmedSentence,
            suggestions: ['Add appropriate ending punctuation (period, exclamation mark, or question mark)'],
            ruleId: 'MISSING_END_PUNCTUATION',
            position: {
              offset: paragraph.indexOf(trimmedSentence),
              length: trimmedSentence.length
            }
          });
          
          reportedFragments.add(trimmedSentence);
        }
        continue; // Skip other checks for this sentence
      }
      
      // Check for other incomplete patterns
      for (const pattern of this.incompletePatterns) {
        if (pattern.test(trimmedSentence)) {
          // Only report if it's likely an actual sentence, not UI
          if (this.isLikelySentence(trimmedSentence)) {
            // Generate a suggestion based on the sentence structure rather than hardcoded phrases
            let suggestion = 'Complete the sentence with a main clause';
            
            // Provide more specific suggestions based on pattern detection
            if (/\b(do not|does not|cannot|will not)\b.*\b(recognize|respond|reply|acknowledge)\b/i.test(trimmedSentence)) {
              suggestion = 'Complete the sentence by specifying what is recognized or responded to';
            } else if (/\b(initiated|completed|started|begun|processed|respond|recognize)\s*$/i.test(trimmedSentence)) {
              suggestion = 'Complete the sentence by adding an object';
            } else if (/^(please|kindly)\s+note\b/i.test(trimmedSentence)) {
              suggestion = 'Complete the sentence after noting important information';
            } else if (/\b(to|for|with|by|from|in|on|at|about|upon)\s*$/i.test(trimmedSentence)) {
              suggestion = 'Add the object of the preposition';
            }
            
            errors.push({
              message: 'Possible incomplete sentence or sentence fragment',
              context: trimmedSentence,
              suggestions: [suggestion, 'Add proper punctuation'],
              ruleId: 'POSSIBLE_INCOMPLETE_SENTENCE',
              position: {
                offset: paragraph.indexOf(trimmedSentence),
                length: trimmedSentence.length
              }
            });
            
            reportedFragments.add(trimmedSentence);
          }
          break; // Only report one pattern match per sentence
        }
      }
    }
  }
  
  return errors;
}