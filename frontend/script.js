// AI Receptionist (voice-enabled)
// This script manages a state-driven conversation using the Web Speech API.

console.log('=== AI Receptionist Script Loading ===')

// Diagnostic function for troubleshooting
window.diagnoseSpeechRecognition = function() {
  console.log('=== SPEECH RECOGNITION DIAGNOSTICS ===')
  console.log('Browser Support:')
  console.log('  - window.SpeechRecognition:', !!window.SpeechRecognition)
  console.log('  - window.webkitSpeechRecognition:', !!window.webkitSpeechRecognition)
  console.log('  - window.speechSynthesis:', !!window.speechSynthesis)
  
  console.log('\nRecognition Object:')
  console.log('  - Exists:', !!recognition)
  if (recognition) {
    console.log('  - Continuous:', recognition.continuous)
    console.log('  - InterimResults:', recognition.interimResults)
    console.log('  - Language:', recognition.lang)
    console.log('  - MaxAlternatives:', recognition.maxAlternatives)
  }
  
  console.log('\nState:')
  console.log('  - Current State:', state)
  console.log('  - isListening:', isListening)
  console.log('  - isSpeaking:', isSpeaking)
  console.log('  - isProcessing:', isProcessing)
  console.log('  - shouldAutoRestart:', shouldAutoRestart)
  
  console.log('\nDOM Elements:')
  console.log('  - micButton:', !!micButton)
  console.log('  - resetButton:', !!resetButton)
  console.log('  - restartButton:', !!restartButton)
  console.log('  - chat:', !!chat)
  console.log('  - statusText:', !!statusText)
  console.log('  - listeningIndicator:', !!listeningIndicator)
  
  console.log('\nTo test microphone:')
  console.log('  1. Click the microphone button')
  console.log('  2. Say "Hello" or any phrase')
  console.log('  3. Check this console for transcript messages')
  console.log('  4. Verify microphone permissions are enabled in browser settings')
  
  return true
}
console.log('Type diagnoseSpeechRecognition() in console to debug issues')

const micButton = document.getElementById('mic')
const resetButton = document.getElementById('resetButton')
const restartButton = document.getElementById('restartButton')
const chat = document.getElementById('chat')
const statusText = document.getElementById('statusText')
const listeningIndicator = document.getElementById('listeningIndicator')

const bookingSection = document.getElementById('bookingSection')
const confirmNameEl = document.getElementById('confirmName')
const confirmIssueEl = document.getElementById('confirmIssue')
const confirmDateEl = document.getElementById('confirmDate')
const confirmTimeEl = document.getElementById('confirmTime')
const guidanceSection = document.getElementById('guidanceSection')

console.log('DOM elements found:',{
  micButton: !!micButton,
  resetButton: !!resetButton,
  chat: !!chat,
  statusText: !!statusText,
  listeningIndicator: !!listeningIndicator
})

const STATES = {
  START: 0,
  ASK_NAME: 1,
  CONFIRM_NAME: 1.5,
  ASK_ISSUE: 2,
  ASK_DATE: 3,
  ASK_TIME: 4,
  CONFIRM: 5
}

let state = STATES.START
let isProcessing = false
let isSpeaking = false
let isListening = false
let shouldAutoRestart = true
let recognition = null
let latestInterimTranscript = ''
let lastHandledTranscript = ''
let lastHandledAt = 0
const SUPPORTED_LANGUAGES = ['en-US', 'hi-IN', 'es-ES', 'fr-FR']

function resolveLanguagePreference() {
  const browserLanguage = (navigator.language || 'en-US').toLowerCase()
  const exact = SUPPORTED_LANGUAGES.find(l => l.toLowerCase() === browserLanguage)
  if (exact) return exact

  const base = browserLanguage.split('-')[0]
  const sameBase = SUPPORTED_LANGUAGES.find(l => l.toLowerCase().startsWith(base))
  return sameBase || 'en-US'
}

let language = resolveLanguagePreference()

const appointment = {
  name: '',
  issue: '',
  date: '',
  time: ''
}

// Simple schedule (can be replaced with server data)
const CLINIC_SCHEDULE = generateSchedule()

