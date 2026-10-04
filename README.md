# StudyLens

**A study companion that lives next to your textbook PDF.**
Open a PDF, highlight the paragraph that's confusing you, right-click, and StudyLens turns it into notes shaped the way *you* like to study. It can also find real previous-year questions on that topic, write fresh practice questions, and answer doubts in a chat while you read.

It runs on **Gemma** (Google's open-weight model), either on your own computer through Ollama or through a Google AI Studio key.

> Built for the Hacktoberfest Weekend Challenge: *Build for a Friend*.

---

## What it does

| Feature | In one line |
|---|---|
| **PDF reader** | Open any text-based PDF, scroll, zoom, jump to a page. |
| **Right-click actions** | Select text → *Explain / Study this*, *Find actual PYQs*, *Generate practice questions*, *Ask a doubt about this*. |
| **Study Profiles** | You choose which sections your notes have, in what order, plus exam, depth, language, and a cap on key points. |
| **Study notes** | Gemma writes the notes straight into the side panel as Markdown, streaming as it goes. |
| **Actual PYQs** | Searches a question bank *you* import. It never asks the AI for past questions, because models make them up. |
| **Practice questions** | AI-written MCQs and short questions, clearly labelled as AI-generated. |
| **Ask doubts** | A chat that knows the page you are reading. Remembered per PDF. |

---

## Run it

You need **Node.js 18 or newer** (get the LTS version from [nodejs.org](https://nodejs.org)).

```bash
git clone <your-repo-url>
cd studylens
npm install
npm run dev
```

Open the address it prints (usually <http://localhost:5173>). Keep using the same address: your saved settings, structures and chats live in the browser, and a different port counts as a different site.

### Pick a model (Settings → AI model)

1. **Demo mode.** No model at all. It builds notes from your text with simple rules. Good for trying the layout in 10 seconds. It does not explain anything.
2. **Gemma on this computer (Ollama).** Install [Ollama](https://ollama.com), then:
   ```bash
   ollama pull gemma4:e4b
   ```
   Leave Ollama running. The defaults in Settings already point to it.
3. **Gemma via Google AI Studio.** Paste a key from [aistudio.google.com](https://aistudio.google.com) and use the model `gemma-4-26b-a4b-it` (fast). The 31B model also works but Google's hosted version is often slow or returns 500 errors. StudyLens handles that (see [Speed and reliability](#speed-and-reliability)).

The API key is stored in your browser only and is sent only to Google. Don't enter it on a shared computer.

### Previous-year questions

StudyLens ships with no question data. Import your own JSON file in **Settings → Previous-year questions**:

```json
[
  {
    "question": "Where do the light reactions of photosynthesis occur?",
    "exam": "NEET",
    "year": 2019,
    "options": ["Stroma", "Thylakoid membrane", "Nucleus", "Cytoplasm"],
    "answer": "B",
    "subject": "Biology",
    "topic": "Photosynthesis",
    "source": "link or paper name"
  }
]
```

`question`, `exam` and `year` are required. Everything else is optional. Please use official papers and respect their terms of use.

### Tests and checks

```bash
npm test                      # 119 tests
npm run build                 # production build

# Check a real Gemma returns the right sections in the right order:
node scripts/smoke-gemma.mjs --provider ollama --model gemma4:e4b
GEMINI_API_KEY=your_key node scripts/smoke-gemma.mjs --provider google --model gemma-4-26b-a4b-it

# Is it my key, the model, or Google's server?
GOOGLE_API_KEY=your_key node scripts/diagnose-google.mjs gemma-4-31b-it
```

---

## What's in each folder

```
studylens/
├── index.html                 Page shell
├── package.json               Scripts and dependencies
├── vite.config.js             Vite + test setup (jsdom)
├── scripts/
│   ├── smoke-gemma.mjs        Live check: real Gemma, every preset, right sections in order?
│   └── diagnose-google.mjs    Tells you if a failure is the key, the model, or Google's server
└── src/
    ├── main.jsx               Mounts the app, loads pdf.js and app styles
    ├── App.jsx                The hub: holds the open PDF, selections, mode, and wires everything together
    ├── styles.css             All styling
    ├── components/            What you see
    ├── hooks/                 State and browser behaviour (storage, streaming runs, chat)
    ├── lib/                   The logic with no UI: prompts, parsing, search, models
    └── test/                  Test setup
```

### `src/components/`

| File | What it does |
|---|---|
| `Toolbar.jsx` | Open PDF, page box and arrows, zoom, side-panel toggle, settings. |
| `PdfViewer.jsx` | Scrollable stack of pages; scrolls to a requested page; reports which page you are on. |
| `PdfPage.jsx` | One page. Draws a canvas plus an invisible text layer so text is selectable. Only renders pages near the screen. |
| `ContextMenu.jsx` | The right-click menu: the three actions, *Ask a doubt about this*, and *Copy text*. |
| `SidePanel.jsx` | The right-hand panel. Notes mode (structure picker, selected text, result tabs, history) or Ask mode. |
| `PanelResizer.jsx` | Drag handle (and arrow keys) to resize the panel. |
| `StructurePreview.jsx` | Shows which sections the active structure will produce. |
| `ProfileEditor.jsx` | Create, edit, reorder, save, duplicate, delete and import/export study structures. |
| `ChatPanel.jsx` | The doubt chat: messages, suggestions, selected-text chip, stop, retry. |
| `Markdown.jsx` | Small Markdown renderer (headings, bullets, numbered steps, bold). Builds React elements, so model output can never inject HTML. Works on half-written text. |
| `SettingsDialog.jsx` | Zoom, text size, model choice and key, PYQ import. |
| `results/RunView.jsx` | Shows one action's state: not run, writing, error with retry, or done. |
| `results/StudyResult.jsx` | Renders notes and the "didn't follow your structure" warning. |
| `results/PracticeResult.jsx` | Practice questions with show/hide answers and an AI-generated label. |
| `results/PyqResult.jsx` | Real PYQs with exam, year, matched words and source, labelled as actual. |

### `src/hooks/`

| File | What it does |
|---|---|
| `useSelectionMenu.js` | Opens the custom menu on right-click only when text is selected; otherwise the normal browser menu appears. |
| `useRuns.js` | Runs an action for a selection, tracks loading/done/error, streams partial text, supports cancel. |
| `useChat.js` | The doubt chat: sends a question, streams the answer, stop/retry, and saves the conversation per PDF. |
| `useProfiles.js` | Study Profiles: built-in presets plus your own, saved in the browser. |
| `usePyqBank.js` | Loads and stores your imported question bank. |
| `useSettings.js` | Persisted settings, including model choice. |

### `src/lib/`

| File | What it does |
|---|---|
| `profileSchema.js` | **Defines a Study Profile**: the 11 sections, presets, exams, depths, languages, validation and repair of loaded data. |
| `profileOps.js` | Pure helpers to reorder and toggle sections. |
| `promptBuilder.js` | **Builds the prompts** for study notes and practice questions from a profile and the selected text. Also holds what each section means. |
| `notesFormat.js` | Cleans stray code fences and chatter, and **checks** Gemma's headings against your profile (missing, extra, out of order). |
| `pipeline.js` | Runs an action: study (one call, streamed), practice (validated JSON with one retry), PYQ (search only). |
| `parseResponse.js` | JSON extraction and validation, used for practice questions. |
| `pyq.js` | Imports the question bank and searches it (see below). |
| `chat.js` | Builds the doubt-chat prompt from the current page, optional selection and recent turns. |
| `pdfText.js` | Reads the text of one PDF page. |
| `selection.js` | Reads the selected text and its page; tidies line breaks and hyphenation from PDFs. |
| `pdf.js` | Sets up pdf.js and loads a PDF. |
| `samplePdf.js` | Builds a small sample PDF in memory so you can try the app without a file. |
| `gemma/providers.js` | **Talks to the models**: Ollama (local) and Google AI Studio, both streaming. |
| `gemma/index.js` | Picks the provider from settings; holds model defaults. |
| `gemma/demoProvider.js` | Offline stand-in that reads the prompt and writes notes from your text. Powers demo mode and most tests. |

Every `*.test.js(x)` file sits next to the code it tests.

---

## How each feature works

### Reading and selecting
pdf.js draws each page onto a canvas and lays an invisible, positioned text layer on top, so text is selectable like on a web page. Pages render only when they are within about 800px of the screen, so long books stay responsive. On right-click, the app reads the browser's current selection, cleans it (joins lines, repairs words split by a hyphen at a line end) and works out which page it came from. With no selection, the normal browser menu is left alone.

### Study Profiles
A profile is plain data: an ordered list of `{ id, enabled }` for 11 sections (topic, one-line explanation, key points, why/how, process, terms, examples, confusions, memory tricks, exam takeaway, exam relevance), plus target exam, depth (short/medium/detailed), language (English, Simple English, Hindi, Hinglish) and a key-point cap. The array order *is* the output order. Presets can be edited freely and saved as your own copy; presets themselves never change. Saving a structure also makes it the active one. Anything loaded from storage is validated and repaired, so a corrupt entry can't crash the app. Structures can be exported and imported as a file.

### Study notes
1. `promptBuilder.js` writes a short prompt: ground rules, your exam/depth/language, then exactly the sections you enabled as `## Headings` in your order, each with a one-line rule and format hint, then the selected text. Only the selection is sent, never the whole PDF, and it is clipped if very long.
2. Gemma streams back Markdown. The panel renders it as it arrives, so you start reading the first section while the rest is still being written.
3. `notesFormat.js` compares the headings with your profile. If Gemma skipped, added or reordered a section, a small note appears. There is no automatic retry, because a second full model call just doubles the wait. *Run again* is one click.

### Previous-year questions (retrieval)
No AI is involved. When you choose *Find actual PYQs*:
1. The selection and every stored question are split into lowercase words (short and common words dropped, simple endings trimmed).
2. Each word is weighted by how rare it is across your bank: `ln(1 + total ÷ questions containing the word)`.
3. A question's score is the sum of the weights of the words it shares with your selection. It needs at least two shared words (one if you selected three words or fewer).
4. Results are filtered to your target exam, sorted by score, and the top 8 are shown word for word with exam, year, matched words and source.

If no bank is loaded, it says so. It never makes questions up.

### Practice questions
Gemma writes MCQs and short questions as JSON. The reply is validated (valid options, an answer index in range); if it can't be read, one retry is made with the problems spelled out. Answers are hidden until clicked, and the whole set is labelled as AI-generated, not actual exam questions. The prompt forbids calling them past-year questions.

### Ask doubts
Each question sends only: the page you are on (or the page of a sentence you attached through *Ask a doubt about this*), the last three exchanges, and your profile's exam, depth and language. The question goes last. The model is told to use the page first and mark anything beyond it as "(outside this page)". The conversation is saved per PDF in the browser and survives a reload. There is Stop, Try again and New chat.

### Speed and reliability
- **Streaming everywhere**, so the first words show up quickly.
- **Short prompts** (roughly 750 to 950 tokens).
- **Hosted Gemma failover.** Google's hosted 31B endpoint can take a long time to start or return 500 errors. With a fallback available, the 31B model gets one attempt and a 12-second deadline to first text. A failure or a miss switches to `gemma-4-26b-a4b-it` immediately, and the slow model is skipped for 5 minutes. Pressing Stop is never mistaken for slowness.
- **Thinking kept minimal** for Gemma 4 on the API.
- **Ollama** runs with a larger context (8K, since Ollama defaults Gemma 4 to 4K) and JSON mode only where JSON is needed.
- The browser console prints a timing line per request, including time to first text.

### Where data lives
Everything is in your browser's `localStorage`: settings, your structures, the PYQ bank and chats. Nothing goes to a StudyLens server because there isn't one. Text goes only to the model you choose.

| Key | Holds |
|---|---|
| `studylens.settings.v1` | Settings, model choice, API key |
| `studylens.profiles.v1` | Your study structures and the active one |
| `studylens.pyq.v1` | Your imported question bank |
| `studylens.chat.v1:<file>` | The doubt chat for that PDF |

---

## Honest limits

- **Scanned PDFs** have no text layer to select or read. OCR isn't built in.
- **PYQ matching is by words, not meaning.** A past question that tests the same idea in different words can be missed. It also doesn't favour recent years yet.
- **Doubts use one page of context.** Questions about earlier chapters work only through chat history.
- **The browser holds the data.** `localStorage` is small (about 5 MB) and per browser. There is no sync between devices.
- **Structure is enforced by the prompt, not by code.** Gemma usually follows it, and the app tells you when it doesn't.
- **Hosted Gemma speed varies** with Google's load. The local model's speed depends on your hardware.

## Tech

React 19, Vite, pdf.js (`pdfjs-dist`), Vitest and Testing Library. No backend.
