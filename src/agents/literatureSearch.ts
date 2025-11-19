import axios from 'axios';
import * as dotenv from 'dotenv';
import { writeFile } from 'fs/promises';

dotenv.config();

const numberOfPapers = 500;

// Europe PMC API Response Types
interface EuropePMCAuthor {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  initials?: string;
}

interface EuropePMCArticle {
  id: string;
  source: string;
  pmid?: string;
  pmcid?: string;
  doi?: string;
  title: string;
  authorString?: string;
  authorList?: {
    author: EuropePMCAuthor[];
  };
  journalTitle?: string;
  journalVolume?: string;
  journalIssue?: string;
  pubYear?: string;
  pubDate?: string;
  abstractText?: string;
  fullTextUrlList?: {
    fullTextUrl: Array<{
      url: string;
      documentStyle: string;
      site: string;
    }>;
  };
  isOpenAccess?: string;
  citedByCount?: number;
}

interface EuropePMCResponse {
  hitCount: number;
  nextCursorMark?: string;
  resultList: {
    result: EuropePMCArticle[];
  };
}

// Output Paper Interface (matches README specification)
export interface Paper {
  doi: string;
  title: string;
  authors: string;
  journal: string;
  publication_date: string;
  abstract: string;
  source: string;
}

// Output format for Literature Search Agent
export interface LiteratureSearchOutput {
  query: string;
  total_results: number;
  papers: Paper[];
}

export async function searchLiterature(disease: string): Promise<LiteratureSearchOutput> {
  // Europe PMC API endpoint
  const baseUrl = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';
  
  // Build query parameters
  const params = new URLSearchParams({
    query: disease,
    format: 'json',
    pageSize: numberOfPapers.toString(),
    resultType: 'core', // Get full article details including abstracts
  });

  const response = await axios.get<EuropePMCResponse>(`${baseUrl}?${params.toString()}`);
  
  if (!response.data.resultList?.result || response.data.resultList.result.length === 0) {
    throw new Error('No papers found.');
  }

  const papers: Paper[] = [];

  for (const article of response.data.resultList.result) {
    // Format authors - prefer authorString for simplicity, fall back to authorList
    let authors = article.authorString || 'Unknown';
    if (!article.authorString && article.authorList?.author) {
      authors = article.authorList.author
        .map(author => author.fullName || `${author.firstName || ''} ${author.lastName || ''}`.trim())
        .filter(name => name.length > 0)
        .join(', ') || 'Unknown';
    }

    // Get DOI
    const doi = article.doi || article.pmid || article.pmcid || 'Not available';

    // Get abstract (cleaned of HTML tags if present)
    const abstract = article.abstractText
      ? article.abstractText.replace(/<[^>]*>/g, '').trim()
      : 'No abstract available';

    papers.push({
      doi,
      title: article.title || 'Unknown',
      authors,
      journal: article.journalTitle || 'Unknown',
      publication_date: article.pubYear || article.pubDate || 'Unknown',
      abstract,
      source: 'Europe PMC',
    });
  }

  return {
    query: disease,
    total_results: response.data.hitCount,
    papers,
  };
}

export async function saveToJSON(data: LiteratureSearchOutput, filename: string): Promise<void> {
  const jsonContent = JSON.stringify(data, null, 2);
  await writeFile(filename, jsonContent, 'utf-8');
}