const TRANSLATIONS = {
  'en-US': {
    greeting: "Hello there! Welcome to Aahona's DentalClinic. I'm your virtual receptionist. What's your full name?",
    ask_name: "Can I have your full name please?",
    ask_issue: "Thanks, {name}. What issue are you experiencing today? Please describe it in one sentence.",
    ask_date: "Which date would you prefer? For example, say 'tomorrow', 'March 18', or just '18'.",
    ask_time: "What time works best for you on {date}? For example, say '2 PM' or '10:30 AM'.",
    confirm: "All set, {name}! Your appointment is booked for {date} at {time}. See you soon!",
    invalid_name: "I didn't quite get your name. Please say your full name so I can book your appointment.",
    invalid_issue: "Please describe your issue in one or two sentences so I can assist you properly.",
    invalid_date: "I couldn't understand that date. Please say something like 'tomorrow' or 'March 18'.",
    invalid_time: "I didn't catch the time. Please say a time like '2 PM' or '10:30 AM'.",
    no_input: "I didn't hear anything. Please try again when you're ready.",
    clarify: "Sorry, I didn't catch that. Please say it again.",
    listening: "Listening...",
    speaking: "Speaking...",
    processing: "Processing...",
    reset: "Okay, let's start over. Say hello when you're ready."
  },
  'hi-IN': {
    greeting: "नमस्ते! सैलाबाला डेंटल क्लिनिक में आपका स्वागत है। मैं आपका वर्चुअल रिसेप्शनिस्ट हूं। आपका पूरा नाम क्या है?",
    ask_name: "कृपया अपना पूरा नाम बताएं।",
    ask_issue: "धन्यवाद, {name}। आज आप किस समस्या का सामना कर रहे हैं? कृपया एक वाक्य में बताएं।",
    ask_date: "आपको कौन सी तारीख पसंद है? उदाहरण के लिए, 'कल', 'मार्च 18' या बस '18' कहें।",
    ask_time: "{date} को आपके लिए कौन सा समय सुविधाजनक है? उदाहरण के लिए, '2 PM' या '10:30 AM' कहें।",
    confirm: "बहुत अच्छा, {name}! आपकी अपॉइंटमेंट {date} को {time} पर बुक हो गई है। जल्द मिलेंगे!",
    invalid_name: "मुझे आपका नाम ठीक से समझ नहीं आया। कृपया अपना पूरा नाम बताएं।",
    invalid_issue: "कृपया अपनी समस्या को एक या दो वाक्यों में समझाएं।",
    invalid_date: "मुझे तारीख समझ नहीं आई। कृपया 'कल' या 'मार्च 18' जैसा कुछ कहें।",
    invalid_time: "मुझे समय समझ नहीं आया। कृपया '2 PM' या '10:30 AM' जैसा समय कहें।",
    no_input: "मुझे कुछ नहीं सुनाई दिया। कृपया दोबारा कोशिश करें।",
    clarify: "क्षमा करें, मुझे समझ नहीं आया। कृपया दोबारा कहें।",
    listening: "सुन रहा हूं...",
    speaking: "बोल रहा हूं...",
    processing: "प्रक्रिया जारी है...",
    reset: "ठीक है, फिर से शुरू करते हैं। जब आप तैयार हों तो कुछ कहें।"
  },
  'es-ES': {
    greeting: "¡Hola! Bienvenido a Aahona's DentalClinic. Soy tu recepcionista virtual. ¿Cuál es tu nombre completo?",
    ask_name: "¿Podrías decirme tu nombre completo, por favor?",
    ask_issue: "Gracias, {name}. ¿Qué problema tienes hoy? Por favor, descríbelo en una oración.",
    ask_date: "¿Qué fecha prefieres? Por ejemplo, di 'mañana', '18 de marzo', o solo '18'.",
    ask_time: "¿Qué hora te va bien el {date}? Por ejemplo, di '2 PM' o '10:30 AM'.",
    confirm: "¡Listo, {name}! Tu cita está reservada para {date} a las {time}. ¡Nos vemos pronto!",
    invalid_name: "No entendí bien tu nombre. Por favor, di tu nombre completo.",
    invalid_issue: "Por favor, describe tu problema en una o dos oraciones.",
    invalid_date: "No entendí la fecha. Por favor, di algo como 'mañana' o '18 de marzo'.",
    invalid_time: "No entendí la hora. Por favor, di una hora como '2 PM' o '10:30 AM'.",
    no_input: "No escuché nada. Por favor, intenta de nuevo.",
    clarify: "Disculpa, no entendí. Por favor, repite.",
    listening: "Escuchando...",
    speaking: "Hablando...",
    processing: "Procesando...",
    reset: "Está bien, empecemos de nuevo. Di algo cuando estés listo."
  },
  'fr-FR': {
    greeting: "Bonjour! Bienvenue à Aahona's DentalClinic. Je suis votre réceptionniste virtuelle. Quel est votre nom complet?",
    ask_name: "Pouvez-vous me donner votre nom complet, s'il vous plaît?",
    ask_issue: "Merci, {name}. Quel problème avez-vous aujourd'hui? Veuillez le décrire en une phrase.",
    ask_date: "Quelle date préférez-vous? Par exemple, dites 'demain', '18 mars', ou simplement '18'.",
    ask_time: "Quelle heure vous convient le {date}? Par exemple, dites '14h' ou '10h30'.",
    confirm: "Parfait, {name}! Votre rendez-vous est réservé pour {date} à {time}. À bientôt!",
    invalid_name: "Je n'ai pas bien compris votre nom. Veuillez dire votre nom complet.",
    invalid_issue: "Veuillez décrire votre problème en une ou deux phrases.",
    invalid_date: "Je n'ai pas compris la date. Veuillez dire quelque chose comme 'demain' ou '18 mars'.",
    invalid_time: "Je n'ai pas compris l'heure. Veuillez dire une heure comme '14h' ou '10h30'.",
    no_input: "Je n'ai rien entendu. Veuillez réessayer.",
    clarify: "Désolé, je n'ai pas compris. Veuillez répéter.",
    listening: "Écoute...",
    speaking: "Parle...",
    processing: "Traitement...",
    reset: "D'accord, recommençons. Dites quelque chose quand vous êtes prêt."
  }
}

function generateSchedule() {
  // Generate 7 days of schedule from today with a few time slots each day.
  const schedule = {}
  const times = ['09:00 AM', '10:30 AM', '01:00 PM', '03:00 PM', '04:30 PM']
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    schedule[`${yyyy}-${mm}-${dd}`] = [...times]
  }
  return schedule
}

