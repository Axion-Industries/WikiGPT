import { WikipediaSearchResult, WikipediaArticle } from "@shared/schema";

export interface WikipediaResponse {
  success: boolean;
  response?: string;
  sources?: string[];
  processingTime?: number;
  error?: string;
}

export interface SearchResponse {
  success: boolean;
  results: WikipediaSearchResult[];
  query: string;
  total: number;
  error?: string;
}

export interface ArticleResponse {
  success: boolean;
  article?: WikipediaArticle;
  error?: string;
}

class WikipediaAPI {
  private baseUrl = '/api/wikipedia';

  async search(query: string, limit = 5): Promise<SearchResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Wikipedia search error:', error);
      return {
        success: false,
        results: [],
        query,
        total: 0,
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  }

  async getArticle(title: string): Promise<ArticleResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/article?title=${encodeURIComponent(title)}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Wikipedia article error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch article',
      };
    }
  }

  async processQuestion(question: string): Promise<WikipediaResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Wikipedia process error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process question',
      };
    }
  }

  // Fallback to direct Wikipedia API if backend fails
  async searchDirect(query: string, limit = 5): Promise<WikipediaSearchResult[]> {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=${limit}&srprop=snippet|titlesnippet|size|wordcount|timestamp`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      return data.query?.search?.map((result: any) => ({
        title: result.title,
        snippet: result.snippet,
        pageid: result.pageid,
        size: result.size,
        wordcount: result.wordcount,
        timestamp: result.timestamp,
      })) || [];
    } catch (error) {
      console.error('Direct Wikipedia search error:', error);
      return [];
    }
  }

  async getArticleDirect(title: string): Promise<WikipediaArticle | null> {
    try {
      const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info&exintro=false&explaintext=true&titles=${encodeURIComponent(title)}&origin=*&inprop=url`;
      
      const response = await fetch(contentUrl);
      const data = await response.json();
      
      const pages = data.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      
      if (pageId === '-1') {
        return null;
      }
      
      const page = pages[pageId];
      
      return {
        title: page.title,
        extract: page.extract,
        url: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        wordCount: page.extract ? page.extract.split(' ').length : 0,
      };
    } catch (error) {
      console.error('Direct Wikipedia article error:', error);
      return null;
    }
  }
}

export const wikipediaAPI = new WikipediaAPI();
