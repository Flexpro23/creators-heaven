import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key is not configured" },
        { status: 500 }
      );
    }

    const enhancementPrompt = `As an AI image editing expert, enhance and expand the following prompt to create 3 different variations. Format your response as a JSON array with each option containing a description and the actual prompt. Example format:
[
  {
    "title": "Description of what this variation emphasizes",
    "prompt": "The actual prompt text"
  }
]

Original prompt: "${prompt}"`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: enhancementPrompt }]
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    const enhancedPromptText = data.candidates[0].content.parts[0].text;
    
    // Extract the JSON array from the response
    const jsonMatch = enhancedPromptText.match(/\[[\s\S]*\]/);
    let enhancedPrompts = [];
    
    if (jsonMatch) {
      try {
        enhancedPrompts = JSON.parse(jsonMatch[0]);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        throw new Error('Failed to parse enhanced prompts');
      }
    }

    return NextResponse.json({ enhancedPrompts });
  } catch (error) {
    console.error('Error enhancing prompt:', error);
    return NextResponse.json(
      { error: 'Failed to enhance prompt' },
      { status: 500 }
    );
  }
} 