function formatDate(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function updateStatus(text) {
  if (statusText) statusText.textContent = text
}

function showListeningIndicator(show) {
  if (!listeningIndicator) return
  listeningIndicator.style.display = show ? 'flex' : 'none'
}

function addMessage(sender, text) {
  if (!chat) return

  const msgDiv = document.createElement('div')
  msgDiv.className = sender === 'AI' ? 'message ai-message' : 'message user-message'
  msgDiv.innerHTML = `<span>${text}</span>`
  chat.appendChild(msgDiv)
  chat.scrollTop = chat.scrollHeight
}

function handleTranscriptOnce(text) {
  const cleaned = (text || '').trim()
  if (!cleaned) return

  const now = Date.now()
  if (cleaned === lastHandledTranscript && now - lastHandledAt < 2500) {
    return
  }

  lastHandledTranscript = cleaned
  lastHandledAt = now
  processTranscript(cleaned)
}

function finishSpeakingAndProcess() {
  if (!isListening) return

  updateStatus('Finished speaking. Processing...')
  showListeningIndicator(false)

  if (recognition) {
    try {
      recognition.stop()
    } catch (e) {
      console.warn('Could not stop recognition:', e)
    }
  }

  const fallbackTranscript = latestInterimTranscript.trim()
  if (fallbackTranscript && !isProcessing && !isSpeaking) {
    setTimeout(() => {
      handleTranscriptOnce(fallbackTranscript)
      latestInterimTranscript = ''
    }, 100)
  }
}

function speak(text) {
  if (isSpeaking) return
  
  // Check if TTS is available
  if (!window.speechSynthesis) {
    console.error('Speech Synthesis not supported in this browser')
    addMessage('AI', text)
    updateStatus('Speech synthesis not available')
    return
  }

  isSpeaking = true
  isListening = false
  updateStatus(TRANSLATIONS[language].speaking)
  showListeningIndicator(false)
  if (micButton) micButton.disabled = true

  // Stop any active recognition before speaking
  if (recognition && isListening) {
    try {
      recognition.stop()
    } catch (e) {
      console.warn('Could not stop recognition:', e)
    }
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = language
  utterance.rate = 1.0
  utterance.volume = 1.0
  utterance.pitch = 1.0

  utterance.onstart = () => {
    console.log('TTS started for:', text)
  }

  utterance.onend = () => {
    console.log('TTS ended')
    isSpeaking = false
    isProcessing = false
    if (micButton) micButton.disabled = false
    updateStatus(TRANSLATIONS[language].listening)
    showListeningIndicator(true)
    // Wait longer to ensure TTS completely finishes and microphone doesn't pick it up
    setTimeout(() => {
      if (!isSpeaking && !isProcessing && recognition) {
        startListening()
      }
    }, 350)
  }

  utterance.onerror = (e) => {
    console.error('TTS error:', e)
    isSpeaking = false
    isProcessing = false
    if (micButton) micButton.disabled = false
    updateStatus('Speech error: ' + e.error)
    showListeningIndicator(true)
    setTimeout(() => {
      if (!isSpeaking && !isProcessing && recognition) {
        startListening()
      }
    }, 350)
  }

  // Cancel any pending utterances
  window.speechSynthesis.cancel()
  // Apply voices if available
  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    const langMatch = voices.find(v => v.lang.startsWith(language.split('-')[0]))
    if (langMatch) utterance.voice = langMatch
  }
  
  try {
    window.speechSynthesis.speak(utterance)
    addMessage('AI', text)
    console.log('TTS speak called for:', text)
  } catch (e) {
    console.error('Could not speak:', e)
    isSpeaking = false
    isProcessing = false
    if (micButton) micButton.disabled = false
    addMessage('AI', text)
  }
}

function validateName(text) {
  const cleaned = text.trim()
  return cleaned.length > 2 && cleaned.split(' ').length >= 1
}

function validateIssue(text) {
  const cleaned = text.trim()
  return cleaned.length >= 4
}

function normalizeSpeechText(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractNameFromSpeech(text) {
  const cleaned = text.trim()
  const lowered = normalizeSpeechText(cleaned)
  const patterns = [
    /my name is\s+([a-zA-Z\s]{2,})/i,
    /i am\s+([a-zA-Z\s]{2,})/i,
    /this is\s+([a-zA-Z\s]{2,})/i,
    /name\s+([a-zA-Z\s]{2,})/i
  ]

  for (const p of patterns) {
    const match = lowered.match(p)
    if (match && match[1]) {
      return match[1].trim().replace(/\b\w/g, c => c.toUpperCase())
    }
  }

  return cleaned
}

function getIssueQuickAdvice(issueText) {
  const issue = issueText.toLowerCase()

  const quickAdviceByLanguage = {
    'en-US': {
      toothPain: 'Please avoid very hot or cold foods and rinse with warm salt water.',
      gumIssue: 'Please brush gently and rinse with warm salt water.',
      sensitivity: 'Please avoid very cold and sweet foods for now.',
      swelling: 'Please come early if swelling increases.',
      general: 'Please keep the area clean and avoid self-medication.'
    },
    'hi-IN': {
      toothPain: 'कृपया बहुत गरम या ठंडा भोजन न लें और गुनगुने नमक पानी से कुल्ला करें।',
      gumIssue: 'कृपया धीरे ब्रश करें और गुनगुने नमक पानी से कुल्ला करें।',
      sensitivity: 'फिलहाल बहुत ठंडा और मीठा भोजन न लें।',
      swelling: 'अगर सूजन बढ़े तो कृपया जल्दी आएं।',
      general: 'जगह साफ रखें और खुद से दवा लेने से बचें।'
    },
    'es-ES': {
      toothPain: 'Evite alimentos muy frios o calientes y enjuague con agua tibia y sal.',
      gumIssue: 'Cepille suavemente y enjuague con agua tibia y sal.',
      sensitivity: 'Evite alimentos muy frios y dulces por ahora.',
      swelling: 'Si aumenta la hinchazon, venga lo antes posible.',
      general: 'Mantenga la zona limpia y evite automedicarse.'
    },
    'fr-FR': {
      toothPain: 'Evitez les aliments tres chauds ou froids et rincez a l eau tiede salee.',
      gumIssue: 'Brossez doucement et rincez a l eau tiede salee.',
      sensitivity: 'Evitez les aliments tres froids et sucres pour le moment.',
      swelling: 'Si le gonflement augmente, venez le plus tot possible.',
      general: 'Gardez la zone propre et evitez l automedication.'
    }
  }

  const selected = quickAdviceByLanguage[language] || quickAdviceByLanguage['en-US']

  if (issue.includes('teeth ache') || issue.includes('toothache') || issue.includes('tooth ache') || issue.includes('tooth pain') || issue.includes('teeth pain')) return selected.toothPain
  if (issue.includes('gum') || issue.includes('bleed') || issue.includes('bleeding')) return selected.gumIssue
  if (issue.includes('sensitive') || issue.includes('sensitivity')) return selected.sensitivity
  if (issue.includes('swelling') || issue.includes('pus') || issue.includes('infection')) return selected.swelling
  return selected.general
}

function getIssueAdvice(issueText) {
  const issue = issueText.toLowerCase()

  const adviceByLanguage = {
    'en-US': {
      toothPain: 'For tooth pain, avoid very hot/cold foods, rinse with warm salt water, and do not place aspirin directly on the tooth. If swelling or fever starts, seek urgent dental care.',
      gumIssue: 'For gum discomfort, brush gently with a soft brush, floss carefully, and rinse with lukewarm salt water. If bleeding continues, please visit the clinic soon.',
      sensitivity: 'For sensitivity, avoid very cold or sweet foods and use a desensitizing toothpaste until your appointment.',
      swelling: 'Swelling or signs of infection can become serious. Please keep the area clean and come as early as possible for examination.',
      general: 'Please avoid self-medication and keep the area clean. We will examine you properly at your appointment.'
    },
    'hi-IN': {
      toothPain: 'दांत दर्द के लिए बहुत गरम या ठंडा भोजन न लें, गुनगुने नमक पानी से कुल्ला करें, और दांत पर सीधे दवा न रखें। सूजन या बुखार हो तो तुरंत दंत चिकित्सक से मिलें।',
      gumIssue: 'मसूड़ों की तकलीफ में नरम ब्रश से धीरे ब्रश करें, सावधानी से फ्लॉस करें, और गुनगुने नमक पानी से कुल्ला करें। खून जारी रहे तो जल्द क्लिनिक आएं।',
      sensitivity: 'संवेदनशीलता के लिए बहुत ठंडा या मीठा भोजन न लें और अपॉइंटमेंट तक डीसेंसिटाइजिंग टूथपेस्ट का उपयोग करें।',
      swelling: 'सूजन या संक्रमण के लक्षण गंभीर हो सकते हैं। कृपया जगह साफ रखें और जल्दी से जांच के लिए आएं।',
      general: 'कृपया खुद से दवा न लें और प्रभावित जगह साफ रखें। अपॉइंटमेंट पर हम सही जांच करेंगे।'
    },
    'es-ES': {
      toothPain: 'Para dolor de dientes, evite comidas muy frías o calientes, enjuague con agua tibia y sal, y no coloque aspirina directamente sobre el diente. Si hay fiebre o hinchazón, busque atención dental urgente.',
      gumIssue: 'Para molestias en las encías, cepille suavemente con un cepillo blando, use hilo dental con cuidado y enjuague con agua tibia con sal. Si el sangrado continúa, visite la clínica pronto.',
      sensitivity: 'Para sensibilidad, evite comidas muy frías o dulces y use una pasta dental desensibilizante hasta su cita.',
      swelling: 'La hinchazón o signos de infección pueden ser serios. Mantenga la zona limpia y venga lo antes posible para evaluación.',
      general: 'Evite automedicarse y mantenga la zona limpia. Le haremos una evaluación completa en su cita.'
    },
    'fr-FR': {
      toothPain: 'En cas de douleur dentaire, évitez les aliments très chauds ou froids, rincez avec de l\'eau tiède salée, et ne mettez pas d\'aspirine directement sur la dent. En cas de fièvre ou de gonflement, consultez en urgence.',
      gumIssue: 'Pour la gêne des gencives, brossez doucement avec une brosse souple, passez le fil dentaire avec précaution et rincez à l\'eau tiède salée. Si le saignement continue, venez rapidement à la clinique.',
      sensitivity: 'Pour la sensibilité, évitez les aliments très froids ou sucrés et utilisez un dentifrice désensibilisant jusqu\'au rendez-vous.',
      swelling: 'Le gonflement ou les signes d\'infection peuvent être graves. Gardez la zone propre et venez dès que possible pour un examen.',
      general: 'Évitez l\'automédication et gardez la zone propre. Nous ferons un examen complet lors du rendez-vous.'
    }
  }

  const selectedAdvice = adviceByLanguage[language] || adviceByLanguage['en-US']

  if (issue.includes('teeth ache') || issue.includes('toothache') || issue.includes('tooth ache') || issue.includes('tooth pain') || issue.includes('teeth pain')) {
    return selectedAdvice.toothPain
  }
  if (issue.includes('gum') || issue.includes('bleed') || issue.includes('bleeding')) {
    return selectedAdvice.gumIssue
  }
  if (issue.includes('sensitive') || issue.includes('sensitivity')) {
    return selectedAdvice.sensitivity
  }
  if (issue.includes('swelling') || issue.includes('pus') || issue.includes('infection')) {
    return selectedAdvice.swelling
  }

  return selectedAdvice.general
}

function getIssueAcknowledgement(issueText) {
  const acknowledgeByLanguage = {
    'en-US': `Noted. You said: ${issueText}.`,
    'hi-IN': `ठीक है। आपने कहा: ${issueText}.`,
    'es-ES': `Entendido. Usted dijo: ${issueText}.`,
    'fr-FR': `D'accord. Vous avez dit: ${issueText}.`
  }

  return acknowledgeByLanguage[language] || acknowledgeByLanguage['en-US']
}

function parseDate(text) {
  const normalized = text.toLowerCase().trim()

  if (normalized.includes('tomorrow')) {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return formatDate(d)
  }
  if (normalized.includes('today')) {
    return formatDate(new Date())
  }

  const monthDayMatch = normalized.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/)
  if (monthDayMatch) {
    const monthNames = {
      january: 0, february: 1, march: 2, april: 3,
      may: 4, june: 5, july: 6, august: 7,
      september: 8, october: 9, november: 10, december: 11
    }
    const month = monthNames[monthDayMatch[1]]
    const day = Number(monthDayMatch[2])
    const now = new Date()
    let year = now.getFullYear()
    let date = new Date(year, month, day)
    // If date is already past, roll forward to next year.
    if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      year += 1
      date = new Date(year, month, day)
    }
    if (!isNaN(date)) return formatDate(date)
  }

  const dayMatch = normalized.match(/\b(\d{1,2})\b/)
  if (dayMatch) {
    const day = Number(dayMatch[1])
    const now = new Date()
    let date = new Date(now.getFullYear(), now.getMonth(), day)
    // If day has already passed this month, roll to next month.
    if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      date = new Date(now.getFullYear(), now.getMonth() + 1, day)
    }
    if (!isNaN(date)) return formatDate(date)
  }

  return null
}

