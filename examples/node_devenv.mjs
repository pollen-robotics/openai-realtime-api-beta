// node_devenv.mjs
// Adapted for Ubuntu from the original Mac version.
// This script connects to the OpenAI Realtime API to create a voice-based assistant.
// It captures audio input from your microphone, sends it to the OpenAI API for processing,
// and plays back the assistant's audio response through your speakers.
//
// Setup Instructions for Ubuntu:
// 1. Install Node.js and npm.
// 2. Run `npm install` to install required packages (e.g., @openai/realtime-api-beta, mic, speaker, dotenv).
// 3. Ensure your microphone and speakers are properly configured on your Ubuntu system.
// 4. Create a `.env` file with your API key and, optionally, a microphone device:
//      OPENAI_API_KEY=your_api_key_here
//      MIC_DEVICE=default         (or set to a specific ALSA device, e.g. "plughw:1,0")
// 5. Run the script with: `node node_devenv.mjs`

import { RealtimeClient } from '@openai/realtime-api-beta';
import mic from 'mic';
import { Readable } from 'stream';
import Speaker from 'speaker';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('ERROR: Please set your OPENAI_API_KEY in your .env file or environment variables.');
  process.exit(1);
}

const client = new RealtimeClient({
  apiKey: API_KEY,
  model: 'gpt-4o-realtime-preview-2024-10-01',
});

let micInstance;
let speaker;

// Starting the script with verbose logging.
console.log("Starting the voice assistant script on Ubuntu...");

async function main() {
  try {
    console.log('Connecting to the OpenAI Realtime API...');
    await client.connect();
    console.log('Successfully connected to the API.');
    startAudioStream();
  } catch (error) {
    console.error('Error connecting to OpenAI Realtime API:', error);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(main, 5000);
  }
}

main();

// Listen for completed conversation items and play audio if available.
client.on('conversation.item.completed', ({ item }) => {
  console.log('Received a completed conversation item:', item);

  if (
    item.type === 'message' &&
    item.role === 'assistant' &&
    item.formatted &&
    item.formatted.audio
  ) {
    console.log('Assistant audio response detected. Preparing to play...');
    playAudio(item.formatted.audio);
  } else {
    console.log('The conversation item does not contain audio content.');
  }
});

// Configure and start the microphone stream.
function startAudioStream() {
  try {
    // Define options for the mic. Enable debug for more verbose logging.
    const micOptions = {
      rate: '24000',
      channels: '1',
      debug: true,
      exitOnSilence: 6,
      fileType: 'raw',
      encoding: 'signed-integer',
    };

    // On Linux, you might need to specify the device (e.g., via the MIC_DEVICE env variable).
    if (process.platform === 'linux') {
      micOptions.device = process.env.MIC_DEVICE || 'default';
      console.log(`Running on Linux. Using microphone device: ${micOptions.device}`);
    }

    micInstance = mic(micOptions);
    const micInputStream = micInstance.getAudioStream();

    micInputStream.on('startComplete', () => {
      console.log('Microphone stream started successfully.');
    });

    micInputStream.on('stopComplete', () => {
      console.log('Microphone stream has been stopped.');
    });

    micInputStream.on('error', (error) => {
      console.error('Microphone encountered an error:', error);
    });

    // Log every data event and process audio in fixed-size chunks.
    micInputStream.on('data', (data) => {
      console.log(`Received audio data chunk (${data.length} bytes).`);
      processAudioData(data);
    });

    micInputStream.on('silence', () => {
      console.log('Silence detected. Triggering response creation...');
      try {
        client.createResponse();
      } catch (error) {
        console.error('Error while triggering response creation:', error);
      }
    });

    micInstance.start();
    console.log('Microphone has started streaming audio.');
  } catch (error) {
    console.error('Error starting the audio stream:', error);
  }
}

// Global buffer to accumulate incoming audio data.
let audioBuffer = Buffer.alloc(0);
const chunkSize = 4800; // ~0.2 seconds of audio at 24000 Hz (1 channel, 16-bit)

// Processes incoming audio data in fixed-size chunks.
function processAudioData(data) {
  try {
    audioBuffer = Buffer.concat([audioBuffer, data]);
    // Process the buffer in chunks
    while (audioBuffer.length >= chunkSize) {
      const chunk = audioBuffer.slice(0, chunkSize);
      audioBuffer = audioBuffer.slice(chunkSize);

      // Convert Buffer to Int16Array
      const int16Array = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.length / 2);
      console.log('Sending an audio chunk to the OpenAI Realtime API...');
      try {
        client.appendInputAudio(int16Array);
      } catch (error) {
        console.error('Error sending audio chunk:', error);
      }
    }
  } catch (error) {
    console.error('Error processing audio data:', error);
  }
}

// Plays audio received from the API.
function playAudio(audioData) {
  try {
    console.log('Preparing to play received audio...');
    if (!speaker) {
      speaker = new Speaker({
        channels: 1,
        bitDepth: 16,
        sampleRate: 24000,
      });
      console.log('Speaker instance created for audio playback.');
    }

    // Convert the Int16Array audioData to a Buffer.
    const buffer = Buffer.from(audioData.buffer);
    console.log(`Audio data converted to Buffer (length: ${buffer.length} bytes).`);

    // Create a Readable stream from the Buffer and pipe it to the speaker.
    const readableStream = new Readable({
      read() {
        this.push(buffer);
        this.push(null); // Signal end-of-stream.
      },
    });

    readableStream.pipe(speaker);
    console.log('Audio is now playing through your speakers.');

    // Listen for the 'close' event to reinitialize the speaker for future playbacks.
    speaker.on('close', () => {
      console.log('Speaker closed after playback. Resetting speaker instance.');
      speaker = null;
    });
  } catch (error) {
    console.error('Error during audio playback:', error);
  }
}
