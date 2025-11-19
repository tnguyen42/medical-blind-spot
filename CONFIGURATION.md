# Configuration Guide

## Environment Variables

The Medical Research Blind Spot Analyzer supports configuration via environment variables.

### ArXiv API Configuration

```bash
# ArXiv API base URL (default: https://export.arxiv.org/api/query)
ARXIV_BASE_URL=https://export.arxiv.org/api/query

# Default maximum number of results to fetch (default: 20)
ARXIV_MAX_RESULTS_DEFAULT=20
```

### Demo Modes

```bash
# Demo mode: default | compare | recent
DEMO_MODE=default
```

**Available modes:**
- `default`: Standard search with minYear=2015
- `compare`: Broad search (2000-2025) with maxResults=30
- `recent`: Recent papers only (2020-2025)

## Query Filters

When invoking the graph, you can specify filters in the `DiseaseQuery`:

```typescript
const query = {
  disease: "alzheimer",
  filters: {
    excludePediatric: true,   // Exclude pediatric studies
    minYear: 2020,             // Minimum publication year
    maxYear: 2025,             // Maximum publication year
    maxResults: 30,            // Max papers to fetch from ArXiv
    language: "en",            // Language filter (for future use)
    studyExclusions: []        // Study types to exclude (for future use)
  }
};
```

### Year Filtering

Year filtering is applied **client-side** after fetching from ArXiv:
1. ArXiv API fetches up to `maxResults` papers
2. Results are filtered by `minYear` and `maxYear`
3. Filtered papers proceed to quality assessment

**Note:** ArXiv API doesn't support date filtering in queries, so we may fetch papers outside the year range that are then filtered out.

## Running Different Configurations

### Default mode
```bash
npm run dev
```

### Comparison mode (broad search)
```bash
npm run dev:compare
```

### Recent papers only
```bash
npm run dev:recent
```

### Custom configuration
```bash
ARXIV_MAX_RESULTS_DEFAULT=50 DEMO_MODE=recent npm run dev
```

### LLM-powered mode (mock LLM)
```bash
npm run dev:llm
```

### LLM-powered + comparison mode
```bash
npm run dev:llm-compare
```

## LLM-Powered vs Heuristic Analysis

The system supports two modes for population analysis:

### Heuristic Mode (Default)
- Uses rule-based pattern matching on abstracts
- Fast and deterministic
- No API costs
- Limited to keyword detection

### LLM-Powered Mode
- Uses language models for deeper semantic analysis
- More sophisticated demographic extraction
- Can understand context and implicit mentions
- **Currently uses mock LLM** - returns simulated responses
- Future: Will support real LLM APIs (OpenAI, Anthropic, etc.)

To enable LLM mode:
```bash
USE_LLM_POPULATION_ANALYSIS=true npm run dev
```

### Implementing Real LLM Integration

The mock LLM interface in `src/lib/llm.ts` is ready to be replaced with real LLM calls:

```typescript
// Current mock implementation in src/lib/llm.ts
export async function callLLM(prompt: string, system?: string): Promise<LLMResponse> {
  // TODO: Replace with actual LLM call
  // Example with OpenAI:
  // const llm = new ChatOpenAI({ modelName: "gpt-4" });
  // const response = await llm.invoke(prompt);
  // return { content: response.content, model: "gpt-4" };
}
```

When ready to integrate:
1. Install LLM SDK: `npm install @langchain/openai` or `@langchain/anthropic`
2. Add API key to environment: `OPENAI_API_KEY=your_key`
3. Replace mock implementation in `src/lib/llm.ts`
4. Test with: `npm run dev:llm`

## Example Output

### Filter Effectiveness Summary

At the end of each run, you'll see a summary showing:

```
======================================================================
FILTER EFFECTIVENESS SUMMARY
======================================================================

📅 Publication Year Range in Results:
   Earliest: 2020
   Latest: 2024
   Papers retrieved: 18
   Papers after quality filter: 14

🔍 Applied Filters:
   Min Year: 2020
   Max Year: 2025
   Max Results: 30

======================================================================
```

This helps verify that:
- Year filters are working correctly
- The right number of papers were retrieved
- Quality filtering is functioning as expected