function parseTime(text) {
  const normalized = text.toLowerCase().trim()
  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (!match) return null

  let hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  const ampm = match[3]

  if (ampm) {
    if (ampm === 'pm' && hour < 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatDateNice(dateStr) {
  // dateStr is in YYYY-MM-DD format
  const [year, month, day] = dateStr.split('-')
  const date = new Date(year, month - 1, day)
  const monthName = date.toLocaleString('en-US', { month: 'long' })
  const dayName = date.toLocaleString('en-US', { weekday: 'long' })
  return `${dayName}, ${monthName} ${parseInt(day)}`
}

function formatTime(timeStr) {
  // timeStr is in HH:MM format
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours)
  const m = parseInt(minutes)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayHour = h % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

async function checkTimeAvailability(date, time) {
  try {
    const response = await fetch('/schedule/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time })
    })
    const data = await response.json()
    return data.available || false
  } catch (error) {
    console.error('Error checking availability:', error)
    return false
  }
}

async function getUpcomingAvailability(days = 30, maxDates = 5) {
  try {
    const response = await fetch(`/schedule/available?days=${days}&maxDates=${maxDates}`)
    if (!response.ok) throw new Error('Failed to fetch availability')
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching availability:', error)
    return { bookingWindowDays: 90, available: [] }
  }
}

async function getDateAvailableSlots(date) {
  try {
    const response = await fetch(`/schedule/available/${date}`)
    if (!response.ok) throw new Error('Failed to fetch date availability')
    const data = await response.json()
    return data.slots || []
  } catch (error) {
    console.error('Error fetching date availability:', error)
    return []
  }
}

function buildAvailabilityMessage(availabilityData) {
  const available = availabilityData.available || []
  const bookingWindowDays = availabilityData.bookingWindowDays || 90

  if (!available.length) {
    return `I could not find open slots right now. Our booking window is the next ${bookingWindowDays} days. Please try another date.`
  }

  const lines = available.map(day => {
    const topSlots = day.slots.slice(0, 3).map(formatTime).join(', ')
    return `${formatDateNice(day.date)}: ${topSlots}`
  })

  return `Here are the next available options. ${lines.join('. ')}. Please choose a date from these.`
}

async function bookAppointment() {
  try {
    const response = await fetch('/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment)
    })
    
    if (!response.ok) throw new Error('Failed to book appointment')
    const result = await response.json()
    
    // Also track the patient
    await fetch('/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: appointment.name })
    }).catch(err => console.warn('Patient tracking failed:', err))
    
    return true
  } catch (error) {
    console.error('Error booking appointment:', error)
    return false
  }
}

