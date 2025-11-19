/**
 * Literature Search Agent - fetches papers from ArXiv API
 * Supports filtering by year and configurable result limits
 */

import type { GraphStateType } from "../graph/state.js";
import type { PaperMetadata } from "../domain/types.js";

// Configuration from environment variables with sensible defaults
const ARXIV_API_URL = process.env.ARXIV_BASE_URL || "https://export.arxiv.org/api/query";
const ARXIV_MAX_RESULTS_DEFAULT = parseInt(process.env.ARXIV_MAX_RESULTS_DEFAULT || "20", 10);

/**
 * Parse ArXiv Atom XML response into PaperMetadata objects
 */
function parseArxivXml(xmlText: string): PaperMetadata[] {
  const papers: PaperMetadata[] = [];

  // Simple regex-based XML parsing (good enough for ArXiv's consistent format)
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  const entries = xmlText.match(entryRegex) || [];

  for (const entry of entries) {
    // Extract fields using regex
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
    const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
    const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);

    // Extract all authors
    const authorMatches = entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g);
    const authors = Array.from(authorMatches, (m) => m[1].trim());

    // Extract DOI if present (often in arxiv:doi tag)
    const doiMatch = entry.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/);

    if (titleMatch && summaryMatch && publishedMatch && idMatch) {
      const arxivId = idMatch[1].split("/abs/")[1] || "";

      papers.push({
        doi: doiMatch ? doiMatch[1].trim() : "", // DOI may be empty
        title: titleMatch[1].trim().replace(/\s+/g, " "),
        authors: authors.length > 0 ? authors : ["Unknown"],
        journal: "arXiv preprint",
        publicationDate: publishedMatch[1].split("T")[0], // Extract date part
        abstract: summaryMatch[1].trim().replace(/\s+/g, " "),
        source: "ArXiv",
        url: idMatch[1].trim(),
        citations: 0, // ArXiv API doesn't provide citation counts
      });
    }
  }

  return papers;
}

/**
 * Filter papers by publication year range
 */
function filterByYearRange(
  papers: PaperMetadata[],
  minYear?: number,
  maxYear?: number
): PaperMetadata[] {
  if (!minYear && !maxYear) {
    return papers;
  }

  return papers.filter((paper) => {
    const year = parseInt(paper.publicationDate.split("-")[0]);
    if (isNaN(year)) return true; // Keep papers with invalid dates

    if (minYear && year < minYear) return false;
    if (maxYear && year > maxYear) return false;

    return true;
  });
}

/**
 * Literature Search Agent: queries ArXiv for relevant papers
 */
export async function literatureSearchAgent(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  console.log("[LiteratureSearchAgent] Starting search...");

  if (!state.query) {
    console.warn("[LiteratureSearchAgent] No query found in state, skipping search");
    return {};
  }

  const { disease, filters } = state.query;

  // Determine max results: use filter value, env var, or default
  const maxResults = filters?.maxResults || ARXIV_MAX_RESULTS_DEFAULT;

  // Extract year filters for client-side filtering
  const minYear = filters?.minYear;
  const maxYear = filters?.maxYear;

  try {
    // Build search query for ArXiv (search in title and abstract)
    const searchQuery = `all:${encodeURIComponent(disease)}`;
    const url = `${ARXIV_API_URL}?search_query=${searchQuery}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

    console.log(`[LiteratureSearchAgent] Querying ArXiv: ${disease} (max_results=${maxResults})`);
    if (minYear || maxYear) {
      console.log(
        `[LiteratureSearchAgent] Will filter by year range: ${minYear || "any"} - ${maxYear || "any"}`
      );
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArXiv API returned status ${response.status}`);
    }

    const xmlText = await response.text();
    const rawPapers = parseArxivXml(xmlText);

    console.log(`[LiteratureSearchAgent] Received ${rawPapers.length} papers from ArXiv`);

    // Apply client-side year filtering
    // Note: ArXiv API doesn't support date filtering directly in the query,
    // so we filter after fetching
    const papers = filterByYearRange(rawPapers, minYear, maxYear);

    if (papers.length !== rawPapers.length) {
      console.log(
        `[LiteratureSearchAgent] After year filtering: ${papers.length} papers remain (${rawPapers.length - papers.length} filtered out)`
      );
    }

    return { papers };
  } catch (error) {
    console.error(
      "[LiteratureSearchAgent] Error fetching from ArXiv:",
      error instanceof Error ? error.message : error
    );
    // Return empty papers array on error rather than throwing
    return { papers: [] };
  }
}
