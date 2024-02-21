const http = require('http');
const https = require('https');
const fetch = require('node-fetch');
const Jimp = require('jimp');
const path = require('path');
const bodyParser = require('body-parser');
//const qrcode = require('qrcode-terminal');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = fs.promises; // Para operações assíncronas baseadas em promessas
const { Client, Buttons, List, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const OpenAI = require('openai');
const { spawn } = require('child_process');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
require('dotenv').config();

// Gere o seu token 32 caracteres
const SECURITY_TOKEN = "a9387747d4069f22fca5903858cdda24";
//const KIWIFY_TOKEN = process.env.KIWIFY_TOKEN;

const sessao = "sendMessage";

const app = express();
const server = http.createServer(app);

const port = 8888;

app.use(cors());
app.use(express.static('public'));
//app.use(bodyParser.json());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

function readJSONFile(nomeArquivo) {
  if (fs.existsSync(nomeArquivo)) {
    const dados = fs.readFileSync(nomeArquivo);
    return JSON.parse(dados);
  } else {
    return [];
  }
}

function writeJSONFile(nomeArquivo, dados) {
  const dadosJSON = JSON.stringify(dados, null, 2);
  fs.writeFileSync(nomeArquivo, dadosJSON);
}

// DB Versão 2

const DATABASE_FILE_TYPEBOT_V2 = 'typebotDBV2.json';

function initializeDBTypebotV2() {
  // Verifica se o arquivo do banco de dados já existe
  if (!fs.existsSync(DATABASE_FILE_TYPEBOT_V2)) {
      // Se não existir, inicializa com um objeto vazio
      const db = {};
      writeJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2, db);
  } else {
      // Se já existir, mantém os dados existentes
      console.log('Banco de dados V2 pronto no sendMessage.');
  }
}

function listAllFromDBTypebotV2() {
  return readJSONFileTypebotV2(DATABASE_FILE_TYPEBOT_V2);
}

function readJSONFileTypebotV2(filename) {
  try {
      return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (error) {
      return {};
  }
}

function writeJSONFileTypebotV2(filename, data) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

initializeDBTypebotV2();

// Fim Versão 2

// Dados do sistema

const DATABASE_FILE_SYSTEM = 'typeSystemDB.json';

function addObjectSystem(url_chat, openaikey, elevenlabskey) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SYSTEM);

  // Verificar a unicidade do url_chat
  const existeurlchat = dadosAtuais.some(objeto => objeto.url_chat === url_chat);
  if (existeurlchat) {
    throw new Error('O URL Chat já existe no banco de dados.');
  }

  const objeto = {url_chat, openaikey, elevenlabskey};  

  dadosAtuais.push(objeto);
  writeJSONFile(DATABASE_FILE_SYSTEM, dadosAtuais);
}

function readURL(indice) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SYSTEM);

  // Verifica se DATABASE_FILE_SYSTEM é não vazio
  if (!dadosAtuais || dadosAtuais.length === 0) {
      console.error('O arquivo de dados está vazio.');
      return null;
  }

  // Verifica se o índice é válido
  if (indice < 0 || indice >= dadosAtuais.length) {
      console.error('Índice inválido.');
      return null;
  }

  // Retorna a URL e as chaves correspondentes ao índice fornecido
  const objeto = dadosAtuais[indice];
  return {
      url_chat: objeto.url_chat,
      openaikey: objeto.openaikey,
      elevenlabskey: objeto.elevenlabskey
  };
}

function updateObjectSystem(url_chat, openaikey, elevenlabskey) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SYSTEM);
  const objeto = dadosAtuais.find(obj => obj.url_chat === url_chat);

  if (!objeto) {
      throw new Error('URL Chat não encontrado.');
  }

  objeto.openaikey = openaikey;
  objeto.elevenlabskey = elevenlabskey;

  writeJSONFile(DATABASE_FILE_SYSTEM, dadosAtuais);
}

function deleteObjectSystem(url_chat) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SYSTEM);
  const novosDados = dadosAtuais.filter(obj => obj.url_chat !== url_chat);
  writeJSONFile(DATABASE_FILE_SYSTEM, novosDados);
}

function existsDBSystem(url_chat) {
  const dadosAtuais = readJSONFile(DATABASE_FILE_SYSTEM);
  return dadosAtuais.some(obj => obj.url_chat !== url_chat);
}

function existsTheDBSystem() {
  // Verifica se o arquivo DATABASE_FILE_SYSTEM existe
  if (!fs.existsSync(DATABASE_FILE_SYSTEM)) {
    return false; // Retorna false se o arquivo não existir
  }

  const dadosAtuais = readJSONFile(DATABASE_FILE_SYSTEM);

  // Verifica se o arquivo está vazio
  if (dadosAtuais.length === 0) {
    return false; // Retorna false se o arquivo estiver vazio
  }
  
  return true;
}