function generateCalendarEvent() {
  // Convert date and time to proper format for .ics file
  const [year, month, day] = appointment.date.split('-')
  const [hour, minute] = appointment.time.split(':')
  
  const startDateTime = `${year}${month}${day}T${hour}${minute}00`
  const endDateTime = `${year}${month}${day}T${String(parseInt(hour)+1).padStart(2, '0')}${minute}00`
  
  const now = new Date()
  const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}00Z`
  
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Aahona's DentalClinic//AI Receptionist//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:${startDateTime}
DTEND:${endDateTime}
DTSTAMP:${timestamp}
UID:${timestamp}@aahonas-dentalclinic
CREATED:${timestamp}
DESCRIPTION:Dental appointment for ${appointment.issue}
LAST-MODIFIED:${timestamp}
LOCATION:Aahona's DentalClinic
SEQUENCE:0
STATUS:CONFIRMED
SUMMARY:Dental Appointment - ${appointment.name}
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR`
  
  return icsContent
}

function downloadCalendarEvent() {
  try {
    const icsContent = generateCalendarEvent()
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `appointment-${appointment.date}-${appointment.time.replace(':', '')}.ics`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    const msg = language === 'en-US'
      ? 'Calendar event downloaded successfully!'
      : language === 'hi-IN'
      ? 'कैलेंडर इवेंट सफलतापूर्वक डाउनलोड हो गया!'
      : language === 'es-ES'
      ? '¡Evento de calendario descargado exitosamente!'
      : 'Événement de calendrier téléchargé avec succès!'
    speak(msg)
  } catch (error) {
    console.error('Error downloading calendar:', error)
    speak('Sorry, there was an error downloading the calendar event.')
  }
}

