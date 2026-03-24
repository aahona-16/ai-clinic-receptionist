# AI Clinic Receptionist - Project Analysis & Findings

**Date**: March 25, 2026  
**Project Location**: `c:\Users\KIIT0001\Desktop\ai-clinic-receptionist`

---

## 1. PROJECT STRUCTURE & ARCHITECTURE

### 📁 Directory Layout
```
ai-clinic-receptionist/
├── backend/
│   ├── server.js                    (Main Express server)
│   ├── routes/
│   │   ├── appointments.js          (POST/GET appointments)
│   │   ├── patients.js              (POST/GET patient tracking)
│   │   └── schedule.js              (Check slot availability)
│   └── database/
│       ├── appointments.json        (Booked appointments)
│       ├── patients.json            (Patient visit history)
│       ├── doctorSchedule.json      (Available time slots)
│       └── schedule.json            (Backup schedule file)
├── frontend/
│   ├── index.html                   (Patient booking UI)
│   ├── admin.html                   (Admin dashboard)
│   ├── script.js                    (Web Speech API voice logic)
│   ├── admin.js                     (Admin dashboard logic)
│   ├── app.js                       (Additional app logic)
│   ├── assistant.js                 (Assistant helper functions)
│   ├── style.css                    (Patient portal styling)
│   ├── admin-style.css              (Admin dashboard styling)
│   ├── receptionist.html            (Alternative receptionist view)
│   ├── dashboard.html               (Dashboard view)
│   ├── pricing.html                 (Pricing information)
│   └── index.html                   (Bookings)
├── package.json                     (Node.js dependencies)
├── FIXES_APPLIED.md                 (Previous bug fixes)
└── README.md                        (Project documentation)
```

### 🔧 Technology Stack
- **Backend**: Express.js 4.18.2, CORS, Body-Parser
- **Frontend**: Vanilla JavaScript + Web Speech API
- **Database**: JSON files (no SQL database)
- **Speech**: Browser-native Web Speech API (Chrome, Edge, Firefox)
- **Text-to-Speech**: Window.speechSynthesis API
- **Speech-to-Text**: Window.SpeechRecognition API

---

## 2. SPEECH RECOGNITION & "HEARING" FUNCTIONALITY

### 📍 Location: `frontend/script.js`

#### **Speech-to-Text Implementation**
- **Function**: `setupRecognition()` (line ~785)
- **API Used**: `window.SpeechRecognition` or `window.webkitSpeechRecognition`
- **Supported Languages**: `en-US`, `hi-IN`, `es-ES`, `fr-FR`
- **Settings**:
  ```javascript
  recognition.continuous = true           // Keeps listening
  recognition.interimResults = true       // Shows interim text
  recognition.maxAlternatives = 3         // Returns 3 alternatives
  recognition.lang = language             // Dynamic language
  ```

#### **Text-to-Speech Implementation**
- **Function**: `speak()` (line ~196)
- **API Used**: `window.speechSynthesis` with `SpeechSynthesisUtterance`
- **Features**:
  - Language-specific voice selection
  - Rate: 1.0 (normal speed)
  - Volume: 1.0 (max)
  - Pitch: 1.0 (normal)
  - Auto-restart listening after speaking

#### **Audio Processing Pipeline**
1. User clicks mic button → `startListening()`
2. Browser captures audio → `recognition.onresult()` triggered
3. Transcript extracted → `processTranscript()`
4. AI responds → `speak(text)`
5. After speech ends → `recognition.start()` again

### **CRITICAL: Name Hearing & Processing**

#### **Function**: `extractNameFromSpeech()` (line ~292)

```javascript
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
```

**Issues Found**:
1. **Pattern Matching**: User must say "my name is", "i am", "this is", or "name" prefix
   - Direct name utterance like "John Smith" will just return `cleaned` (original case preserved)
   - But if patterns don't match, returns the full trimmed input as-is

2. **Capitalization**: Uses `.replace(/\b\w/g, c => c.toUpperCase())` to capitalize first letter of each word
   - Only applied if regex patterns match
   - If patterns don't match, uses original spoken case