// Fim dos dados do sistema

// Rotinas de AI

const apiInit = readURL(0);
let openai; // Declaração da variável fora do bloco if

if (apiInit) {    
    if (apiInit.openaikey) {      
      openai = new OpenAI({ apiKey: apiInit.openaikey }); // Inicialização da variável
    } else {
      console.error("Chave OpenAI não encontrada no objeto.");
    }
} else {
    console.error("Autentique o seu TypeZapAI");
}

async function initializeClientOpenAI(openaiKey) {    
    openai = new OpenAI({ apiKey: openaiKey });
}

// Fim das Rotinas de AI

function createFolderIfNotExists(folderPath) {
  if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`Pasta criada: ${folderPath}`);
  } else {
      console.log(`Pasta já existe: ${folderPath}`);
  }
}

// Caminhos das pastas
const mediaPath = path.join(__dirname, 'media');
const leadsPath = path.join(__dirname, 'leadslista');
const audioBrutoPath = path.join(__dirname, 'audiobruto');
const audioLiquidoPath = path.join(__dirname, 'audioliquido');
const audioSintetizadoPath = path.join(__dirname, 'audiosintetizado');
const imagemPath = path.join(__dirname, 'imagemliquida');

// Criar as pastas
createFolderIfNotExists(mediaPath);
createFolderIfNotExists(leadsPath);
createFolderIfNotExists(audioBrutoPath);
createFolderIfNotExists(audioLiquidoPath);
createFolderIfNotExists(audioSintetizadoPath);
createFolderIfNotExists(imagemPath);

//Fim do mecanismo para criar pasta

// Criar as pastas

const WEBHOOK_DB_FILE = 'webhookDB.json';

function initializeWebhookDB() {
  // Verifica se o arquivo do banco de dados já existe
  if (!fs.existsSync(WEBHOOK_DB_FILE)) {
    // Se não existir, inicializa com um objeto vazio
    const db = {};
    writeJSONFileWebhookDB(WEBHOOK_DB_FILE, db);
  } else {
    // Se já existir, mantém os dados existentes
    console.log('Banco de dados de webhook pronto para uso.');
  }
}

function addOrUpdateWebhook(numeroId, plataforma, status) {
  const db = readJSONFileWebhookDB(WEBHOOK_DB_FILE);
  // Atualiza ou adiciona novo webhook com os dados fornecidos
  db[numeroId] = { plataforma, status };
  writeJSONFileWebhookDB(WEBHOOK_DB_FILE, db);
}

function listAllWebhooks() {
  return readJSONFileWebhookDB(WEBHOOK_DB_FILE);
}

function readJSONFileWebhookDB(filename) {
  try {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (error) {
    console.error('Erro ao ler o banco de dados:', error);
    return {};
  }
}

function writeJSONFileWebhookDB(filename, data) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf8');
}

// Inicializa o banco de dados de webhook, se necessário
initializeWebhookDB();

// Configurações para o primeiro cliente (Windows)
/*const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessao }),
    puppeteer: {
      executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    }
});*/
  
  //Kit com os comandos otimizados para nuvem Ubuntu Linux (créditos Pedrinho da Nasa Comunidade ZDG)
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessao }),
    puppeteer: {
      headless: true,
      //CAMINHO DO CHROME PARA WINDOWS (REMOVER O COMENTÁRIO ABAIXO)
      //executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      //===================================================================================
      // CAMINHO DO CHROME PARA MAC (REMOVER O COMENTÁRIO ABAIXO)
      //executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      //===================================================================================
      // CAMINHO DO CHROME PARA LINUX (REMOVER O COMENTÁRIO ABAIXO)
       executablePath: '/usr/bin/google-chrome-stable',
      //===================================================================================
      args: [
        '--no-sandbox', //Necessário para sistemas Linux
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- Este não funciona no Windows, apague caso suba numa máquina Windows
        '--disable-gpu'
      ]
    }
  });

  async function sendMessageWithRetry(phoneNumber, messageToSend) {
    try {
        await client.sendMessage(phoneNumber, messageToSend);      
    } catch (error) {
        console.error(`Falha ao enviar mensagem para ${phoneNumber}: erro: ${error}`);
        // Sinaliza ao PM2 para reiniciar o aplicativo devido a um erro crítico
        process.exit(1);
    }
  }

  async function extrairGrupo(grupoId) {
    const chat = await client.getChatById(grupoId);
    const contatos = [];
  
    chat.participants.forEach(participant => {
      if (!participant.isMe) {
        contatos.push(participant.id._serialized);
      }
    });
  
    return contatos;
  }

  async function sendMessageWithMention(phoneNumber, originalMessage, chat) {
    try {        
        let messageToSend = originalMessage.replace('!citartodos', '').trim();        
        if (phoneNumber.endsWith('@g.us')) {           
          const contatos = [];  
          chat.participants.forEach(participant => {
          if (!participant.isMe) {
          contatos.push(participant.id._serialized);
          }
          });
          await chat.sendMessage(`${messageToSend}`, {
            mentions: contatos
        });
        } else if (phoneNumber.endsWith('@c.us')) {
            // Para um usuário individual, mencionar o usuário na mensagem
            await chat.sendMessage(`${messageToSend}`, {
                mentions: [phoneNumber]
            });
        }
    } catch (error) {
        console.error(`Falha ao enviar mensagem para ${phoneNumber}: erro: ${error}`);
        process.exit(1); // Considerar manejo de erro mais sofisticado em produção
    }
}


  const appQR = express();
  const serverQR = http.createServer(appQR);
  const io = socketIo(serverQR);

  const portQR = 8083;

  appQR.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/sendMessageQR.html');
  });
    
  // Evento 'qr' - já fornecido anteriormente