function showConfirmation() {
  if (!bookingSection) return
  bookingSection.style.display = 'block'
  confirmNameEl.textContent = appointment.name
  confirmIssueEl.textContent = appointment.issue
  confirmDateEl.textContent = appointment.date
  confirmTimeEl.textContent = appointment.time
  guidanceSection.textContent = getIssueAdvice(appointment.issue)
}

function resetConversation() {
  console.log('Resetting conversation...')
  
  // Stop any ongoing speech or listening
  if (recognition) {
    try {
      recognition.stop()
    } catch (e) {}
  }
  
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
  
  state = STATES.START
  appointment.name = ''
  appointment.issue = ''
  appointment.date = ''
  appointment.time = ''
  isProcessing = false
  isSpeaking = false
  isListening = false
  shouldAutoRestart = true

  if (bookingSection) bookingSection.style.display = 'none'
  
  // Clear chat and show welcome message
  const chatDiv = document.getElementById('chat')
  if (chatDiv) {
    chatDiv.innerHTML = '<div class="message ai-message"><span>Welcome back! Click the microphone to continue.</span></div>'
  }
  
  updateStatus(TRANSLATIONS[language].reset)
  
  // Trigger greeting only if user clicks button
  console.log('Ready for user to click button')
  if (micButton) {
    micButton.disabled = false
    micButton.textContent = '🎤 Start'
  }
}

function processTranscript(transcript) {
  if (!transcript || isProcessing) return
  isProcessing = true

  const trimmed = transcript.trim()
  addMessage('You', trimmed)

  const lower = trimmed.toLowerCase()
  if (lower.includes('reset') || lower.includes('restart')) {
    resetConversation()
    isProcessing = false
    return
  }

  switch (state) {
    case STATES.START:
      // First, give the greeting
      speak(TRANSLATIONS[language].greeting)
      state = STATES.ASK_NAME
      break

    case STATES.ASK_NAME:
      {
      const extractedName = extractNameFromSpeech(trimmed)
      if (!validateName(extractedName)) {
        speak(TRANSLATIONS[language].invalid_name)
        isProcessing = false
        return
      }
      appointment.name = extractedName
      const confirmMsg = language === 'en-US' 
        ? `Did I hear your name correctly as ${appointment.name}? Please say yes or no.`
        : language === 'hi-IN'
        ? `क्या मैंने आपका नाम सही सुना ${appointment.name}? कृपया हां या नहीं कहें।`
        : language === 'es-ES'
        ? `¿Escuché correctamente tu nombre como ${appointment.name}? Por favor, di sí o no.`
        : `Avez-vous dit ${appointment.name}? Veuillez dire oui ou non.`
      speak(confirmMsg)
      state = STATES.CONFIRM_NAME
      isProcessing = false
      break
      }

    case STATES.CONFIRM_NAME: {
      const response = trimmed.toLowerCase()
      const isAffirmative = response.match(/^(yes|yeah|yup|correct|right|absolutely|ok|okay|da|ha|ji|bilkul|sí|si|oui)/i)
      const isNegative = response.match(/^(no|nope|wrong|incorrect|nahi|no|non)/i)
      
      if (isAffirmative) {
        speak(TRANSLATIONS[language].ask_issue.replace('{name}', appointment.name))
        state = STATES.ASK_ISSUE
        isProcessing = false
      } else if (isNegative) {
        speak(TRANSLATIONS[language].invalid_name)
        state = STATES.ASK_NAME
        isProcessing = false
      } else {
        const clarifyMsg = language === 'en-US'
          ? 'Please say yes or no.'
          : language === 'hi-IN'
          ? 'कृपया हां या नहीं कहें।'
          : language === 'es-ES'
          ? 'Por favor, di sí o no.'
          : 'Veuillez dire oui ou non.'
        speak(clarifyMsg)
        isProcessing = false
      }
      break
    }

    case STATES.ASK_ISSUE:
      if (!validateIssue(trimmed)) {
        speak(TRANSLATIONS[language].invalid_issue)
        isProcessing = false
        return
      }
      appointment.issue = trimmed
      speak(`${getIssueAcknowledgement(appointment.issue)} ${getIssueQuickAdvice(appointment.issue)} ${TRANSLATIONS[language].ask_date}`)
      state = STATES.ASK_DATE
      isProcessing = false
      break

    case STATES.ASK_DATE: {
      const askingForAvailability = /(available|slot|slots|when.*slot|when.*available|free|open)/i.test(trimmed)
      if (askingForAvailability) {
        getUpcomingAvailability(45, 5).then(data => {
          speak(buildAvailabilityMessage(data))
          isProcessing = false
        })
        break
      }

      const parsedDate = parseDate(trimmed)
      if (!parsedDate) {
        speak(TRANSLATIONS[language].invalid_date)
        isProcessing = false
        return
      }
      // Check if date has any available slots
      getDateAvailableSlots(parsedDate).then(slots => {
        if (!slots.length) {
          getUpcomingAvailability(45, 5).then(data => {
            const reasonMsg = `We do not have slots on ${formatDateNice(parsedDate)}. You can book within the next ${data.bookingWindowDays || 90} days.`
            const optionsMsg = buildAvailabilityMessage(data)
            speak(`${reasonMsg} ${optionsMsg}`)
            isProcessing = false
          })
          return
        }
        appointment.date = parsedDate
        speak(TRANSLATIONS[language].ask_time.replace('{date}', formatDateNice(appointment.date)))
        state = STATES.ASK_TIME
        isProcessing = false
      })
      break
    }

    case STATES.ASK_TIME: {
      const parsedTime = parseTime(trimmed)
      if (!parsedTime) {
        speak(TRANSLATIONS[language].invalid_time)
        isProcessing = false
        return
      }
      // Check availability with server
      checkTimeAvailability(appointment.date, parsedTime).then(available => {
        if (!available) {
          const noTimeMsg = language === 'en-US'
            ? `The time ${formatTime(parsedTime)} is not available. Please try another time.`
            : language === 'hi-IN'
            ? `${formatTime(parsedTime)} का समय उपलब्ध नहीं है। कृपया दूसरा समय चुनें।`
            : language === 'es-ES'
            ? `La hora ${formatTime(parsedTime)} no está disponible. Por favor, intenta otra hora.`
            : `L'heure ${formatTime(parsedTime)} n'est pas disponible. Veuillez essayer une autre heure.`
          speak(noTimeMsg)
          isProcessing = false
          return
        }
        appointment.time = parsedTime
        bookAppointment().then(booked => {
          if (booked) {
            speak(TRANSLATIONS[language].confirm
              .replace('{name}', appointment.name)
              .replace('{date}', formatDateNice(appointment.date))
              .replace('{time}', formatTime(appointment.time)))
            state = STATES.CONFIRM
            showConfirmation()
          } else {
            speak('Sorry, there was an error booking your appointment. Please try again.')
          }
          isProcessing = false
        })
      })
      break
    }

    case STATES.CONFIRM:
      speak("Your appointment is already booked. If you'd like to make another booking, press the restart button.")
      isProcessing = false
      break

    default:
      speak(TRANSLATIONS[language].clarify)
      isProcessing = false
      break
  }
}

