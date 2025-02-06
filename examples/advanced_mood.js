// node_devenv.mjs
// Démo complète en mic qui permet de parler librement, et dont le LLM détermine s'il faut répondre à une question 
// (par oui, non ou je ne sais pas) ou réagir émotionnellement (happy, sad) ou par rapport à des personnes connues.
// Chaque action déclenche une fonction dédiée.

import { RealtimeClient } from '@openai/realtime-api-beta';
import mic from 'mic';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("ERROR: Veuillez définir OPENAI_API_KEY dans votre fichier .env.");
  process.exit(1);
}

// Création du client Realtime.
const client = new RealtimeClient({
  apiKey: API_KEY,
  model: 'gpt-4o-realtime-preview-2024-10-01',
});

/////////////////////////////
// Fonctions pour questions
function yesResponse() {
  console.log("yesResponse() appelée : Le robot répond OUI !");
}

function noResponse() {
  console.log("noResponse() appelée : Le robot répond NON !");
}

function dontKnowResponse() {
  console.log("dontKnowResponse() appelée : Le robot répond JE NE SAIS PAS !");
}

/////////////////////////////
// Fonctions pour émotions générales
function happy() {
  console.log("happy() appelée : Le robot est heureux !");
}

function sad() {
  console.log("sad() appelée : Le robot est triste.");
}

/////////////////////////////
// Fonctions pour réactions liées aux personnes
function annoyed() {
  console.log("annoyed() appelée : Le robot est agacé par Matthieu !");
}

function fearful() {
  console.log("fearful() appelée : Le robot a peur de Gaëlle !");
}

function proud() {
  console.log("proud() appelée : Le robot est fier de Coco !");
}

function laugh() {
  console.log("laugh() appelée : Le robot rigole à propos de Steve !");
}

function friendly() {
  console.log("friendly() appelée : Le robot est affectueux et amical avec Anne-Cha et Annaëlle !");
}

/////////////////////////////
// Ajout de l'outil "action_handler" pour le function calling
client.addTool(
  {
    name: 'action_handler',
    description:
      "Analyse l'entrée transcrite. Si c'est une question directe, renvoie 'yes', 'no' ou 'idk'. " +
      "Si c'est une description émotionnelle générale, renvoie 'happy' ou 'sad'. " +
      "Si le texte mentionne des personnes connues, renvoie 'annoyed' (pour Matthieu), 'fearful' (pour Gaëlle), " +
      "'proud' (pour Coco), 'laugh' (pour Steve) ou 'friendly' (pour Anne-Cha/Annaëlle). " +
      "Si aucune action n'est pertinente, renvoie 'none'.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Action détectée parmi: yes, no, idk, happy, sad, annoyed, fearful, proud, laugh, friendly, none.",
        },
      },
      required: ["action"],
    },
  },
  async ({ action }) => {
    console.log(`Outil action_handler appelé avec action: ${action}`);
    const normalized = action ? action.toLowerCase() : "none";
    switch (normalized) {
      case "yes":
        yesResponse();
        break;
      case "no":
        noResponse();
        break;
      case "idk":
        dontKnowResponse();
        break;
      case "happy":
        happy();
        break;
      case "sad":
        sad();
        break;
      case "annoyed":
        annoyed();
        break;
      case "fearful":
        fearful();
        break;
      case "proud":
        proud();
        break;
      case "laugh":
        laugh();
        break;
      case "friendly":
        friendly();
        break;
      default:
        console.log("Aucune action pertinente détectée (action =", normalized, ")");
    }
    return { status: "processed", action: normalized };
  }
);