client.on('qr', qr => {
    console.log('qr gerado');
    QRCode.toDataURL(qr, { errorCorrectionLevel: 'H' }, (err, url) => {
      if (err) {
        console.error('Erro ao gerar QR code', err);
        return;
      }
      io.emit('qr code', url);
    });
  });
  
  // Evento 'ready'
  client.on('ready', () => {
    console.log('API de endpoint sendMessage pronta e conectada.');
    io.emit('connection-ready', 'API pronta e conectada.');
  });
  
  // Evento 'authenticated'
  client.on('authenticated', () => {
    console.log('Autenticação bem-sucedida.');
    io.emit('authenticated', 'Autenticação bem-sucedida.');
  });
  
  client.on('disconnected', (reason) => {
    console.log(`Cliente desconectado: ${reason}`);
    io.emit('disconnected', `Cliente desconectado: ${reason}`);

    if (reason === 'NAVIGATION') {
        console.log('Reconectando instância e gerando novo QR code...');
        client.destroy().then(() => {
            client.initialize(); // Inicia uma nova instância
        });
    } else {
        console.log('Razão de desconexão não requer a geração de um novo QR code.');
    }
  });

  client.initialize();

  io.on('connection', (socket) => {
    console.log('Um usuário se conectou');     
    socket.on('disconnect', () => {
      console.log('Usuário desconectou');
    });
  });
  
  serverQR.listen(portQR, () => {
    console.log(`Servidor rodando em http://localhost:${portQR}`);
  });

// endpoint sendMessage

app.post('/sendMessage', async (req, res) => {
    const { destinatario, mensagem, tipo, msg, media, token } = req.body;
    
    
    // Nova lógica para permitir mensagens sem token se a mensagem for um "gatilho"
    const dbTriggers = listAllFromDBTypebotV2(); // Obtém todos os registros do banco de dados
    let isTriggerMessage = false;

    // Verifica se a mensagem corresponde a algum "gatilho" no banco de dados
    Object.values(dbTriggers).forEach(trigger => {
        if (tipo === 'text' && mensagem === trigger.gatilho) {
            isTriggerMessage = true;
        }
    });

    // Se não for uma mensagem de gatilho e o token não for válido, retorna erro
    if (!isTriggerMessage && token !== SECURITY_TOKEN) {
        return res.status(401).json({ status: 'falha', mensagem: 'Token inválido' });
    }
    

    if (!client || !client.info) {
        return res.status(402).json({status: 'falha', message: 'Cliente Não Autenticado'});
    }

    if (!destinatario || !tipo) {
        return res.status(400).json({ status: 'falha', mensagem: 'Destinatario e tipo são obrigatórios' });
    }    

    try {
        const chatId = destinatario;

        switch (tipo) {
            case 'text':
                if (!mensagem) {
                    return res.status(400).json({ status: 'falha', mensagem: 'É preciso fornecer uma mensagem' });
                }
                let idChat, chat;
                if (chatId.endsWith('@c.us')) {
                idChat = await client.getNumberId(chatId);
                chat = await client.getChatById(idChat._serialized);
                await chat.sendStateTyping();
                } else {
                chat = await client.getChatById(chatId);
                }
                if(mensagem.includes('!citartodos')){
                await sendMessageWithMention(chatId, mensagem, chat);
                } else {
                await sendMessageWithRetry(chatId, mensagem);
                }
                break;            
            case 'image':
                if (!media) {
                    return res.status(400).json({ status: 'falha', mensagem: 'É preciso fornecer uma midia' });
                }                
                await sendMessageWithRetry(chatId, new MessageMedia(media.mimetype, media.data, media.filename));
                break;
            case 'video':
                if (!media) {
                    return res.status(400).json({ status: 'falha', mensagem: 'É preciso fornecer uma midia' });
                }
                await sendMessageWithRetry(chatId, new MessageMedia(media.mimetype, media.data, media.filename));
                break;
            case 'audio':
                if (!media) {
                    return res.status(400).json({ status: 'falha', mensagem: 'É preciso fornecer uma midia' });
                }
                await sendMessageWithRetry(chatId, new MessageMedia(media.mimetype, media.data, media.filename), {sendAudioAsVoice: true});
                break;
            case 'file':
                if (!media) {
                    return res.status(400).json({ status: 'falha', mensagem: 'É preciso fornecer uma midia' });
                }
                await sendMessageWithRetry(chatId, new MessageMedia(media.mimetype, media.data, media.filename));
                break;
            default:
                return res.status(400).json({ status: 'falha', mensagem: 'Tipo de mensagem inválido' });
        }

        res.status(200).json({ status: 'sucesso', mensagem: 'Mensagem enviada com sucesso'});
    } catch (error) {
        console.error(error);        
        res.status(500).json({ status: 'falha', mensagem: 'Erro ao enviar mensagem' });
    }
});