function setupRecognition() {
  console.log('Setting up speech recognition...')
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  
  if (!SpeechRecognition) {
    console.error('Speech Recognition not supported in this browser')
    updateStatus('⚠️ Speech recognition not supported. Use Chrome, Edge, or Safari.')
    if (micButton) {
      micButton.disabled = true
      micButton.textContent = '❌ Not Supported'
    }
    return
  }

  try {
    recognition = new SpeechRecognition()
    console.log('SpeechRecognition object created:', recognition)
    
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 3
    recognition.lang = language
    
    console.log('Recognition configured for language:', language)
  } catch (e) {
    console.error('Error creating SpeechRecognition:', e)
    updateStatus('⚠️ Error initializing speech recognition: ' + e.message)
    return
  }

  recognition.onstart = () => {
    console.log('Recognition started')
    isListening = true
    showListeningIndicator(true)
    updateStatus('Start speaking now...')
    if (micButton) {
      micButton.textContent = '🎤 Finish Speaking'
      micButton.disabled = false
    }
  }

  recognition.onend = () => {
    console.log('Recognition ended. State - isSpeaking:', isSpeaking, 'isProcessing:', isProcessing, 'shouldAutoRestart:', shouldAutoRestart)
    isListening = false
    showListeningIndicator(false)
    if (micButton) {
      micButton.textContent = '🎤 Start Speaking'
      micButton.disabled = false
    }
    
    // Auto-restart if we're waiting for input and not in the middle of processing
    if (shouldAutoRestart && !isSpeaking && !isProcessing && state !== STATES.CONFIRM) {
      console.log('Auto-restarting listening on onend...')
      setTimeout(() => {
        if (!isSpeaking && !isProcessing && shouldAutoRestart && recognition) {
          try {
            startListening()
          } catch (e) {
            console.warn('Could not restart listening:', e)
          }
        }
      }, 500)
    }
  }

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error)
    isListening = false
    showListeningIndicator(false)
    
    // Show user-friendly error messages
    if (event.error === 'network') {
      updateStatus('🌐 Network error. Check your internet connection.')
      speak('Network error. Please check your internet connection and try again.')
    } else if (event.error === 'audio-capture') {
      updateStatus('🎤 Microphone not available. Check permissions.')
      speak('I cannot access your microphone. Please check browser permissions and try again.')
    } else if (event.error === 'service-not-available') {
      updateStatus('⚠️ Speech recognition service unavailable.')
      speak('Speech recognition service is unavailable right now. Please try again later.')
    } else if (event.error === 'no-speech') {
      console.log('No speech detected in this attempt - restarting...')
      updateStatus('🤐 No speech detected. Please speak clearly and try again.')
      // Auto-restart listening after no-speech
      if (shouldAutoRestart && !isSpeaking && !isProcessing) {
        setTimeout(() => {
          console.log('Re-starting listening after no-speech timeout')
          startListening()
        }, 800)
      }
    } else if (event.error === 'aborted') {
      // Normal abort - don't show error
      console.log('Recognition aborted normally')
    } else if (event.error === 'not-allowed') {
      updateStatus('🔒 Microphone permission denied. Please allow microphone access.')
      speak('Microphone permission was denied. Please refresh the page and allow microphone access.')
      shouldAutoRestart = false
    } else {
      updateStatus('⚠️ Error: ' + event.error)
      speak('Error: ' + event.error)
    }
    
    // Auto-restart on recoverable errors only
    if (event.error !== 'aborted' && event.error !== 'no-speech' && event.error !== 'not-allowed' && shouldAutoRestart) {
      setTimeout(() => {
        if (!isSpeaking && !isProcessing && shouldAutoRestart && recognition) {
          try {
            console.log('Auto-restarting after error...')
            startListening()
          } catch (e) {
            console.warn('Could not restart listening:', e)
          }
        }
      }, 500)
    }
  }

  recognition.onresult = (event) => {
    if (!event.results || event.results.length === 0) {
      console.log('onresult called but no results')
      return
    }
    
    // Show interim results to user
    let interimTranscript = ''
    let finalTranscript = ''
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const speechResult = event.results[i]
      const transcript = (speechResult[0] && speechResult[0].transcript ? speechResult[0].transcript : '').trim()
      if (!transcript) continue

      if (speechResult.isFinal) {
        finalTranscript += transcript + ' '
        console.log('Final result:', transcript)
      } else {
        interimTranscript += transcript + ' '
        console.log('Interim result:', transcript)
      }
    }
    
    // Show interim speech to user (optional visual feedback)
    if (interimTranscript && !finalTranscript) {
      latestInterimTranscript = interimTranscript.trim()
      updateStatus(`Hearing: "${interimTranscript}"`)
    }

    // Process only final results
    if (finalTranscript.trim()) {
      const transcript = finalTranscript.trim()
      latestInterimTranscript = ''
      console.log('Processing final transcript:', transcript)
      
      // Stop listening before processing
      if (recognition) {
        try {
          recognition.stop()
        } catch (e) {
          console.warn('Error stopping recognition:', e)
        }
      }
      
      isListening = false
      showListeningIndicator(false)
      
      // Delay to ensure TTS has finished before processing
      setTimeout(() => {
        if (!isSpeaking) {
          handleTranscriptOnce(transcript)
        }
      }, 120)
    }
  }
}

