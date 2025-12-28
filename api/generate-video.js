// api/generate-video.js
import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, model, config } = req.body;

    // Initialize Gemini API with server-side key
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const generateVideoPayload = {
      model: model || 'veo-3',
      config: config || {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      },
      prompt: prompt
    };

    // Generate video
    let operation = await ai.models.generateVideos(generateVideoPayload);

    // Poll until complete
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    if (operation?.response) {
      const videos = operation.response.generatedVideos;

      if (!videos || videos.length === 0) {
        throw new Error('No videos were generated.');
      }

      const firstVideo = videos[0];
      const videoUri = firstVideo.video?.uri;

      if (!videoUri) {
        throw new Error('Generated video is missing a URI.');
      }

      // Fetch the video
      const videoUrl = decodeURIComponent(videoUri);
      const videoResponse = await fetch(`${videoUrl}&key=${process.env.GEMINI_API_KEY}`);

      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.status}`);
      }

      const videoBuffer = await videoResponse.arrayBuffer();

      // Return video as base64
      const base64Video = Buffer.from(videoBuffer).toString('base64');

      return res.status(200).json({
        success: true,
        video: base64Video,
        uri: videoUrl,
        videoObject: firstVideo.video
      });
    } else {
      throw new Error('No videos generated.');
    }
  } catch (error) {
    console.error('Video generation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
