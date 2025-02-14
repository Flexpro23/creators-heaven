import { NextResponse } from 'next/server';
import { ImageEditingService } from '../../../../lib/services/imageEditingService';

// YouTube thumbnail dimensions
const YOUTUBE_THUMBNAIL_WIDTH = 1280;
const YOUTUBE_THUMBNAIL_HEIGHT = 720;

export async function POST(req: Request) {
  if (!process.env.REPLICATE_API_KEY) {
    return NextResponse.json(
      { error: "REPLICATE_API_KEY is not set" },
      { status: 500 }
    );
  }

  try {
    const { imageUrl, prompt, mask } = await req.json();
    
    const imageEditingService = new ImageEditingService(process.env.REPLICATE_API_KEY);
    
    const output = await imageEditingService.editImage(
      { imageUrl, prompt, mask }
    );

    console.log("Generated output:", output);

    return NextResponse.json({ 
      success: true, 
      output 
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
    
    // Provide a more user-friendly error message for NSFW content
    if (errorMessage.toLowerCase().includes('nsfw')) {
      return NextResponse.json(
        { 
          success: false, 
          error: "The requested image couldn't be generated due to content safety restrictions. Please try a different prompt." 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
} 