function startListening() {
  if (!recognition) {
    console.error('Recognition not initialized')
    updateStatus('Speech recognition not available')
    return
  }
  
  if (isSpeaking || isListening || isProcessing) {
    console.warn('Cannot start listening - already in progress. isSpeaking:', isSpeaking, 'isListening:', isListening, 'isProcessing:', isProcessing)
    return
  }
  
  try {
    console.log('Starting recognition with language:', language)
    recognition.lang = language
    latestInterimTranscript = ''
    recognition.start()
    // Note: isListening flag is set in recognition.onstart event
  } catch (e) {
    if (e.name === 'InvalidStateError') {
      // Already listening, just log it
      console.log('Recognition already started:', e.message)
      isListening = true
    } else {
      console.error('Error starting recognition:', e)
      updateStatus('Could not start listening: ' + e.message)
      isListening = false
      showListeningIndicator(false)
    }
  }
}

function init() {
  console.log('Initializing AI Receptionist...')
  
  // Check if speech APIs are available
  if (!window.speechSynthesis) {
    console.error('Speech Synthesis not supported')
    updateStatus('Speech synthesis not supported')
  }
  
  // Setup the microphone button
  if (micButton) {
    micButton.onclick = () => {
      console.log('Mic button clicked. Current state:', {
        isListening,
        isSpeaking,
        isProcessing,
        state: state,
        recognitionExists: !!recognition
      })
      
      if (isListening) {
        console.log('Finishing speaking and processing...')
        finishSpeakingAndProcess()
      } else {
        console.log('Starting listening...')
        
        // If this is the START state (first interaction), play greeting immediately
        if (state === STATES.START && !isSpeaking) {
          console.log('First interaction detected - playing greeting immediately')
          state = STATES.ASK_NAME
          speak(TRANSLATIONS[language].greeting)
        } else {
          startListening()
        }
      }
    }
  }

  // Setup reset button
  if (resetButton) {
    resetButton.onclick = () => {
      console.log('Reset button clicked')
      resetConversation()
    }
  }

  // Setup restart button
  if (restartButton) {
    restartButton.onclick = () => {
      console.log('Restart button clicked')
      resetConversation()
    }
  }

  // Setup calendar download button
  const downloadCalendarBtn = document.getElementById('downloadCalendar')
  if (downloadCalendarBtn) {
    downloadCalendarBtn.onclick = () => {
      console.log('Download calendar clicked')
      downloadCalendarEvent()
    }
  }

  // Load available voices when available
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      console.log('Voices changed, available voices:', window.speechSynthesis.getVoices().length)
    }
  }

  // Initialize speech recognition
  setupRecognition()
  
  // Set initial status - user must click button to start
  updateStatus('Ready. Click the microphone button to start speaking.')
  addMessage('AI', '👋 Welcome! I am your AI Receptionist for Aahona\'s DentalClinic. Please click the 🎤 microphone button below to begin your appointment booking. Make sure your microphone is enabled.')
  if (micButton) micButton.textContent = '🎤 Start Speaking'
  
  console.log('Initialization complete. Waiting for user interaction...')
  console.log('Speech Recognition API available:', !!recognition)
}

// Wait for DOM to be fully loaded before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...')
    init()
  })
} else {
  console.log('DOM already loaded, initializing...')
  init()
}
