
/**
 * Extract ASIN from Amazon URL or validate ASIN format
 */
export async function extractOrValidateAsin(input: string): Promise<{ 
  success: boolean; 
  asin?: string; 
  message: string 
}> {
  try {
    const trimmedInput = input.trim();
    
    // If it's already an ASIN format, validate it
    const asinRegex = /^[A-Z0-9]{10}$/;
    if (asinRegex.test(trimmedInput)) {
      return {
        success: true,
        asin: trimmedInput,
        message: 'Valid ASIN format'
      };
    }

    // Try to extract ASIN from Amazon URL
    const urlPatterns = [
      /(?:dp|product)\/([A-Z0-9]{10})/i,
      /\/([A-Z0-9]{10})(?:\/|$|\?)/i,
      /asin=([A-Z0-9]{10})/i,
      /\/gp\/product\/([A-Z0-9]{10})/i
    ];

    for (const pattern of urlPatterns) {
      const match = trimmedInput.match(pattern);
      if (match && match[1]) {
        const extractedAsin = match[1].toUpperCase();
        if (asinRegex.test(extractedAsin)) {
          return {
            success: true,
            asin: extractedAsin,
            message: 'ASIN extracted from URL'
          };
        }
      }
    }

    return {
      success: false,
      message: 'Invalid ASIN format or unable to extract ASIN from URL. Please provide a valid Amazon ASIN (10 characters) or Amazon product URL.'
    };
  } catch (error) {
    console.error('Error extracting/validating ASIN:', error);
    return {
      success: false,
      message: 'Error processing ASIN input'
    };
  }
}

