// node_devenv.mjs
// Mic-based demo using the Realtime API with function calling.
// Speak freely into the mic. When you pause, the API processes the audio.
// If the transcribed input clearly expresses strong happiness or strong sadness,
// the LLM will call mood_handler, which then calls happy() or sad().
// After a function call is processed, we reset the conversation context so that new function calls can occur.

import { RealtimeClient } from '@openai/realtime-api-beta';
import mic from 'mic';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('ERROR: Please set your OPENAI_API_KEY in your .env file.');
  process.exit(1);
}

// Instantiate the RealtimeClient.
const client = new RealtimeClient({
  apiKey: API_KEY,
  model: 'gpt-4o-realtime-preview-2024-10-01',
});

// Local functions.
function happy() {
  console.log("happy() called: The scene is detected as happy!");
}

function sad() {
  console.log("sad() called: The scene is detected as sad.");
}

// Add a tool for mood handling.
client.addTool(
  {
    name: 'mood_handler',
    description:
      'If the transcribed input clearly expresses strong happiness, call happy(); if it clearly expresses strong sadness, call sad(); otherwise do nothing.',
    parameters: {
      type: 'object',
      properties: {
        mood: {
          type: 'string',
          description: 'The detected mood: "happy" or "sad".',
        },
      },
      required: ['mood'],
    },
  },
  async ({ mood }) => {
    console.log(`Tool invoked with mood: ${mood}`);
    const normalizedMood = mood ? mood.toLowerCase() : "";
    if (normalizedMood === 'happy') {
      happy();
    } else if (normalizedMood === 'sad') {
      sad();
    } else {
      console.log("No strong emotion detected; no function is called.");
    }
    return { status: 'processed', mood };
  }
);

// Instruct the LLM to use function calling when processing audio input.
client.updateSession({
  instructions:
    "When processing audio input from the microphone, if the last sentence clearly expresses strong happiness, call mood_handler with mood 'happy'. If it clearly expresses strong sadness, call mood_handler with mood 'sad'. Otherwise, do not call any function.",
});

// --- Microphone Setup ---
let micInstance;
function startAudioStream() {
  try {
    const micOptions = {
      rate: '24000',
      channels: '1',
      debug: true,
      exitOnSilence: 6, // 6 seconds silence triggers end of phrase.
      fileType: 'raw',
      encoding: 'signed-integer',
    };
    if (process.platform === 'linux') {
      micOptions.device = process.env.MIC_DEVICE || 'default';
      console.log(`Using microphone device: ${micOptions.device}`);
    }
    micInstance = mic(micOptions);
    const micInputStream = micInstance.getAudioStream();

    micInputStream.on('startComplete', () => {
      console.log('Microphone streaming started.');
    });
    micInputStream.on('error', (error) => {
      console.error('Microphone error:', error);
    });

    let audioBuffer = Buffer.alloc(0);
    const chunkSize = 4800; // ~0.2 sec of audio at 24000 Hz.

    micInputStream.on('data', (data) => {
      console.log(`Received audio chunk (${data.length} bytes).`);
      audioBuffer = Buffer.concat([audioBuffer, data]);
      while (audioBuffer.length >= chunkSize) {
        const chunk = audioBuffer.slice(0, chunkSize);
        audioBuffer = audioBuffer.slice(chunkSize);
        const int16Array = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.length / 2);
        try {
          client.appendInputAudio(int16Array);
        } catch (error) {
          console.error('Error sending audio chunk:', error);
        }
      }
    });

    micInputStream.on('silence', () => {
      console.log('Silence detected. Finalizing audio input...');
      try {
        client.createResponse();
      } catch (error) {
        console.error('Error triggering response creation:', error);
      }
    });

    micInstance.start();
  } catch (error) {
    console.error('Error starting microphone stream:', error);
  }
}

// --- Reset conversation after function call ---
// This hack clears the conversation context so that new audio triggers a new function call.
client.on('conversation.item.completed', ({ item }) => {
  if (item.type === 'function_call') {
    console.log("Function call completed:", item);
    // Reset conversation context (assuming conversation items are stored in client.conversation.items)
    if (client.conversation && Array.isArray(client.conversation.items)) {
      client.conversation.items = [];
      console.log("Conversation context has been reset for new input.");
    }
  }
});

// (Optional) Debugging: Log function call events.
client.on('conversation.updated', ({ item }) => {
  if (item.type === 'function_call') {
    console.log("Function call event received:", item);
  }
});

// --- Connect and start mic ---
async function main() {
  try {
    console.log("Connecting to OpenAI Realtime API...");
    await client.connect();
    console.log("Connected to the API.");
    startAudioStream();
  } catch (error) {
    console.error("Error connecting to the API:", error);
  }
}

main();
