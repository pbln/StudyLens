import { useRef, useState } from 'react';
import PanelResizer from './components/PanelResizer.jsx';
import Toolbar from './components/Toolbar.jsx';
import PdfViewer from './components/PdfViewer.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import SidePanel from './components/SidePanel.jsx';
import ProfileEditor from './components/ProfileEditor.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import useSettings from './hooks/useSettings.js';
import useProfiles from './hooks/useProfiles.js';
import useRuns from './hooks/useRuns.js';
import usePyqBank from './hooks/usePyqBank.js';
import { createProvider } from './lib/gemma/index.js';
import useSelectionMenu from './hooks/useSelectionMenu.js';
import { loadPdf } from './lib/pdf.js';
import { buildPdf } from './lib/samplePdf.js';
import useChat from './hooks/useChat.js';
import ChatPanel from './components/ChatPanel.jsx';
import { getPageText } from './lib/pdfText.js';

export default function App({ providerFactory = createProvider }) {
  const [settings, updateSettings] = useSettings();
  const store = useProfiles();
  const runner = useRuns();
  const pyq = usePyqBank();
  const [tab, setTab] = useState('study');
  const [mode, setMode] = useState('notes');
  const [pinned, setPinned] = useState(null); // selected text attached to the next doubt
  const pageCache = useRef({ pdf: null, map: new Map() });
  const [editorOpen, setEditorOpen] = useState(false);
  const [doc, setDoc] = useState(null); // { pdf, name }
  const [error, setError] = useState('');
  const [scale, setScale] = useState(settings.defaultZoom);
  const [page, setPage] = useState(1);
  const [jump, setJump] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const readerRef = useRef(null);
  const nextId = useRef(1);
  const { menu, close } = useSelectionMenu(readerRef);

  const numPages = doc?.pdf.numPages ?? 0;
  const chat = useChat(doc ? `${doc.name}|${numPages}` : null);

  async function openData(data, name) {
    try {
      const pdf = await loadPdf(data);
      setDoc({ pdf, name });
      setPage(1);
      setError('');
      setCaptures([]);
      setActiveId(null);
    } catch {
      setError('Could not open that file. Choose a valid PDF that is not password-protected.');
    }
  }
  const openFile = async (file) => openData(new Uint8Array(await file.arrayBuffer()), file.name);
  const openSample = () => openData(buildPdf(), 'Sample – Photosynthesis.pdf');

  const goTo = (n) => {
    const clamped = Math.min(Math.max(1, n), numPages);
    setPage(clamped);
    setJump({ n: clamped, k: Date.now() });
  };
  const zoom = (d) => setScale((s) => Math.min(3, Math.max(0.5, s + d)));

  const runFor = (cap, action) => runner.start({
    captureId: cap.id, action, text: cap.text, profile: store.active,
    provider: providerFactory(settings), pyqBank: pyq.entries,
  });

  const act = (action) => {
    let cap = captures.find((c) => c.text === menu.text && c.page === menu.page);
    if (!cap) {
      cap = { id: nextId.current++, text: menu.text, page: menu.page };
      setCaptures((prev) => [cap, ...prev]);
    }
    setActiveId(cap.id);
    setTab(action);
    if (settings.autoOpenPanel) setPanelOpen(true);
    close();
    runFor(cap, action);
  };
  const ask = () => {
    setPinned({ text: menu.text, page: menu.page });
    setMode('ask');
    setPanelOpen(true);
    close();
  };

  // Each doubt sends only the page being read (or the page of the pinned selection), never the whole PDF.
  const sendDoubt = async (question, pin = pinned) => {
    if (!doc) return;
    const n = pin?.page ?? page;
    if (pageCache.current.pdf !== doc.pdf) pageCache.current = { pdf: doc.pdf, map: new Map() };
    let pageText = pageCache.current.map.get(n);
    if (pageText === undefined) { pageText = await getPageText(doc.pdf, n); pageCache.current.map.set(n, pageText); }
    setPinned(null);
    chat.send({ question, ctx: { page: n, pageText, pinned: pin }, provider: providerFactory(settings), profile: store.active });
  };
  const retryDoubt = () => {
    const last = chat.dropLast();
    if (last) sendDoubt(last.text, last.pinned ? { text: last.pinned, page: last.page } : null);
  };

  const activeCapture = captures.find((c) => c.id === activeId);
  const copy = () => { navigator.clipboard?.writeText(menu.text); close(); };
  const remove = (id) => {
    const rest = captures.filter((c) => c.id !== id);
    setCaptures(rest);
    if (id === activeId) setActiveId(rest[0]?.id ?? null);
  };

  return (
    <div className={`app text-${settings.panelTextSize}`}>
      <Toolbar
        fileName={doc?.name ?? ''} page={page} numPages={numPages} scale={scale} panelOpen={panelOpen}
        onOpenFile={openFile} onGoTo={goTo} onZoom={zoom}
        onTogglePanel={() => setPanelOpen((o) => !o)} onOpenSettings={() => setSettingsOpen(true)}
      />
      {error && <div className="error" role="alert">{error}</div>}
      <div className="body">
        <main className="reader" ref={readerRef}>
          {doc ? (
            <PdfViewer pdf={doc.pdf} scale={scale} jump={jump} onPageChange={setPage} />
          ) : (
            <div className="start">
              <h1>Read first. Study second.</h1>
              <p>Open a textbook PDF, or try the sample chapter.</p>
              <button className="primary" onClick={openSample}>Open sample</button>
            </div>
          )}
        </main>
        {panelOpen && <PanelResizer width={settings.panelWidth} onChange={(w) => updateSettings({ panelWidth: w })} />}
        {panelOpen && (
          <SidePanel
            width={settings.panelWidth} mode={mode} onMode={setMode}
            chatView={(
              <ChatPanel
                hasPdf={!!doc} page={page} profile={store.active} messages={chat.messages} busy={chat.busy}
                pinned={pinned} onUnpin={() => setPinned(null)} onSend={sendDoubt} onStop={chat.stop}
                onRetry={retryDoubt} onClear={chat.clear}
              />
            )}
            captures={captures} activeId={activeId}
            profiles={store.profiles} profile={store.active}
            onSwitchProfile={store.select} onEditProfiles={() => setEditorOpen(true)}
            tab={tab} onTab={setTab} getRun={runner.get}
            onRun={(a) => activeCapture && runFor(activeCapture, a)} onCancel={(a) => runner.cancel(activeId, a)}
            onPick={setActiveId} onRemove={remove} onClear={() => { setCaptures([]); setActiveId(null); }}
          />
        )}
      </div>
      {menu && <ContextMenu menu={menu} onAction={act} onAsk={ask} onCopy={copy} />}
      {editorOpen && <ProfileEditor store={store} onClose={() => setEditorOpen(false)} />}
      {settingsOpen && (
        <SettingsDialog pyq={pyq} settings={settings} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
