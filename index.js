import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import ElevenLabs from "elevenlabs-node";
import express from "express";
import { promises } from "fs";
dotenv.config();

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceId = "jFUH3KI4dKJYVmCKLhoe"; // this voiceId is a custom one. It might cause an error while calling the API. Please, chose another one.
const voice = new ElevenLabs({
  apiKey: elevenLabsApiKey, // Your API key from Elevenlabs
  voiceId: voiceId, // A Voice ID from Elevenlabs
});
const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// app.get("/voices", async (req, res) => {
//   res.send(await voice.getVoices(elevenLabsApiKey));
// });

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (audio) => {
  const time = new Date().getTime();
  console.log(`Starting conversion for ${audio}`);
  await execCommand(
    `ffmpeg -y -i audios/${audio}.mp3 audios/${audio}.wav`
    // -y to overwrite the file
    // remember to install the ffmpeg in your pc correctly
  );
  console.log(`Conversion done in ${new Date().getTime() - time}ms`);
  await execCommand(
    `./bin/rhubarb -f json -o audios/${audio}.json audios/${audio}.wav -r phonetic`
  );
  // -r phonetic is faster but less accurate
  // to install it, go to DanielSWolf's rhubarb-lip-sync github repository to download to add to bin.
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
};

app.post("/chat", async (req, res) => {
  console.log("req",req);
  console.log("req.body",req.body);
  const userMessage = req.body.message;
  if (!userMessage) {
    res.send({
      messages: [
        {
          text: "Sabe um fato engraçado do Elevenlabs? De acordo com a língua que o sistema identifica, ele fala na língua selecionada. Pegue esse texto por exemplo. Aqui, eu estou falando em português pois o texto foi em português.",
          audio: await audioFileToBase64("audios/intro_0.wav"),
          lipsync: await readJsonTranscript("audios/intro_0.json"),
          facialExpression: "default",
          animation: "Idle",
        },
        {
          text: "Now, if I try to speak in English, I shall say all the nexts sentences in the best English accent possible.",
          audio: await audioFileToBase64("audios/intro_1.wav"),
          lipsync: await readJsonTranscript("audios/intro_1.json"),
          facialExpression: "smile",
          animation: "Idle",
        },
      ],
    });
    return;
  }
  if (!elevenLabsApiKey) {
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API key!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          animation: "Idle",
        },
        {
          text: "You NEED to generate YOUR ElevenLabs API key.",
          audio: await audioFileToBase64("audios/api_1.wav"),
          lipsync: await readJsonTranscript("audios/api_1.json"),
          facialExpression: "angry",
          animation: "Idle",
        },
      ],
    });
    return;
  }

  let newMassages = { messages: [] };
  let massageTemplate = {
    text: userMessage,
    facialExpression: "default",
    animation: "Idle",
  };

  // generate audio file
  const fileName = `message`; // The name of your audio file
  const textInput = userMessage; // The text you wish to convert to speech
  let audio = await voice.textToSpeech({
    voiceId: voiceId,
    fileName: `audios/${fileName}.mp3`,
    textInput: textInput,
    similarityBoost: 0.75,
    stability: 0.5,
    speakerBoost: true,
    style: 0,
    modelId: "eleven_multilingual_v2",
  });
  console.log("file created", audio);

  // generate lipsync
  await lipSyncMessage(fileName);
  massageTemplate.audio = await audioFileToBase64(`audios/${fileName}.mp3`);
  massageTemplate.lipsync = await readJsonTranscript(`audios/${fileName}.json`);
  newMassages.messages.push(massageTemplate);
  res.send(newMassages);
});

const readJsonTranscript = async (file) => {
  const data = await promises.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await promises.readFile(file);
  return data.toString("base64");
};

app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
});
