/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Video } from '@google/genai';
import { GenerateVideoParams, GenerationMode } from '../types';

export const generateVideo = async (
  params: GenerateVideoParams,
): Promise<{objectUrl: string; blob: Blob; uri: string; video: Video}> => {
  console.log('Starting video generation with params:', params);

  // Prepare the payload for our backend API
  const payload: any = {
    prompt: params.prompt,
    model: params.model,
    config: {
      numberOfVideos: 1,
      resolution: params.resolution,
    }
  };

  // Conditionally add aspect ratio
  if (params.mode !== GenerationMode.EXTEND_VIDEO) {
    payload.config.aspectRatio = params.aspectRatio;
  }

  // Handle different generation modes
  if (params.mode === GenerationMode.FRAMES_TO_VIDEO) {
    if (params.startFrame) {
      payload.startFrame = {
        imageBytes: params.startFrame.base64,
        mimeType: params.startFrame.file.type,
      };
    }

    const finalEndFrame = params.isLooping ? params.startFrame : params.endFrame;
    if (finalEndFrame) {
      payload.config.lastFrame = {
        imageBytes: finalEndFrame.base64,
        mimeType: finalEndFrame.file.type,
      };
    }
  } else if (params.mode === GenerationMode.REFERENCES_TO_VIDEO) {
    const referenceImages: any[] = [];

    if (params.referenceImages) {
      for (const img of params.referenceImages) {
        referenceImages.push({
          image: {
            imageBytes: img.base64,
            mimeType: img.file.type,
          },
          referenceType: 'ASSET',
        });
      }
    }

    if (params.styleImage) {
      referenceImages.push({
        image: {
          imageBytes: params.styleImage.base64,
          mimeType: params.styleImage.file.type,
        },
        referenceType: 'STYLE',
      });
    }

    if (referenceImages.length > 0) {
      payload.config.referenceImages = referenceImages;
    }
  } else if (params.mode === GenerationMode.EXTEND_VIDEO) {
    if (params.inputVideoObject) {
      payload.video = params.inputVideoObject;
    } else {
      throw new Error('An input video object is required to extend a video.');
    }
  }

  // Call our backend API instead of Google directly
  console.log('Calling backend API...');
  const response = await fetch('/api/generate-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API request failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Video generation failed');
  }

  // Convert base64 to blob
  const binaryString = atob(data.video);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const videoBlob = new Blob([bytes], { type: 'video/mp4' });
  const objectUrl = URL.createObjectURL(videoBlob);

  console.log('Video generated successfully!');
  return {
    objectUrl,
    blob: videoBlob,
    uri: data.uri,
    video: data.videoObject
  };
};