// Fim do endpoint sendMessage

// Funções AI

// Rodando imagem IA

async function runDallE(promptText, imagePath, imageName) {
  try {
      const genimage = await openai.images.generate({
          model: "dall-e-3",
          prompt: promptText,
          n: 1,
          size: "1024x1024",
      });
      const imageUrl = genimage.data[0].url;
      const filePath = path.join(imagePath, `${imageName}.png`);
      await saveImage(imageUrl, filePath);
      return filePath; // Retorna o caminho do arquivo da imagem salva
  } catch (error) {
      console.error('Erro ao gerar ou salvar a imagem:', error);
      throw error;
  }
}

async function saveImage(imageUrl, filePath) {
  // Fazer uma requisição HTTP GET para a imagem
  https.get(imageUrl, (response) => {
    // Inicializar um stream de escrita no arquivo
    const fileStream = fs.createWriteStream(filePath);

    // Escrever o conteúdo da imagem no arquivo
    response.pipe(fileStream);

    // Registrar o evento de finalização da escrita
    fileStream.on('finish', () => {
      console.log(`A imagem foi salva em ${filePath}`);
    });
  });
}

//Mecanismo para reconhecimento de audio e imagem

async function runAudio(arquivo) {  
  const transcript = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: fs.createReadStream(arquivo),
  });  
  return transcript.text;  
}

async function sintetizarFalaOpenAI(texto, nomeArquivo, voice) {
  try {
    const requestData = {
      model: 'tts-1',
      input: texto,
      voice: voice,
    };

    // Configura os cabeçalhos da solicitação
    const headers = {
      Authorization: `Bearer ${await readURL(0).openaikey}`,
      'Content-Type': 'application/json',
    };

    // Realiza a solicitação
    const response = await axios.post('https://api.openai.com/v1/audio/speech', requestData, { headers, responseType: 'stream' });

    const fileStream = response.data;
    const writeStream = fs.createWriteStream(`audiosintetizado/${nomeArquivo}.ogg`);

    fileStream.pipe(writeStream);

    await new Promise((resolve) => {
      writeStream.on('finish', () => {
        console.log(`Arquivo "${nomeArquivo}.ogg" baixado com sucesso.`);
        resolve();
      });
    });
  } catch (error) {
    console.error('Erro ao fazer a solicitação:', error);
  }
}

// ElevenLabs

// Configurações de voz previamente definidas
const voice_SETTINGS = {  
  similarity_boost: 0.75, 
  stability: 0.5,       
  style: 0,           
  use_speaker_boost: true
};

// Função ajustada para fazer a requisição via fetch
async function textToSpeech(voiceId, text, voiceSettings, elevenlabsKey) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const headers = {
    'Content-Type': 'application/json',
    'xi-api-key': elevenlabsKey
  };
  const data = {
    text,
    model_id: "eleven_multilingual_v2",
    voice_settings: voiceSettings
  };

  return fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(data)
  });
}

// Função para salvar o arquivo de áudio
function saveAudioFile(response, outputPath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(outputPath);
    response.body.pipe(fileStream);
    response.body.on('error', (error) => {
      console.error('Erro ao salvar o arquivo de áudio:', error);
      reject(error);
    });
    fileStream.on('finish', () => {
      console.log(`Arquivo de áudio salvo: ${outputPath}`);
      resolve();
    });
  });
}

// Função para tratar erro
function handleError(err) {
  console.error('Erro na API:', err);
}

