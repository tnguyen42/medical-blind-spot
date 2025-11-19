import axios from 'axios';
import * as dotenv from 'dotenv';
import { createObjectCsvWriter } from 'csv-writer';

dotenv.config();

interface Paper {
  title: string;
  authors: string;
  journal: string;
  pubDate: string;
  doi: string;
  abstract: string;
}

export async function searchLiterature(disease: string): Promise<Paper[]> {
  const apiKey = process.env.PUBMED_API_KEY;
  const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
  const fetchUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

  // Step 1: Search for papers
  const searchParams = new URLSearchParams({
    db: 'pubmed',
    term: disease,
    retmode: 'json',
    retmax: '10', // Limit for MVP
    api_key: apiKey || '',
  });

  const searchResponse = await axios.get(`${baseUrl}?${searchParams.toString()}`);
  const ids = searchResponse.data.esearchresult.idlist;

  if (!ids || ids.length === 0) {
    throw new Error('No papers found.');
  }

  // Step 2: Fetch details for each paper
  const fetchParams = new URLSearchParams({
    db: 'pubmed',
    id: ids.join(','),
    retmode: 'json',
    api_key: apiKey || '',
  });

  const fetchResponse = await axios.get(`${fetchUrl}?${fetchParams.toString()}`);
  const papers: Paper[] = [];

  for (const item of fetchResponse.data.PubmedArticleSet.PubmedArticle) {
    const article = item.MedlineCitation.Article;
    papers.push({
      title: article.ArticleTitle,
      authors: article.AuthorList?.map((a: any) => a.LastName + ' ' + a.ForeName).join(', ') || 'Unknown',
      journal: article.Journal.JournalTitle,
      pubDate: article.Journal.JournalIssue.PubDate.Year,
      doi: article.ELocationID?.[0] || 'Not available',
      abstract: article.Abstract?.AbstractText?.[0] || 'Not available',
    });
  }

  return papers;
}

export async function saveToCSV(papers: Paper[], filename: string): Promise<void> {
  const csvWriter = createObjectCsvWriter({
    path: filename,
    header: [
      { id: 'title', title: 'Title' },
      { id: 'authors', title: 'Authors' },
      { id: 'journal', title: 'Journal' },
      { id: 'pubDate', title: 'Publication Date' },
      { id: 'doi', title: 'DOI' },
      { id: 'abstract', title: 'Abstract' },
    ],
  });
  await csvWriter.writeRecords(papers);
}