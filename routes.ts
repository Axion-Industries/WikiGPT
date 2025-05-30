import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";

const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.number().min(1).max(10).optional().default(5),
});

const articleQuerySchema = z.object({
  title: z.string().min(1),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Wikipedia search endpoint
  app.get("/api/wikipedia/search", async (req, res) => {
    try {
      const { q: query, limit } = searchQuerySchema.parse(req.query);
      
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${limit}&srprop=snippet|titlesnippet|size|wordcount|timestamp`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
      }
      
      const results = data.query?.search || [];
      
      res.json({
        success: true,
        results: results.map((result: any) => ({
          title: result.title,
          snippet: result.snippet,
          pageid: result.pageid,
          size: result.size,
          wordcount: result.wordcount,
          timestamp: result.timestamp,
        })),
        query,
        total: results.length,
      });
    } catch (error) {
      console.error("Wikipedia search error:", error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      });
    }
  });

  // Wikipedia article content endpoint
  app.get("/api/wikipedia/article", async (req, res) => {
    try {
      const { title } = articleQuerySchema.parse(req.query);
      
      const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info|categories&exintro=false&explaintext=true&titles=${encodeURIComponent(title)}&inprop=url&cllimit=10`;
      
      const response = await fetch(contentUrl);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
      }
      
      const pages = data.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      
      if (pageId === '-1') {
        return res.status(404).json({
          success: false,
          error: "Article not found",
        });
      }
      
      const page = pages[pageId];
      const categories = page.categories?.map((cat: any) => cat.title) || [];
      
      res.json({
        success: true,
        article: {
          title: page.title,
          extract: page.extract,
          url: page.fullurl,
          categories: categories.slice(0, 5),
          wordCount: page.extract ? page.extract.split(' ').length : 0,
        },
      });
    } catch (error) {
      console.error("Wikipedia article error:", error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch article",
      });
    }
  });

  // Process question endpoint - combines search and content
  app.post("/api/wikipedia/process", async (req, res) => {
    try {
      const { question } = z.object({
        question: z.string().min(1).max(1000),
      }).parse(req.body);
      
      const startTime = Date.now();
      
      // Try original search first
      let searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(question)}&format=json&srlimit=3&srprop=snippet|titlesnippet|size|wordcount`;
      
      let searchResponse = await fetch(searchUrl);
      let searchData = await searchResponse.json();
      
      if (!searchResponse.ok) {
        throw new Error(`Wikipedia search failed: ${searchResponse.status}`);
      }
      
      let searchResults = searchData.query?.search || [];
      
      // If no results, try spell correction and fuzzy search
      if (searchResults.length === 0) {
        const correctedQuery = await attemptSpellCorrection(question);
        if (correctedQuery !== question) {
          searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(correctedQuery)}&format=json&srlimit=3&srprop=snippet|titlesnippet|size|wordcount`;
          searchResponse = await fetch(searchUrl);
          searchData = await searchResponse.json();
          searchResults = searchData.query?.search || [];
        }
      }
      
      if (searchResults.length === 0) {
        return res.json({
          success: true,
          response: generateNoResultResponse(question),
          sources: [],
          processingTime: Date.now() - startTime,
        });
      }
      
      // Get detailed content for the best match
      const bestMatch = searchResults[0];
      const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info&exintro=false&explaintext=true&titles=${encodeURIComponent(bestMatch.title)}&inprop=url`;
      
      const contentResponse = await fetch(contentUrl);
      const contentData = await contentResponse.json();
      
      if (!contentResponse.ok) {
        throw new Error(`Wikipedia content fetch failed: ${contentResponse.status}`);
      }
      
      const pages = contentData.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      const article = pages[pageId];
      
      const response = generateWikipediaResponse(question, article, searchResults);
      const sources = searchResults.map((result: any) => result.title);
      
      res.json({
        success: true,
        response,
        sources,
        processingTime: Date.now() - startTime,
      });
    } catch (error) {
      console.error("Question processing error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to process question",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function generateWikipediaResponse(question: string, article: any, searchResults: any[]): string {
  if (!article || !article.extract) {
    return generateNoResultResponse(question);
  }
  
  const extract = article.extract;
  const title = article.title;
  const url = article.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  
  // Extract relevant paragraphs based on question
  const paragraphs = extract.split('\n').filter((p: string) => p.trim().length > 50);
  const relevantContent = extractRelevantContent(paragraphs, question);
  
  // Generate conversational response
  const conversationalResponse = generateConversationalResponse(question, title, relevantContent, article);
  
  let response = conversationalResponse + '\n\n';
  
  // Add sources section
  response += `**📚 Sources & Further Reading:**\n`;
  response += `• [${title} on Wikipedia](${url})\n`;
  
  // Add related topics if available
  if (searchResults.length > 1) {
    const relatedTopics = searchResults.slice(1, 3).map((result: any) => result.title);
    response += `\n**🔗 You might also be interested in:** ${relatedTopics.join(', ')}`;
  }
  
  return response;
}

function extractRelevantContent(paragraphs: string[], question: string): string {
  const queryWords = question.toLowerCase().split(/\s+/).filter(word => word.length > 3);
  
  // Score paragraphs based on relevance
  const scoredParagraphs = paragraphs.map(paragraph => {
    const lowerParagraph = paragraph.toLowerCase();
    let score = 0;
    
    queryWords.forEach(word => {
      if (lowerParagraph.includes(word)) {
        score += word.length > 3 ? 2 : 1;
      }
    });
    
    return { paragraph: paragraph.trim(), score };
  });
  
  // Sort by relevance and take top paragraphs
  scoredParagraphs.sort((a, b) => b.score - a.score);
  const selectedParagraphs = scoredParagraphs.slice(0, 3);
  
  if (selectedParagraphs.length === 0 || selectedParagraphs[0].score === 0) {
    // Fallback to first few paragraphs
    return paragraphs.slice(0, 2).join('\n\n');
  }
  
  return selectedParagraphs.map(p => p.paragraph).join('\n\n');
}

function generateConversationalResponse(question: string, title: string, content: string, article: any): string {
  const questionType = detectQuestionType(question);
  const conversationalIntros = [
    "Great question! Let me tell you about",
    "I'd be happy to explain",
    "Here's what I can share about",
    "That's an interesting topic! From what I know,",
    "Let me break this down for you -",
    "This is a fascinating subject!"
  ];
  
  const intro = conversationalIntros[Math.floor(Math.random() * conversationalIntros.length)];
  
  // Create a more natural, conversational response
  let response = "";
  
  if (questionType === 'what') {
    response = `${intro} **${title}**.\n\n`;
  } else if (questionType === 'how') {
    response = `${intro} Here's how ${title.toLowerCase()} works:\n\n`;
  } else if (questionType === 'why') {
    response = `${intro} The reasoning behind ${title.toLowerCase()}:\n\n`;
  } else if (questionType === 'when') {
    response = `${intro} Looking at the timeline of ${title.toLowerCase()}:\n\n`;
  } else {
    response = `${intro} **${title}**:\n\n`;
  }
  
  // Process content to make it more conversational
  const processedContent = makeContentConversational(content, questionType);
  response += processedContent;
  
  // Add engaging conclusion
  const conclusions = [
    "\n\nHope this helps clarify things!",
    "\n\nPretty fascinating stuff, right?",
    "\n\nThere's definitely more to explore on this topic!",
    "\n\nLet me know if you'd like to dive deeper into any aspect!",
    "\n\nThis is just scratching the surface - there's so much more to discover!"
  ];
  
  response += conclusions[Math.floor(Math.random() * conclusions.length)];
  
  return response;
}