// Ajuste da função sintetizarFalaEleven
async function sintetizarFalaEleven(texto, nomeArquivo, voiceId) {
  try {
    // Extrai a chave da API ElevenLabs
    const elevenlabsKey = readURL(0).elevenlabskey;

    // Define o caminho do arquivo de saída no diretório audiosintetizado
    const outputPath = path.join('audiosintetizado', `${nomeArquivo}.ogg`);

    // Cria o diretório se não existir
    if (!fs.existsSync('audiosintetizado')) {
      fs.mkdirSync('audiosintetizado', { recursive: true });
    }

    // Realiza a solicitação para conversão de texto em fala
    const response = await textToSpeech(voiceId, texto, voice_SETTINGS, elevenlabsKey);
    
    if (!response.ok) {
      throw new Error(`Falha na API com status: ${response.status}`);
    }

    // Salva o arquivo de áudio
    await saveAudioFile(response, outputPath);
  } catch (error) {
    handleError(error);
    throw error; // Opcionalmente, re-lance o erro para tratamento adicional
  }
}

// ElevenLabs

async function converterArquivoOGGparaMP3(caminhoArquivoEntrada, nomeArquivoSaida) {
return new Promise((resolve, reject) => {
  const ffmpeg = spawn('ffmpeg', ['-y', '-i', caminhoArquivoEntrada, '-loglevel', '0', '-nostats', nomeArquivoSaida]);

  ffmpeg.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0) {
      reject(`Erro ao executar o comando, código de saída: ${code}`);
    } else {
      resolve(`Arquivo convertido com sucesso para o formato MP3: ${nomeArquivoSaida}`);
    }
  });
});
}

async function runImage(promptText, base64Image) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
        ],
      },
    ],
  });

  return response.choices[0].message.content;
}

async function getImageContent(filePath) {
  try {
      const imageData = fs.readFileSync(filePath);
      return imageData;
  } catch (error) {
      console.error('Erro ao ler a imagem:', error);
      throw error;
  }
}

function encodeImage(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return Buffer.from(imageBuffer).toString('base64');
}

async function processMessageIA(msg) {

if (msg.hasMedia) {
  const attachmentData = await msg.downloadMedia();
  if(readNextAudio(msg.from) === false && attachmentData.mimetype === 'audio/ogg; codecs=opus'){
    return;
  }
  if (readNextAudio(msg.from) === true && attachmentData.mimetype !== 'audio/ogg; codecs=opus' && !attachmentData.mimetype.startsWith('image/')){
    return "Mídia não detectada.";
  }
  if (readNextAudio(msg.from) === true && attachmentData.mimetype === 'audio/ogg; codecs=opus'){
    const audioFilePath = `./audiobruto/${msg.from.split('@c.us')[0]}.ogg`;

    if (fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
    }

    await writeFileAsync(audioFilePath, Buffer.from(attachmentData.data, 'base64'));

    while (true) {
      try {
        if (fs.existsSync(audioFilePath)) {
          await converterArquivoOGGparaMP3(audioFilePath, `./audioliquido/${msg.from.split('@c.us')[0]}.mp3`);
          fs.unlinkSync(audioFilePath);
          return await brokerMaster(runAudio, `./audioliquido/${msg.from.split('@c.us')[0]}.mp3`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(err);
        break;
      }
    }
  }
  if (readNextImage(msg.from) === true && attachmentData.mimetype.startsWith('image/')) {
    const imageFilePath = `./imagemliquida/${msg.from.split('@c.us')[0]}.jpg`;

    // Verifica se o arquivo já existe e, se sim, o remove
    if (fs.existsSync(imageFilePath)) {
      fs.unlinkSync(imageFilePath);
    }

    // Salva a imagem recebida em um arquivo
    await writeFileAsync(imageFilePath, Buffer.from(attachmentData.data, 'base64'));

    // Loop para garantir que a imagem foi salva antes de prosseguir
    while (true) {
      try {
        if (fs.existsSync(imageFilePath)) {
          // Codifica a imagem em base64
          const base64Image = encodeImage(imageFilePath);          
          // Obtém a resposta do Vision e retorna
          return `Imagem enviada pelo usuário: ${await runImage(await readPrompt(msg.from), base64Image)}`;
        }

        // Aguarda um pouco antes de verificar novamente
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(err);
        break;
      }
    }
  }  
  if (readNextImage(msg.from) === false && attachmentData.mimetype.startsWith('image/')){
    return;
  }
  } 
  if (!msg.hasMedia) {
  return msg.body;
  }
}

async function tratarMidia(filePath) {
  try {
      const attachment = await fsp.readFile(filePath, { encoding: 'base64' });
      const mimetype = getMimeType(filePath);
      const filename = path.basename(filePath);

      if (attachment) {
          const media = new MessageMedia(mimetype, attachment, filename);
          return media;
      }
  } catch (e) {
      console.error(e);
  }
}

async function tratarMidiaObj(message) {  
  try {
    let fileUrl = message.content.url; // URL do arquivo
    let mimetype;
    let filename;

    // Use Axios para buscar o arquivo e determinar o MIME type.
    const attachment = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
    }).then(response => {
      mimetype = response.headers['content-type'];
      filename = fileUrl.split("/").pop();
      return response.data.toString('base64');
    });

    if (attachment) {
      const media = new MessageMedia(mimetype, attachment, filename);
      return media;
    }
  } catch (e) {
    console.error(e);
  }  
}

