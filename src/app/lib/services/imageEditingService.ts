import Replicate from 'replicate';

// Constants for image dimensions and configuration
export const IMAGE_DIMENSIONS = {
  YOUTUBE_THUMBNAIL: {
    WIDTH: 1280,
    HEIGHT: 720,
  }
} as const;

interface ImageEditInput {
  imageUrl: string;
  prompt: string;
  mask: string;
}

interface ImageEditConfig {
  width?: number;
  height?: number;
  inpaintStrength?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  safetyTolerance?: number;
}

export class ImageEditingService {
  private replicate: Replicate;
  
  constructor(apiKey: string) {
    this.replicate = new Replicate({
      auth: apiKey,
    });
  }

  private sanitizePrompt(prompt: string): string {
    return prompt.replace(/\b(nsfw|nude|naked|explicit)\b/gi, '');
  }

  async editImage(
    input: ImageEditInput, 
    config: ImageEditConfig = {}
  ) {
    const {
      width = IMAGE_DIMENSIONS.YOUTUBE_THUMBNAIL.WIDTH,
      height = IMAGE_DIMENSIONS.YOUTUBE_THUMBNAIL.HEIGHT,
      inpaintStrength = 0.8,
      numInferenceSteps = 50,
      guidanceScale = 7.5,
      safetyTolerance = 1,
    } = config;

    const sanitizedPrompt = this.sanitizePrompt(input.prompt);

    const output = await this.replicate.run(
      "black-forest-labs/flux-1.1-pro",
      {
        input: {
          prompt: `safe for work, family friendly, ${sanitizedPrompt}`,
          image_prompt: input.imageUrl,
          mask: input.mask,
          aspect_ratio: "custom",
          width,
          height,
          output_format: "png",
          output_quality: 100,
          safety_tolerance: safetyTolerance,
          prompt_upsampling: true,
          mode: "inpaint",
          inpaint_strength: inpaintStrength,
          num_inference_steps: numInferenceSteps,
          guidance_scale: guidanceScale,
          seed: -1,
        }
      }
    );

    if (!output) {
      throw new Error("No output received from the model");
    }

    return Array.isArray(output) ? output[0] : output;
  }
} 