function detectQuestionType(question: string): string {
  const lowerQuestion = question.toLowerCase();
  if (lowerQuestion.startsWith('what') || lowerQuestion.includes('what is') || lowerQuestion.includes('what are')) {
    return 'what';
  } else if (lowerQuestion.startsWith('how') || lowerQuestion.includes('how does') || lowerQuestion.includes('how to')) {
    return 'how';
  } else if (lowerQuestion.startsWith('why') || lowerQuestion.includes('why is') || lowerQuestion.includes('why does')) {
    return 'why';
  } else if (lowerQuestion.startsWith('when') || lowerQuestion.includes('when did') || lowerQuestion.includes('when was')) {
    return 'when';
  } else if (lowerQuestion.includes('compare') || lowerQuestion.includes('difference') || lowerQuestion.includes('vs')) {
    return 'compare';
  }
  return 'general';
}

function makeContentConversational(content: string, questionType: string): string {
  // Split content into sentences
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Take the most relevant sentences and rephrase them
  let processedSentences = sentences.slice(0, 4).map(sentence => {
    sentence = sentence.trim();
    
    // Add conversational connectors
    if (Math.random() > 0.7) {
      const connectors = [
        "Essentially, ",
        "In simple terms, ",
        "Basically, ",
        "Put simply, ",
        "Here's the thing - ",
        "What's interesting is that "
      ];
      sentence = connectors[Math.floor(Math.random() * connectors.length)] + sentence.toLowerCase();
    }
    
    // Add emphasis to important points
    if (sentence.length > 100 && Math.random() > 0.5) {
      sentence = "**" + sentence + "**";
    }
    
    return sentence;
  });
  
  // Join with varied connectors
  const connectors = [". ", ". Additionally, ", ". Also, ", ". What's more, ", ". Interestingly, "];
  return processedSentences.join(connectors[Math.floor(Math.random() * connectors.length)]);
}

