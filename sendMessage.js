const http = require('http');
const https = require('https');
const path = require('path');
const bodyParser = require('body-parser');
//const qrcode = require('qrcode-terminal');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { Client, Buttons, List, MessageMedia, LocalAuth } = require('whatsapp-web.js');
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

function createFolderIfNotExists(folderPath) {
  if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`Pasta criada: ${folderPath}`);
  } else {
      console.log(`Pasta já existe: ${folderPath}`);
  }
}

// Caminhos das pastas
const mediaPath = path.join(__dirname, 'media')
// Criar as pastas
createFolderIfNotExists(mediaPath);

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
    }
  }

  async function sendAudioWithRetry(phoneNumber, messageToSend) {
    try {
        //const audiob01 = MessageMedia.fromFilePath('./b01.opus'); // Arquivo de audio em ogg gravado
        //await client.sendMessage(msg.from, audiob01, {sendAudioAsVoice: true}); // enviando o audio16 
        await client.sendMessage(phoneNumber, messageToSend, {sendAudioAsVoice: true});      
    } catch (error) {
        console.error(`Falha ao enviar audio para ${phoneNumber}: erro: ${error}`);        
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

app.get('/healthcheck', (req, res) => res.json({ status: 'UP' }));

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

// Endpoint /extensaoTypezap
app.post('/extensaoTypezap', async (req, res) => {
  const { token } = req.body;

  // Verifica se o token fornecido é válido
  if (token !== SECURITY_TOKEN) {
      return res.status(401).json({ status: 'falha', mensagem: 'Token inválido' });
  }

  try {
      // Obtém os registros do banco de dados
      const dbTriggers = listAllFromDBTypebotV2();
      
      // Responde com os registros obtidos
      res.status(200).json(dbTriggers);
  } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'falha', mensagem: 'Erro ao obter dados do banco de dados' });
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
            
            await sendAudioWithRetry(destinatario, media);            
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