function brokerMaster(requestFunction, ...args) {
  const backoffDelay = 1000;
  const maxRetries = 10;

  return new Promise((resolve, reject) => {
    const makeRequest = (retryCount) => {
      requestFunction(...args)
        .then((response) => {
          resolve(response);
        })
        .catch((error) => {
          if (retryCount === maxRetries) {
            reject(error);
            return;
          }

          const delay = backoffDelay * Math.pow(2, retryCount);
          console.log(`Tentativa ${retryCount + 1} falhou. Tentando novamente em ${delay}ms...`);
          console.log(error);
          setTimeout(() => makeRequest(retryCount + 1), delay);
        });
    };

    makeRequest(0);
  });
}

//Mecanismo para produção de audio

// Fim das funções AI

// endpoint OpenAI

app.post('/initOpenai', async (req, res) => {
  const { key, token } = req.body;

  // Se não for uma mensagem de gatilho e o token não for válido, retorna erro
  if (!key.startsWith('sk-') && token !== SECURITY_TOKEN) {
      return res.status(401).json({ status: 'falha', mensagem: 'Token inválido' });
  }  

  if (!client || !client.info) {
      return res.status(402).json({status: 'falha', message: 'Cliente Não Autenticado'});
  }    

  try {
      const opeanaikey = key;
      initializeClientOpenAI(opeanaikey);
      res.status(200).json({ status: 'sucesso', mensagem: 'Key OpenAI e Client registrado com sucesso'});
  } catch (error) {
      console.error(error);        
      res.status(500).json({ status: 'falha', mensagem: 'Erro ao registrar Client OpenAI' });
  }
});

app.post('/mediaAI', async (req, res) => {
  const { path, token } = req.body;

  // Validação do Token
  if (token !== SECURITY_TOKEN) {
      return res.status(401).json({ status: 'falha', mensagem: 'Token inválido' });
  }

  // Verifica se o arquivo existe
  if (!fs.existsSync(path)) {
      return res.status(404).json({ status: 'falha', mensagem: 'Arquivo não encontrado' });
  }

  try {
      let resultado = '';

      // Processamento para Áudio
      if (path.endsWith('.ogg')) {
          const audioFilePath = path;
          const mp3FilePath = `./audioliquido/${path.split('/').pop().replace('.ogg', '.mp3')}`;

          await converterArquivoOGGparaMP3(audioFilePath, mp3FilePath);
          fs.unlinkSync(audioFilePath); // Remove o arquivo OGG original após conversão
          resultado = await brokerMaster(runAudio, mp3FilePath);
      }
      // Processamento para Imagem
      else if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png')) {
          const imageFilePath = path;
          const base64Image = encodeImage(imageFilePath);
          resultado = `Imagem enviada pelo usuário: ${await runImage(await readPrompt(path), base64Image)}`;
      } else {
          return res.status(400).json({ status: 'falha', mensagem: 'Tipo de arquivo não suportado' });
      }

      res.status(200).json({ status: 'sucesso', mensagem: resultado });
  } catch (err) {
      console.error(err);
      res.status(500).json({ status: 'falha', mensagem: 'Erro ao processar arquivo' });
  }
});

app.post('/audioOpenAI', async (req, res) => {
  const { destinatario, mensagem, token } = req.body;

  // Verificar o token
  if (token !== SECURITY_TOKEN) {
      return res.status(401).json({ status: 'falha', mensagem: 'Token inválido' });
  }

  try {
      // Sintetizar a fala
      const audioPath = await brokerMaster(sintetizarFalaOpenAI, mensagem, destinatario);

      if (!audioPath) {
          throw new Error('Falha ao sintetizar o áudio');
      }

      // Prepara o arquivo de áudio para ser enviado
      const media = { // Supondo que isso é o que o seu método espera
          mimetype: 'audio/ogg', // Ajuste conforme o formato real
          data: fs.readFileSync(audioPath).toString('base64'),
          filename: path.basename(audioPath)
      };

      const destinatarioId = await client.getNumberId(destinatario);
    
        if (destinatarioId) {
            // Obtém o chat pelo ID do destinatário.
            const chat = await client.getChatById(destinatarioId._serialized);
    
            // Simula gravação de áudio no chat.
            await chat.sendStateRecording();    
            
            await sendMessageWithRetry(destinatario, media);
        } else {
            // Enviar áudio
            await sendMessageWithRetry(destinatario, media);
        }

      // Limpa o arquivo temporário após o envio
      fs.unlinkSync(audioPath);

      res.json({ status: 'sucesso', mensagem: 'Áudio enviado com sucesso' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'falha', mensagem: 'Erro ao enviar áudio' });
  }
});

