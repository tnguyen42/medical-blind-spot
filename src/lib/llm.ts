/**
 * LLM Interface - placeholder for future LLM integration
 *
 * TODO: Replace with actual LLM client (e.g., OpenAI, Anthropic, etc.)
 */

export interface LLMResponse {
  content: string;
  model?: string;
  tokensUsed?: number;
}

/**
 * Mock LLM call - simulates an LLM response
 *
 * TODO: Replace this with actual LLM API call:
 * - Use @langchain/openai for OpenAI
 * - Use @langchain/anthropic for Claude
 * - Or any other LLM provider
 *
 * Example real implementation:
 * ```typescript
 * import { ChatOpenAI } from "@langchain/openai";
 *
 * const llm = new ChatOpenAI({
 *   modelName: "gpt-4",
 *   temperature: 0.1,
 * });
 *
 * const response = await llm.invoke(prompt);
 * return { content: response.content, model: "gpt-4" };
 * ```
 */
export async function callLLM(prompt: string, system?: string): Promise<LLMResponse> {
  console.log("[LLM] Mock LLM call - in production, this would call a real LLM API");
  console.log(`[LLM] Prompt length: ${prompt.length} characters`);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Mock response - in production, this would be the actual LLM response
  // The mock provides realistic-looking structured output
  const mockResponse = `
Based on the analysis of the provided research papers:

**Age Demographics:**
- Pediatric (0-18): 0% - No studies included children or adolescents
- Young Adults (18-40): 15% - Limited representation
- Middle-aged Adults (40-65): 60% - Well represented
- Elderly (65-75): 45% - Moderate representation
- Very Elderly (>75): 8% - Significantly underrepresented

**Gender Demographics:**
- Male: 42%
- Female: 48%
- Gender not reported: 10%

**Pregnancy Status:**
- Pregnant individuals: 0% - Systematically excluded
- Pregnancy status not mentioned: 100%

**Geographic Distribution:**
- North America: 52% (predominantly USA-based studies)
- Europe: 28% (Western Europe overrepresented)
- Asia: 12% (primarily China and Japan)
- Africa: 0% - No representation
- South America: 3%
- Oceania: 5%

**Critical Blind Spots Identified:**
1. Complete exclusion of pediatric populations (CRITICAL)
2. Systematic exclusion of pregnant individuals (CRITICAL)
3. Severe underrepresentation of very elderly (>75) despite disease relevance (HIGH)
4. Complete absence of African populations (CRITICAL)
5. Minimal representation of young adults 18-40 (MEDIUM)
6. Geographic bias toward Western/developed nations (HIGH)

**Methodological Quality Issues:**
- 15% of studies failed to report demographic breakdowns
- 30% used convenience sampling without demographic stratification
- Only 5% included explicit efforts to recruit underrepresented populations
  `.trim();

  return {
    content: mockResponse,
    model: "mock-llm-v1",
    tokensUsed: 450,
  };
}

/**
 * Parse LLM response into structured demographic data
 *
 * TODO: Improve parsing robustness:
 * - Use structured output from LLM (e.g., JSON mode)
 * - Add error handling for malformed responses
 * - Validate extracted percentages are in valid ranges
 */
export function parseDemographicResponse(response: string): {
  age: Record<string, number>;
  gender: Record<string, number>;
  pregnancyStatus: Record<string, number>;
  geography: Record<string, number>;
  criticalFindings: string[];
} {
  // Simple regex-based parsing of the mock response
  // In production, you'd use structured output from the LLM

  const extractPercentage = (text: string, pattern: RegExp): number => {
    const match = text.match(pattern);
    return match ? parseInt(match[1]) : 0;
  };

  return {
    age: {
      "0-18": extractPercentage(response, /Pediatric.*?(\d+)%/),
      "18-40": extractPercentage(response, /Young Adults.*?(\d+)%/),
      "40-65": extractPercentage(response, /Middle-aged Adults.*?(\d+)%/),
      "65-75": extractPercentage(response, /Elderly \(65-75\).*?(\d+)%/),
      ">75": extractPercentage(response, /Very Elderly.*?(\d+)%/),
      not_specified: 0,
    },
    gender: {
      male: extractPercentage(response, /Male.*?(\d+)%/),
      female: extractPercentage(response, /Female.*?(\d+)%/),
      not_specified: extractPercentage(response, /Gender not reported.*?(\d+)%/),
    },
    pregnancyStatus: {
      pregnant: extractPercentage(response, /Pregnant individuals.*?(\d+)%/),
      not_pregnant: 0,
      not_specified: extractPercentage(response, /Pregnancy status not mentioned.*?(\d+)%/),
    },
    geography: {
      "North America": extractPercentage(response, /North America.*?(\d+)%/),
      Europe: extractPercentage(response, /Europe.*?(\d+)%/),
      Asia: extractPercentage(response, /Asia.*?(\d+)%/),
      Africa: extractPercentage(response, /Africa.*?(\d+)%/),
      Other: extractPercentage(response, /South America.*?(\d+)%/) +
             extractPercentage(response, /Oceania.*?(\d+)%/),
      not_specified: 0,
    },
    criticalFindings: [
      "Complete exclusion of pediatric populations",
      "Systematic exclusion of pregnant individuals",
      "Severe underrepresentation of very elderly (>75)",
      "Complete absence of African populations",
      "Geographic bias toward Western/developed nations",
    ],
  };
}