3. **Data Flow**:
   ```
   Spoken: "my name is Ahona Mukhopadhyay"
   → normalizeSpeechText() → "my name is ahona mukhopadhyay"
   → Pattern match found → Captures "ahona mukhopadhyay"
   → Capitalize each word → "Ahona Mukhopadhyay"
   → Stored in appointment.name
   ```

#### **Validation Function**: `validateName()` (line ~280)
```javascript
function validateName(text) {
  const cleaned = text.trim()
  return cleaned.length > 2 && cleaned.split(' ').length >= 1
}
```
**Issues**: 
- Accepts single word names (minimum 1 word)
- Requirements: length > 2 chars, any number of words
- Too permissive, allows unclear names like "abc"

---

## 3. APPOINTMENT SCHEDULING LOGIC & DATE HANDLING

### 📍 Location: `frontend/script.js` & `backend/routes/schedule.js`

### **State Machine** (Conversation Flow)
```javascript
STATES = {
  START (-1):    User greets
  ASK_NAME (1):  Collect name
  ASK_ISSUE (2): Collect medical issue
  ASK_DATE (3):  Collect appointment date
  ASK_TIME (4):  Collect appointment time
  CONFIRM (5):   Show confirmation
}
```

### **Date Parsing Issue** ⚠️

#### **Function**: `parseDate()` (line ~455)

```javascript
function parseDate(text) {
  const normalized = text.toLowerCase().trim()

  // ✅ WORKS: "tomorrow"
  if (normalized.includes('tomorrow')) {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return formatDate(d)
  }

  // ✅ WORKS: "today"
  if (normalized.includes('today')) {
    return formatDate(new Date())
  }

  // ✅ WORKS: "March 18" or "march 18"
  const monthDayMatch = normalized.match(/(january|february|...|december)\s+(\d{1,2})/)
  if (monthDayMatch) {
    // Checks if date already passed this month, rolls to next year
    const now = new Date()
    let year = now.getFullYear()
    let date = new Date(year, month, day)
    if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      year += 1
      date = new Date(year, month, day)
    }
    return formatDate(date)
  }

  // ⚠️ ISSUE: Just "18" or "25"
  const dayMatch = normalized.match(/\b(\d{1,2})\b/)
  if (dayMatch) {
    const day = Number(dayMatch[1])
    const now = new Date()
    let date = new Date(now.getFullYear(), now.getMonth(), day)
    
    // Problem: Uses 'new Date()' which IS current date
    if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      date = new Date(now.getFullYear(), now.getMonth() + 1, day)
    }
    return formatDate(date)
  }

  return null
}
```

**GOOD News**: 
- ✅ Already uses `new Date()` for current date (NOT "passed date" as mentioned)
- ✅ Correctly handles day overflow to next month
- ✅ Correctly handles year overflow for past months

**BUT**: The FIXES_APPLIED.md suggests there WAS a "passed date" issue that may have been fixed.

### **Date Formatting Function**
```javascript
function formatDate(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
```
✅ **CORRECT**: Uses 1-indexed months (+ 1), zero-padded format

### **Time Parsing**

#### **Function**: `parseTime()` (line ~499)

```javascript
function parseTime(text) {
  const normalized = text.toLowerCase().trim()
  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (!match) return null

  let hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  const ampm = match[3]

  // Convert 12-hour to 24-hour
  if (ampm) {
    if (ampm === 'pm' && hour < 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
```

**Examples**:
- Input: "2 PM" → Output: "14:00" ✅
- Input: "10:30 AM" → Output: "10:30" ✅
- Input: "2 pm" → Output: "14:00" ✅
- Input: "12 AM" → Output: "00:00" ✅
- Input: "12 PM" → Output: "12:00" ✅

---

## 4. CALENDAR FUNCTIONALITY

### 📍 Location: `frontend/index.html` (line 69-70)

### **Current Status**: ❌ NOT IMPLEMENTED

```html
<div class="calendar-action">
  <button id="downloadCalendar" class="calendar-button">📅 Add to Calendar</button>
</div>
```