app.post('/audioElevenLabs', async (req, res) => {
  const { destinatario, mensagem, token } = req.body;

  // Verificar o token
  if (token !== SECURITY_TOKEN) {
      return res.status(401).json({ status: 'falha', mensagem: 'Token inválido' });
  }

  try {
      // Extrai o nome da voz e o texto a ser sintetizado do comando
      const audioPath = await brokerMaster(sintetizarFalaEleven, mensagem, destinatario);

      if (!audioPath) {
          throw new Error('Falha ao sintetizar o áudio com ElevenLabs');
      }

      // Trata o arquivo de áudio se necessário
      const media = await tratarMidia(audioPath);

      const destinatarioId = await client.getNumberId(destinatario);
    
        if (destinatarioId) {
            // Obtém o chat pelo ID do destinatário.
            const chat = await client.getChatById(destinatarioId._serialized);
    
            // Simula gravação de áudio no chat.
            await chat.sendStateRecording();    
            
            await sendMessageWithRetry(destinatario, media);
        } else {
            // Enviar áudio
            await sendMessageWithRetry(destinatario, media);
        }

      // Limpa o arquivo temporário após o envio
      fs.unlinkSync(audioPath);

      res.json({ status: 'sucesso', mensagem: 'Áudio enviado com sucesso' });
  } catch (error) {
      console.error('Erro ao enviar áudio com ElevenLabs:', error);
      res.status(500).json({ status: 'falha', mensagem: 'Erro ao enviar áudio' });
  }
});

// Função auxiliar para esperar a imagem estar pronta
function waitForImage(filePath, maxAttempts, interval) {
  let attempts = 0;

  return new Promise((resolve, reject) => {
      const checkImage = () => {
          Jimp.read(filePath)
              .then(() => resolve())
              .catch(() => {
                  if (attempts < maxAttempts) {
                      attempts++;
                      console.log(`A imagem ainda está sendo processada... Tentativa ${attempts}/${maxAttempts}`);
                      setTimeout(checkImage, interval);
                  } else {
                      reject(new Error('A imagem não foi processada a tempo.'));
                  }
              });
      };

      checkImage();
  });
}

app.post('/imagemOpenAI', async (req, res) => {
  const { destinatario, mensagem, token } = req.body;

  if (token !== SECURITY_TOKEN) {
      return res.status(401).json({ status: 'falha', mensagem: 'Token inválido' });
  }

  const imagePath = path.resolve(__dirname, 'imagemliquida');
  const imageName = destinatario.split('@c.us')[0];

  try {
      const filePath = await brokerMaster(runDallE, mensagem, imagePath, imageName);

      // Espera até que a imagem esteja completamente processada
      await waitForImage(filePath, 5, 2000); // Tenta por no máximo 5 vezes, esperando 2 segundos entre as tentativas

      const media = await tratarMidia(filePath);
      await sendMessageWithRetry(destinatario, media);

      fs.unlinkSync(filePath);
      res.json({ status: 'sucesso', mensagem: 'Imagem enviada com sucesso' });
  } catch (error) {
      console.error('Erro durante o processo:', error);
      res.status(500).json({ status: 'falha', mensagem: 'Erro ao enviar imagem' });
  }
});

// Metodo /media

// Função auxiliar para baixar arquivos
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
      // Verifica se o arquivo já existe
      if (fs.existsSync(filePath)) {
          resolve(filePath);
          return;
      }

      const fileStream = fs.createWriteStream(filePath);
      https.get(url, (response) => {
          response.pipe(fileStream);
          fileStream.on('finish', () => {
              fileStream.close();
              resolve(filePath);
          });
      }).on('error', (error) => {
          fs.unlink(filePath, () => reject(error));
      });
  });
}

app.post('/media', async (req, res) => {
  const { destinatario, token, link } = req.body;

  // Conferir o token
  if (token !== SECURITY_TOKEN) {
      return res.status(401).json({ status: 'falha', mensagem: 'Token inválido' });
  }

  try {
      const url = new URL(link);
      // A função path.basename já inclui a extensão do arquivo no nome do arquivo
      const filename = path.basename(url.pathname);
      const filePath = path.resolve(__dirname, 'media', filename);

      // Verifica se o arquivo já existe para evitar sobrescrita e download desnecessário
      if (!fs.existsSync(filePath)) {
          // Fazer o download do arquivo na pasta 'media', caso não exista
          await downloadFile(link, filePath);
      }

      // Carregar o arquivo da pasta e dispará-lo como mensagem ao destinatário
      const media = MessageMedia.fromFilePath(filePath);
      const extension = path.extname(filePath).toLowerCase();
      const audioExtensions = ['.mp3', '.wav', '.ogg', '.opus'];

      if (audioExtensions.includes(extension) && destinatario.endsWith('@c.us')) {
        // Se a mídia é áudio, então obtém o ID do destinatário.
        const destinatarioId = await client.getNumberId(destinatario);
    
        if (destinatarioId) {
            // Obtém o chat pelo ID do destinatário.
            const chat = await client.getChatById(destinatarioId._serialized);
    
            // Simula gravação de áudio no chat.
            await chat.sendStateRecording();    
            
            await sendMessageWithRetry(destinatario, media);
        } else {
            console.log('Número não está registrado no WhatsApp.');
        }
    } else {
      await sendMessageWithRetry(destinatario, media);
    }

      res.json({ status: 'sucesso', mensagem: 'Mídia enviada com sucesso' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'falha', mensagem: 'Erro ao enviar mídia' });
  }
});

