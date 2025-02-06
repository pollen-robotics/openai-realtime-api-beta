// node_devenv.mjs
// Minimal demo for function calling via the Realtime API (text-based input).
// The LLM is responsible for analyzing the input text and, if an emotion is detected,
// calling the 'mood_handler' tool with the detected mood.

import { RealtimeClient } from '@openai/realtime-api-beta';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('ERROR: Please set your OPENAI_API_KEY in your .env file or environment variables.');
  process.exit(1);
}

// Create the RealtimeClient instance.
const client = new RealtimeClient({
  apiKey: API_KEY,
  model: 'gpt-4o-realtime-preview-2024-10-01',
});

// Local functions to be called.
function happy() {
  console.log("happy() called: You are happy!");
}

function sad() {
  console.log("sad() called: You are sad.");
}

// Add a tool for the LLM to call when it detects an emotion.
client.addTool(
  {
    name: 'mood_handler',
    description: 'Detects the mood in the text. Call happy() if the text is happy, sad() if it is sad.',
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
    const normalized = mood ? mood.toLowerCase() : "";
    if (normalized === 'happy') {
      happy();
    } else if (normalized === 'sad') {
      sad();
    } else {
      console.log("No strong emotion detected; no function is called.");
    }
    return { status: 'done', mood };
  }
);

// Instruct the LLM to use function calling based on the text it receives.
client.updateSession({
  instructions:
    "When you receive an input text that clearly expresses an emotion, use function calling to call mood_handler with the detected mood. For example, if the text says 'I'm feeling really happy today!', call mood_handler with mood 'happy'. If it says 'I'm very sad', call it with mood 'sad'. If no strong emotion is present, do not call any function.",
});

// For demonstration purposes, send a text message.
async function main() {
  try {
    console.log("Connecting to OpenAI Realtime API...");
    await client.connect();
    console.log("Connected to the API.");
    
    // Send a text message that expresses a clear emotion.
    const text = "I'm feeling really happy today!";
    console.log(`Sending user text: "${text}"`);
    client.sendUserMessageContent([{ type: 'input_text', text }]);
  } catch (error) {
    console.error("Error during connection or message sending:", error);
  }
}

// Optional: Listen for function call events for debugging.
client.on('conversation.updated', ({ item }) => {
  if (item.type === 'function_call') {
    console.log("Function call event received:", item);
  }
});
client.on('conversation.item.completed', ({ item }) => {
  if (item.type === 'function_call') {
    console.log("Function call completed:", item);
  }
});

main();