function generateNoResultResponse(question: string): string {
  const encouragingResponses = [
    "Hmm, I couldn't find specific information about that topic on Wikipedia.",
    "That's a tricky one! I wasn't able to locate relevant Wikipedia articles for that question.",
    "Interesting question, but I'm having trouble finding Wikipedia content that matches what you're looking for.",
    "I searched through Wikipedia but couldn't find detailed information on that specific topic."
  ];
  
  const response = encouragingResponses[Math.floor(Math.random() * encouragingResponses.length)];
  
  return `${response}

**Here are some ways we can try to get better results:**
• Try rephrasing with different keywords or terms
• Check if it might be a very recent topic (Wikipedia might not have coverage yet)
• Consider asking about a broader or more general version of the topic
• Make sure the topic has an established Wikipedia page

**Your search:** "${question}"

Feel free to try asking in a different way - I'm here to help!`;
}

async function attemptSpellCorrection(query: string): Promise<string> {
  try {
    // Use Wikipedia's opensearch API which has built-in spell correction
    const opensearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`;
    const response = await fetch(opensearchUrl);
    const data = await response.json();
    
    if (data && data[1] && data[1][0]) {
      return data[1][0]; // Return the first suggested title
    }
    
    // Fallback: try basic word corrections for common misspellings
    return correctCommonMisspellings(query);
  } catch (error) {
    console.error('Spell correction error:', error);
    return query;
  }
}

function correctCommonMisspellings(query: string): string {
  const corrections: { [key: string]: string } = {
    // Science
    'phisics': 'physics',
    'chemestry': 'chemistry',
    'biology': 'biology',
    'psycology': 'psychology',
    'psichology': 'psychology',
    'philosphy': 'philosophy',
    'mathamatics': 'mathematics',
    'algorythm': 'algorithm',
    'artficial': 'artificial',
    'inteligence': 'intelligence',
    'quantem': 'quantum',
    'quantam': 'quantum',
    
    // History
    'histery': 'history',
    'ancent': 'ancient',
    'medeval': 'medieval',
    'rennaissance': 'renaissance',
    'napoleen': 'napoleon',
    'shakespeare': 'shakespeare',
    'einstien': 'einstein',
    'davinci': 'da vinci',
    
    // Geography
    'geograpy': 'geography',
    'contry': 'country',
    'counrty': 'country',
    'mountian': 'mountain',
    'oceean': 'ocean',
    'desert': 'desert',
    'forrest': 'forest',
    
    // Technology
    'tecnology': 'technology',
    'compuer': 'computer',
    'programing': 'programming',
    'sofware': 'software',
    'hardwar': 'hardware',
    'intrnet': 'internet',
    'websit': 'website',
    
    // Common words
    'becuase': 'because',
    'recieve': 'receive',
    'seperate': 'separate',
    'definately': 'definitely',
    'occured': 'occurred',
    'begining': 'beginning',
    'goverment': 'government',
    'enviroment': 'environment'
  };
  
  let corrected = query.toLowerCase();
  for (const [wrong, right] of Object.entries(corrections)) {
    corrected = corrected.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), right);
  }
  
  return corrected;
}