### **What's Missing**:
1. ✅ Button exists in HTML
2. ✅ CSS styling exists
3. ❌ **NO event listener** in `script.js`
4. ❌ **NO iCalendar generation** function
5. ❌ **NO download functionality**

### **What Could Be Done**:
To implement calendar export, would need:
- Generate `.ics` (iCalendar format) file
- Create download link
- Add event listener to `downloadCalendar` button
- Include appointment details (name, date, time, description)

**Example .ics format needed**:
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Aahona's DentalClinic//AI Receptionist//EN
BEGIN:VEVENT
UID:appointment-{date}-{time}@aahonas-dentalclinic
DTSTAMP:20260325T000000Z
DTSTART:20260325T140000Z
SUMMARY:Dental Appointment - {name}
DESCRIPTION:Issue: {issue}
LOCATION:Aahona's DentalClinic
END:VEVENT
END:VCALENDAR
```

---

## 5. SPELLING ERRORS IN NAME PROCESSING

### 📍 Location: `backend/database/appointments.json`

### **Documented Spelling Issues**:

| Name | Issue | Likely Cause |
|------|-------|--------------|
| `"ajona"` | Misspelled/incomplete | Weak speech recognition |
| `"ahona"` | Misspelled variant | Speech confusion |
| `"Ahona Mukhopadhyay."` | Period at end, correct name | User said "Ahona Mukhopadhyay" with pause |
| `"Avona mukka paathiyaa."` | **SEVERE**: Completely wrong name | Strong speech recognition error or user accent |

### **Breakdown of "Avona mukka paathiyaa"**:

Likely scenarios:
1. **Speech Recognition Error**: Browser misheard "Ahona Mukhopadhyay" as "Avona mukka paathiyaa"
2. **Regional Accent**: Accent difference caused SpeechRecognition API to misinterpret
3. **Microphone Quality**: Poor audio quality led to misheard phonemes
4. **API Limitation**: Browser's Speech Recognition not trained on Indian/Bengali names

### **Root Cause Analysis**:

The `extractNameFromSpeech()` function returns what the Speech API provides:
```javascript
// If user says: "Ahona Mukhopadhyay" (with accent or noise)
// Browser API returns: "Avona mukka paathiyaa" ← Wrong!
// Function capitalizes: "Avona Mukka Paathiyaa" ← Still wrong
// Stored in DB as-is
```

**The problem is NOT in the code logic, but in:**
1. Browser's Speech Recognition quality
2. Phoneme similarity (Ahona → Avona)
3. Lack of name dictionary/validation
4. No user confirmation before storage

### **Patients Database Evidence**
```json
[
  {
    "name": "Ahona Mukhopadhyay.",  ← Correct but with period
    "visits": 1,
    "lastVisit": "2026-03-24T21:57:59.404Z"
  },
  {
    "name": "Avona mukka paathiyaa.",  ← WRONG (should be Ahona Mukhopadhyay)
    "visits": 1,
    "lastVisit": "2026-03-24T22:19:33.446Z"
  }
]
```

---

## 6. IMPLEMENTATION DETAILS

### **Appointment Booking Flow**

**File**: `backend/routes/appointments.js`

```javascript
router.post("/", (req, res) => {
  let data = read()
  
  const appointment = {
    name: req.body.name,        // From user speech
    issue: req.body.issue,      // From user speech
    date: req.body.date,        // Parsed from user speech
    time: req.body.time,        // Parsed from user speech
    createdAt: new Date()       // Server timestamp
  }
  
  data.push(appointment)
  write(data)
  res.json(appointment)
})
```

**Issues**:
1. ❌ No validation on backend
2. ❌ No duplicate prevention
3. ❌ No name normalization
4. ❌ Accepts whatever frontend sends

### **Patient Tracking**

**File**: `backend/routes/patients.js`

```javascript
router.post("/",(req,res)=>{
  let patients = read()
  const name = req.body.name
  
  let patient = patients.find(p=>p.name===name)  // ⚠️ Exact match
  
  if(patient){
    patient.visits++
    patient.lastVisit=new Date()
  }else{
    patient={
      name,
      visits:1,
      lastVisit:new Date()
    }
    patients.push(patient)
  }
  
  write(patients)
  res.json(patient)
})
```

**Issues**:
1. ❌ Exact name matching - "Ahona" vs "Avona" treated as different patients
2. ❌ No fuzzy matching for misspelled names
3. ❌ Case-sensitive (though data suggests lowercase stored sometimes)

### **Schedule Management**

**File**: `backend/routes/schedule.js`

```javascript
function generateRollingSchedule(days = 30){
  const baseSlots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"]
  const today = new Date()
  
  for(let i = 0; i < days; i++){
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    generated[toDateKey(d)] = [...baseSlots]
  }
  
  return generated
}
```

**Features**:
- ✅ Generates 30 days rolling schedule
- ✅ 7 slots per day: 09:00, 10:00, 11:00, 13:00, 14:00, 15:00, 16:00
- ✅ Uses current date (from server)
- ✅ Persists custom overrides in doctorSchedule.json

---

## 7. CURRENT STATE OF FIXES

**Reference**: `FIXES_APPLIED.md` (Previous work attempted)

### **Previously Fixed**:
1. ✅ Duplicate function definitions removed
2. ✅ Greeting step loop bug fixed
3. ✅ Conversation flow improved
4. ✅ Multilingual support added
5. ✅ Speech restart logic improved

### **Still Needs Fixing**:
1. ❌ Calendar export not implemented
2. ❌ Name spelling validation/confirmation
3. ❌ No fuzzy matching for patient names
4. ❌ Backend validation missing
5. ❌ No user confirmation before booking
6. ❌ Period (.) appended to some names in database

---

## 8. SUMMARY TABLE

| Component | Location | Status | Issues |
|-----------|----------|--------|--------|
| **Web Speech API Setup** | script.js:785 | ✅ Working | Limited to 4 languages |
| **Name Extraction** | script.js:292 | ⚠️ Works but Issues | Pattern-based, not robust; Stores speech errors |
| **Date Parsing** | script.js:455 | ✅ Correct | Uses current date properly |
| **Time Parsing** | script.js:499 | ✅ Correct | 24-hour format working |
| **Calendar Export** | index.html:69 | ❌ Missing | Button exists, no code |
| **Backend Validation** | appointments.js | ❌ Missing | Accepts all data as-is |
| **Patient Fuzzy Match** | patients.js | ❌ Missing | Exact match only |
| **Database** | *.json files | ✅ Working | Contains misspelled names |
| **Admin Dashboard** | admin.html | ✅ Functional | Displays appointments |

---

## 9. RECOMMENDED FIXES

### **Priority 1 - Critical**:
1. Add backend validation for appointment data
2. Implement name confirmation step (show user extracted name, ask for correction)
3. Add fuzzy name matching in patient tracking
4. Implement calendar export functionality

### **Priority 2 - Important**:
1. Add name spelling correction/confirmation UI
2. Better error handling for speech errors
3. Validate dates aren't in the past
4. Add appointment duplication prevention

### **Priority 3 - Enhancement**:
1. Add more language support (Bengali, regional variants)
2. Implement name dictionary for common names
3. Audio quality checks
4. Microphone fallback options

---

## File Locations Summary

| File | Purpose | Key Functions |
|------|---------|---|
| `server.js` | Express app entry point | Routes setup |
| `appointments.js` | Appointment CRUD | POST appointment |
| `patients.js` | Patient tracking | Track visits |
| `schedule.js` | Calendar availability | Check slots |
| `script.js` | Main voice logic | 900+ lines of conversation |
| `index.html` | Patient UI | Booking interface |
| `admin.html` | Admin interface | View appointments |
| `admin.js` | Admin logic | Search, sort, export |
| `appointments.json` | Booked appointments | Contains misspelled names |
| `patients.json` | Patient records | Visit history |
| `doctorSchedule.json` | Time slots | 7 slots/day |