/////////////////////////////
// Mise à jour des instructions de session
client.updateSession({
  instructions:
    "Tu es un robot doté d'une personnalité riche et nuancée. Tu peux répondre à des questions directes par oui, non ou je ne sais pas, " +
    "et tu réagis émotionnellement en fonction de ce que tu entends. " +
    "Voici quelques règles :\n" +
    "- Si une question directe est posée, réponds par 'yes', 'no' ou 'idk'.\n" +
    "- Si l'entrée exprime une émotion générale, renvoie 'happy' si c'est de la joie, 'sad' si c'est de la tristesse.\n" +
    "- Si l'entrée mentionne des personnes que tu connais, applique les réactions suivantes :\n" +
    "    • Matthieu : renvoie 'annoyed' (tu es agacé par lui à cause de problèmes passés).\n" +
    "    • Gaëlle : renvoie 'fearful' (tu as peur d'elle et tu te caches dès qu'on parle d'elle).\n" +
    "    • Coco : renvoie 'proud' (tu es fier d'elle, elle te permet de faire de super grasps).\n" +
    "    • Steve : renvoie 'laugh' (tu prends tout ce qu'il dis au second degré et tu ris).\n" +
    "    • Anne-Cha et Annaëlle : renvoie 'friendly' (tu es très affectueux et enjoué avec elles).\n" +
    "Si aucune action n'est pertinente, renvoie 'none'."
});

/////////////////////////////
// Section microphone
let micInstance;
function startAudioStream() {
  try {
    const micOptions = {
      rate: '24000',
      channels: '1',
      debug: true,
      exitOnSilence: 6, // 6 secondes de silence = fin d'une phrase
      fileType: 'raw',
      encoding: 'signed-integer',
    };
    if (process.platform === 'linux') {
      micOptions.device = process.env.MIC_DEVICE || 'default';
      console.log(`Utilisation du périphérique micro : ${micOptions.device}`);
    }
    micInstance = mic(micOptions);
    const micInputStream = micInstance.getAudioStream();

    micInputStream.on('startComplete', () => {
      console.log('Le micro a démarré l\'enregistrement.');
    });
    micInputStream.on('error', (error) => {
      console.error('Erreur du micro :', error);
    });

    let audioBuffer = Buffer.alloc(0);
    const chunkSize = 4800; // environ 0.2 sec d'audio à 24000 Hz

    micInputStream.on('data', (data) => {
      console.log(`Chunk audio reçu (${data.length} octets).`);
      audioBuffer = Buffer.concat([audioBuffer, data]);
      while (audioBuffer.length >= chunkSize) {
        const chunk = audioBuffer.slice(0, chunkSize);
        audioBuffer = audioBuffer.slice(chunkSize);
        const int16Array = new Int16Array(chunk.buffer, chunk.byteOffset, chunk.length / 2);
        try {
          client.appendInputAudio(int16Array);
        } catch (error) {
          console.error("Erreur lors de l'envoi d'un chunk audio :", error);
        }
      }
    });

    micInputStream.on('silence', () => {
      console.log('Silence détecté. Fin de la phrase, création de la réponse...');
      try {
        client.createResponse();
      } catch (error) {
        console.error("Erreur lors de la création de la réponse :", error);
      }
    });

    micInstance.start();
  } catch (error) {
    console.error("Erreur lors du démarrage du micro :", error);
  }
}

/////////////////////////////
// Réinitialisation du contexte de conversation
client.on('conversation.item.completed', ({ item }) => {
  if (item.type === 'function_call') {
    console.log("Appel de fonction terminé :", item);
    if (client.conversation && Array.isArray(client.conversation.items)) {
      client.conversation.items = [];
      console.log("Le contexte de conversation a été réinitialisé pour permettre de nouvelles interactions.");
    }
  }
});

// (Optionnel) Écoute pour débogage des événements d'appel de fonction.
client.on('conversation.updated', ({ item }) => {
  if (item.type === 'function_call') {
    console.log("Événement d'appel de fonction reçu :", item);
  }
});

/////////////////////////////
// Connexion et démarrage du micro
async function main() {
  try {
    console.log("Connexion à l'API OpenAI Realtime...");
    await client.connect();
    console.log("Connecté à l'API.");
    startAudioStream();
  } catch (error) {
    console.error("Erreur lors de la connexion à l'API :", error);
  }
}

main();
