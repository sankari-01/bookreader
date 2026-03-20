import React, { useState, useEffect, useRef } from 'react';
import { X, MessageSquare, Info, Volume2, Languages, Book, Play, Pause } from 'lucide-react';

const ToolPanel = ({
  active, onClose, filename, text, lang, detectedLang, detectedLangName, externalTab, onLanguageChange, initialWord, initialSummary, isFetchingSummary,
  audioUrl, setAudioUrl, isPlaying, setIsPlaying, audioRef, togglePlayback,
  isNarrating, narratingPage, onStartNarration, onStopNarration, currentViewPage
}) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [question, setQuestion] = useState('');
  const [word, setWord] = useState('');
  const [currentLang, setCurrentLang] = useState(lang);
  const askInputRef = useRef(null);
  const meaningInputRef = useRef(null);

  // Auto-focus input when tab changes
  useEffect(() => {
    if (active) {
      setTimeout(() => {
        if (activeTab === 'ask' && askInputRef.current) askInputRef.current.focus();
        else if (activeTab === 'meaning' && meaningInputRef.current) meaningInputRef.current.focus();
      }, 300); // Wait for transition
    }
  }, [active, activeTab]);

  // Reset all results when language changes
  useEffect(() => {
    if (lang !== currentLang) {
      setCurrentLang(lang);
      setResult('');
      // If audio was playing in the old language, stop it
      if (audioRef && audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [lang]);

  // Auto-set summary result if available
  useEffect(() => {
    if (active && activeTab === 'summary' && initialSummary && !result) {
      setResult(initialSummary);
    }
  }, [active, activeTab, initialSummary, result]);


  // List of all supported languages
  const allLanguages = [
    { code: 'en', name: 'English' },
    { code: 'ta', name: 'Tamil' },
    { code: 'hi', name: 'Hindi' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'de', name: 'German' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ko', name: 'Korean' },
    { code: 'te', name: 'Telugu' },
    { code: 'kn', name: 'Kannada' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'mr', name: 'Marathi' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'bn', name: 'Bengali' }
  ];

  const getLanguageLabel = (item) => {
    if (item.code === (detectedLang || 'en')) {
      return `${item.name} (Original)`;
    }
    return item.name;
  };

  // Sync internal word with prop if provided
  useEffect(() => {
    if (initialWord && initialWord.trim().length > 0) {
      setWord(initialWord);
      // If we are on the meaning tab and the panel is active, auto-trigger lookup
      if (active && activeTab === 'meaning') {
        handleAction('meaning', { word: initialWord, filename, context: text, lang });
      }
    } else if (active) {
      if (initialWord === '') setWord('');
    }
  }, [initialWord, active, activeTab]);

  // Clear state on close (Wait to clear result if narration is active)
  useEffect(() => {
    if (!active) {
      if (result !== 'narrator_active') {
        setResult('');
      }
      setWord('');
      setQuestion('');
    }
  }, [active, result]);

  // Sync with external tab clicks from Header or Voice Commands
  useEffect(() => {
    if (externalTab) {
      setActiveTab(externalTab);

      // Auto-trigger actions for specific tabs when opened via external trigger
      if (active) {
        if (externalTab === 'summary' && !result && !isFetchingSummary) {
          if (initialSummary) setResult(initialSummary);
          else handleAction('summarize_file', { filename, lang, text });
        } else if (externalTab === 'meaning' && initialWord && !result && !loading) {
          handleAction('meaning', { word: initialWord, filename, context: text, lang });
        }
      }
    }
  }, [externalTab, active, filename, lang, text, initialSummary, isFetchingSummary, initialWord, audioUrl, result, loading]);

  const handleAction = async (endpoint, body) => {
    if (endpoint === 'speak' && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    setLoading(true);
    try {
      const resp = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams(body)
      });
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned ${resp.status}`);
      }

      const data = await resp.json();

      if (endpoint === 'summarize_file') setResult(data.summary);
      if (endpoint === 'ask') setResult(data.answer);
      if (endpoint === 'meaning') setResult(data.meaning);
      if (endpoint === 'speak') {
        if (data.error) alert(data.error);
        else {
          let audio = audioRef.current;
          if (!audio) {
            audio = new Audio();
            audioRef.current = audio;
          } else {
            audio.pause();
            audio.src = '';
          }
          audio.src = data.audio_url;
          audio.volume = 1.0;
          audio.muted = false;
          setAudioUrl(data.audio_url);
          audio.onended = () => setIsPlaying(false);
          try {
            await audio.play();
            setIsPlaying(true);
            setResult('narrator_active');
          } catch (pErr) {
            console.error("ToolPanel play error:", pErr);
            // Removed alert per user request
            setIsPlaying(false);
          }
        }
      }
    } catch (err) {
      console.error("AI Action Error:", err);
      alert(`AI Action failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'summary', icon: <Info size={18} />, label: 'Summarize' },
    { id: 'ask', icon: <MessageSquare size={18} />, label: 'Ask AI' },
    { id: 'speak', icon: <Volume2 size={18} />, label: 'Speak' },
    { id: 'translate', icon: <Languages size={18} />, label: 'Translate' },
    { id: 'meaning', icon: <Book size={18} />, label: 'Meaning' },
  ];

  return (
    <>
      <div className={`popup-overlay ${active ? 'active' : ''}`} onClick={onClose}></div>
      <div className={`tool-panel ${active ? 'active' : ''}`}>
        <div className="tool-panel-header">
          <h3>AI Assistant</h3>
          <button className="close-panel" onClick={onClose}><X /></button>
        </div>

        <div style={{ display: 'flex', background: '#f5ebe0', padding: '5px' }}>
          {tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setResult(''); }}
              style={{
                flex: 1, padding: '10px 5px', cursor: 'pointer', textAlign: 'center',
                background: activeTab === tab.id ? '#4a342e' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#4a342e',
                borderRadius: '8px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', alignItems: 'center'
              }}
            >
              {tab.icon}
              <span style={{ marginTop: '4px' }}>{tab.label}</span>
            </div>
          ))}
        </div>

        <div className="tool-panel-body">
          {activeTab === 'summary' && (
            <div className="drawer-tool-section active">
              <h4>Book Summary</h4>
              <p style={{ fontSize: '0.9rem', marginBottom: '15px' }}>Get a concise 50-word summary of the entire content using AI.</p>

              {!result && isFetchingSummary ? (
                <div className="fetching-loader">
                  <div className="spinner"></div>
                  <span>Pre-fetching summary...</span>
                </div>
              ) : !result ? (
                <button
                  className="home-cta-btn"
                  onClick={() => handleAction('summarize_file', { filename, lang })}
                  disabled={loading}
                >
                  {loading ? "Summarizing..." : "Generate Summary"}
                </button>
              ) : (
                <div className="status-badge success">Summary Available</div>
              )}
            </div>
          )}

          {activeTab === 'ask' && (
            <div className="drawer-tool-section active">
              <h4>Ask Anything</h4>
              <input
                type="text"
                placeholder="What happened in chapter 2?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                ref={askInputRef}
              />
              <button
                className="home-cta-btn"
                onClick={() => handleAction('ask', { filename, question, context: text, lang })}
                disabled={loading || !question}
              >
                {loading ? "Asking..." : "Ask AI"}
              </button>
            </div>
          )}

          {activeTab === 'speak' && (
            <div className="drawer-tool-section active">
              <h4>Read Aloud</h4>
              <p style={{ fontSize: '0.9rem', marginBottom: '15px' }}
              >Narrates the book page by page with an expressive AI voice. Auto-advances to the next page when each page finishes.</p>
              {isNarrating ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Narrating status bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(224,122,95,0.1)', borderRadius: '10px', padding: '10px 14px', border: '1px solid rgba(224,122,95,0.3)' }}>
                    <span className="reading-bar" style={{ height: '18px' }}></span>
                    <span className="reading-bar" style={{ height: '26px' }}></span>
                    <span className="reading-bar" style={{ height: '20px' }}></span>
                    <span className="reading-bar" style={{ height: '14px' }}></span>
                    <span className="reading-bar" style={{ height: '22px' }}></span>
                    <span style={{ fontSize: '0.9rem', color: '#e07a5f', fontWeight: '600', marginLeft: '8px' }}>
                      Reading page {narratingPage}…
                    </span>
                  </div>
                  {/* Pause / Resume */}
                  <button
                    className="home-cta-btn"
                    onClick={togglePlayback}
                    style={{ background: isPlaying ? '#c9664d' : '#4a342e' }}
                  >
                    {isPlaying ? '⏸ Pause' : '▶ Resume'}
                  </button>
                  {/* Stop narration */}
                  <button
                    className="home-cta-btn"
                    onClick={onStopNarration}
                    style={{ background: '#8b4513' }}
                  >
                    ⏹ Stop Narration
                  </button>
                </div>
              ) : (
                <button
                  className="home-cta-btn"
                  onClick={onStartNarration}
                  disabled={loading}
                >
                  {loading ? 'Preparing…' : '▶ Start Reading'}
                </button>
              )}
            </div>
          )}

          {activeTab === 'translate' && (
            <div className="drawer-tool-section active">
              <h4>Translate Book</h4>
              <p style={{ fontSize: '0.9rem', marginBottom: '15px' }}>Translating will update the entire book text and AI responses to your selected language.</p>
              <select
                value={lang}
                onChange={(e) => onLanguageChange(e.target.value)}
                style={{ padding: '8px', width: '100%', borderRadius: '8px', border: '1px solid #d4a373', background: '#3d2b27', color: '#faedcd' }}
              >
                {allLanguages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {getLanguageLabel(item)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'meaning' && (
            <div className="drawer-tool-section active">
              <h4>Smart Dictionary</h4>
              <input
                type="text"
                placeholder="Enter a word to find meaning"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                ref={meaningInputRef}
              />
              <button
                className="home-cta-btn"
                onClick={() => handleAction('meaning', { word, filename, context: text, lang })}
                disabled={loading || !word}
              >
                {loading ? "Looking up..." : "Find Meaning"}
              </button>
            </div>
          )}

          {result && (
            <div style={{ marginTop: '25px', padding: '15px', background: 'white', borderRadius: '10px', border: '1px solid #d4a373' }}>
              <h5 style={{ margin: '0 0 10px 0', color: '#b5651d' }}>AI Result:</h5>
              {result === 'narrator_active' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button
                      onClick={togglePlayback}
                      style={{
                        background: '#4a342e', color: 'white', borderRadius: '50%', width: '50px', height: '50px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer'
                      }}
                    >
                      {isPlaying ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: '4px' }} />}
                    </button>
                    <span style={{ fontSize: '0.9rem', color: '#4a342e', fontWeight: 'bold' }}>
                      {isPlaying ? "Narrating..." : "Paused"}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play();
                        setIsPlaying(true);
                      }
                    }}
                    style={{
                      background: '#e07a5f', color: 'white', padding: '8px 15px', borderRadius: '8px',
                      border: 'none', cursor: 'pointer', fontSize: '0.85rem', width: '100%'
                    }}
                  >
                    Play from Start
                  </button>
                </div>
              ) : (
                <div
                  style={{ fontSize: '0.95rem', lineHeight: '1.5', color: '#4a342e' }}
                  dangerouslySetInnerHTML={{ __html: result }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ToolPanel;
