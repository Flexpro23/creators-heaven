import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

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
    const { prompt } = await req.json();

    // Filter out potentially problematic content from the prompt
    const sanitizedPrompt = prompt.replace(/\b(nsfw|nude|naked|explicit)\b/gi, '');

    // Create the prediction with Flux 1.1 Pro with strict safety settings
    const output = await replicate.run(
      "black-forest-labs/flux-1.1-pro",
      {
        input: {
          prompt: `safe for work, family friendly, ${sanitizedPrompt}`,
          aspect_ratio: "custom", // Use custom to enable width/height settings
          width: YOUTUBE_THUMBNAIL_WIDTH,
          height: YOUTUBE_THUMBNAIL_HEIGHT,
          output_format: "png",
          output_quality: 100,
          safety_tolerance: 1,
          prompt_upsampling: true,
        }
      }
    );

    if (!output) {
      throw new Error("No output received from the model");
    }

    console.log("Generated output:", output);

    return NextResponse.json({ 
      success: true, 
      output: Array.isArray(output) ? output[0] : output 
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
    
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