// Método /media

// Método Kiwify

// Função para tratar o número de telefone
function formatPhoneNumberKiwify(phone) {
  // Remove caracteres não numéricos e adiciona o código do país se necessário
  let formattedPhone = phone.replace(/\D/g, '');
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }
  return `${formattedPhone}@c.us`;
}

// Função para processar Kiwify
async function processAndSendMessageKiwify(event, idString) {
  // Determina o número de telefone com base no tipo de evento
  const phoneNumber = event.checkout_link ? formatPhoneNumberKiwify(event.phone) : formatPhoneNumberKiwify(event.Customer.mobile);

  const numeroId = phoneNumber; // Usando o número de telefone como ID único
  const plataforma = "kiwify";
  
  // Determina o status com base no contexto do evento
  let status;
  if (event.checkout_link) {
    status = "abandoned";
  } else {
    status = event.order_status; // Utiliza o status do pedido diretamente
  }

  // Verifica se já existe um registro para este númeroId com status "paid"
  const webhooks = listAllWebhooks(); // Supõe a existência dessa função para listar todos os webhooks
  const isPaidAlready = webhooks[numeroId] && webhooks[numeroId].status === "paid";
  
  // Permite disparar refund e chargeback mesmo se o status anterior for "paid"
  if (isPaidAlready && (status !== "paid" && status !== "refunded" && status !== "chargedback")) {
    console.log(`Número ${numeroId} já possui status pago. Não dispara ação para status: ${status}.`);
    return; // Encerra a função para evitar ações não permitidas após um pagamento
  }

  // Atualiza o registro no banco de dados independentemente, para acomodar os novos eventos permitidos após o pagamento
  addOrUpdateWebhook(numeroId, plataforma, status);

  // Busca e envio da mensagem com base no idString e status do evento
  const dbMessages = listAllFromDBTypebotV2();
  let messageToSend = '';
  for (let key in dbMessages) {
    if (dbMessages[key].gatilho.startsWith(idString)) {
      messageToSend = dbMessages[key].gatilho.replace(idString, '');
      break;
    }
  }

  if (messageToSend) {
    console.log(`Enviando mensagem para ${phoneNumber}: "${messageToSend}"`);
    // Aqui você chamaria a função de envio real, como: await sendMessageWithRetry(phoneNumber, messageToSend);
  }
}

// Função principal para processar o evento recebido
function processEventKiwify(event) {
  if ('order_id' in event) {
    switch (event.order_status) {
      case 'paid':        
        processAndSendMessageKiwify(event, 'KiwifyAprovada: ');
        break;
        case 'waiting_payment':
        processAndSendMessageKiwify(event, 'KiwifyAguardando: ');
        break;
        case 'refused':
        processAndSendMessageKiwify(event, 'KiwifyRecusado: ');
        break;
        case 'refunded':
        processAndSendMessageKiwify(event, 'KiwifyReembolsado: ');
        break;
        case 'chargedback':
        processAndSendMessageKiwify(event, 'KiwifyChargedBack: ');
        break;
        default:
        console.log('Status de pedido desconhecido:', event.order_status);
    }
  } else if ('checkout_link' in event) {
    processAbandonedCheckoutEventKiwify(event);
  } else {
    console.log('Tipo de evento desconhecido', event);
  }
}

// Manipulador para evento de carrinho abandonado
function processAbandonedCheckoutEventKiwify(event) {
  processAndSendMessageKiwify(event, 'KiwifyAbandono: ');
}

// Exemplo de como usar a função processEvent
app.post('/kiwify', (req, res) => {
  const event = req.body;
  //console.log('Evento recebido em /kiwify:', event);

  // Processa o evento com base no seu tipo
  processEventKiwify(event);

  // Responde com sucesso
  res.status(200).send({ status: 'ok' });
});

// Fim dos Métodos Kiwify

server.listen(port, () => {
    console.log(`Servidor sendMessage rodando em http://localhost:${port}`);
});