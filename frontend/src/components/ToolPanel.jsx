import React, { useState, useEffect, useRef } from 'react';
import { X, MessageSquare, Info, Languages, Book, BookOpen, Play, Pause, RefreshCcw, Music } from 'lucide-react';

const ToolPanel = ({
  active, onClose, filename, text, lang, detectedLang, detectedLangName, externalTab, onLanguageChange, initialWord, initialSummary, isFetchingSummary,
  isNarrating, isPlaying, narratingPage, togglePlayback, onStopNarration, onStartNarration, onRestartNarration,
  currentViewPage,
  narrationSpeed, onSpeedChange,
  narrationGender, onGenderChange,
  isSongMode, onSongModeChange
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
      if (externalTab !== activeTab) setResult('');
      setActiveTab(externalTab);

      // Auto-trigger actions for specific tabs when opened via external trigger
      if (active) {
        if (externalTab === 'summary' && !result && !isFetchingSummary) {
          if (initialSummary) setResult(initialSummary);
          else handleAction('summarize_file', { filename, lang, text });
        } else if (externalTab === 'meaning' && initialWord && !result && !loading) {
          handleAction('meaning', { word: initialWord, filename, context: text, lang });
        } else if (externalTab === 'speak' && !isNarrating) {
          onStartNarration();
        }
      }
    }
  }, [externalTab, active, filename, lang, text, initialSummary, isFetchingSummary, initialWord, result, loading]);

  const handleAction = async (endpoint, body) => {
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
    { id: 'speak', icon: <BookOpen size={18} />, label: 'Read' },
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
            <div className="drawer-tool-section active" style={{ display: 'flex', flexDirection: 'column', height: 'auto', maxHeight: '100%' }}>
              <h4>Book Summary</h4>
              <p style={{ fontSize: '0.85rem', marginBottom: '12px', color: '#6d4c41' }}>A concise 50-word synthesis of the entire book.</p>

              {(loading && activeTab === 'summary') ? (
                <div className="fetching-loader" style={{ margin: '20px 0' }}>
                  <div className="spinner"></div>
                  <span>Generating summary...</span>
                </div>
              ) : (!result && isFetchingSummary) ? (
                <div className="fetching-loader" style={{ margin: '20px 0' }}>
                  <div className="spinner"></div>
                  <span>Pre-fetching summary...</span>
                </div>
              ) : !result ? (
                <button
                  className="home-cta-btn"
                  onClick={() => handleAction('summarize_file', { filename, lang })}
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  Generate Summary
                </button>
              ) : (
                <div className="summary-result-container" style={{
                  background: 'white',
                  padding: '15px',
                  borderRadius: '12px',
                  border: '1px solid #d4a373',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                  marginTop: '10px',
                  overflowY: 'auto',
                  maxHeight: '350px'
                }}>
                  <div
                    style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#4a342e', fontFamily: "'Alice', serif" }}
                    dangerouslySetInnerHTML={{ __html: result }}
                  />
                  <div style={{ marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="status-badge success" style={{ fontSize: '0.7rem' }}>AI Generated</div>
                  </div>
                </div>
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
                onClick={() => {
                  const cmd = question.toLowerCase().trim();
                  if (cmd === 'read' || cmd === 'listen' || cmd === 'start reading') { onStartNarration(); setActiveTab('speak'); return; }
                  if (cmd === 'summary' || cmd === 'summarize') { setActiveTab('summary'); return; }
                  if (cmd === 'meaning' || cmd === 'dictionary') { setActiveTab('meaning'); return; }
                  if (cmd === 'translate' || cmd === 'translation') { setActiveTab('translate'); return; }
                  handleAction('ask', { filename, question, context: text, lang });
                }}
                disabled={loading || !question}
              >
                {loading ? "Asking..." : "Ask AI"}
              </button>
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
            <div className="drawer-tool-section active" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h4>Smart Dictionary</h4>
              <p style={{ fontSize: '0.85rem', marginBottom: '12px', color: '#6d4c41' }}>Find definitions and context-aware explanations.</p>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                <input
                  type="text"
                  placeholder="Enter a word..."
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  ref={meaningInputRef}
                  style={{ flex: 1, marginBottom: 0 }}
                  onKeyDown={(e) => e.key === 'Enter' && word && handleAction('meaning', { word, filename, context: text, lang })}
                />
                <button
                  className="home-cta-btn"
                  onClick={() => handleAction('meaning', { word, filename, context: text, lang })}
                  disabled={loading || !word}
                  style={{ width: 'auto', padding: '0 15px', height: '42px', marginTop: 0 }}
                >
                  {loading ? <RefreshCcw size={16} className="spin" /> : <Book size={18} />}
                </button>
              </div>

              {loading && activeTab === 'meaning' ? (
                <div className="fetching-loader" style={{ margin: '20px 0' }}>
                  <div className="spinner"></div>
                  <span>Searching dictionary...</span>
                </div>
              ) : result && activeTab === 'meaning' ? (
                <div className="dictionary-result-card" style={{
                  background: 'white',
                  padding: '15px',
                  borderRadius: '12px',
                  border: '1px solid #d4a373',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                  overflowY: 'auto',
                  maxHeight: '400px'
                }}>
                  <div
                    style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#4a342e' }}
                    dangerouslySetInnerHTML={{ __html: result }}
                  />
                  <div style={{ marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="status-badge success" style={{ fontSize: '0.7rem' }}>Multi-Language Support</div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.5 }}>
                  <Book size={48} color="#d4a373" style={{ marginBottom: '10px' }} />
                  <p style={{ fontSize: '0.9rem' }}>Type a word or select one from the book to see its meaning.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'speak' && (
            <div className="drawer-tool-section active" style={{ display: 'flex', flexDirection: 'column' }}>
              <h4>Read Aloud</h4>
              <p style={{ fontSize: '0.9rem', marginBottom: '20px' }}>Narrates the book page by page with an expressive AI voice. Starts from Page 1.</p>

              <div style={{ padding: '0 20px 20px 20px' }}>
                {isNarrating ? (
                  <div style={{ textAlign: 'center' }}>
                    <div className="narration-visualizer">
                      <div className="bar"></div><div className="bar"></div><div className="bar"></div><div className="bar"></div><div className="bar"></div>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#45322e' }}>
                        Reading Page {narratingPage}
                      </h4>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.4)', borderRadius: '12px', padding: '15px', marginBottom: '20px', border: '1px solid rgba(139, 115, 85, 0.2)' }}>
                      <div style={{ marginBottom: '12px' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', fontWeight: '600', color: '#8b7355', textAlign: 'left' }}>Tone</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => onGenderChange('f')}
                            style={{ flex: 1, padding: '5px', borderRadius: '6px', border: 'none', background: narrationGender === 'f' ? '#e07a5f' : '#f4f1de', color: narrationGender === 'f' ? 'white' : 'inherit', fontSize: '0.75rem' }}>Female</button>
                          <button onClick={() => onGenderChange('m')}
                            style={{ flex: 1, padding: '5px', borderRadius: '6px', border: 'none', background: narrationGender === 'm' ? '#e07a5f' : '#f4f1de', color: narrationGender === 'm' ? 'white' : 'inherit', fontSize: '0.75rem' }}>Male</button>
                        </div>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', fontWeight: '600', color: '#8b7355', textAlign: 'left' }}>Speed</p>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {['0.5x', '0.75x', '1.0x', '1.25x', '1.5x', '2.0x'].map(s => (
                            <button key={s} onClick={() => onSpeedChange(s)}
                              style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: narrationSpeed === s ? '#8b7355' : '#f4f1de', color: narrationSpeed === s ? 'white' : 'inherit', fontSize: '0.7rem' }}>{s}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginTop: '15px' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', fontWeight: '600', color: '#8b7355', textAlign: 'left' }}>Style</p>
                        <button onClick={() => onSongModeChange(!isSongMode)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e07a5f', background: isSongMode ? '#e07a5f' : 'transparent', color: isSongMode ? 'white' : '#e07a5f', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                          <Music size={14} /> {isSongMode ? "Kids Rhyme Mode (On)" : "Kids Rhyme Mode (Off)"}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button onClick={togglePlayback} className="home-cta-btn" style={{ height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {isPlaying ? <><Pause size={18} /> Pause</> : <><Play size={18} fill="currentColor" /> Resume</>}
                      </button>
                      <button onClick={() => onRestartNarration()} className="home-cta-btn" style={{ height: '45px', background: 'transparent', color: '#45322e', border: '1px solid #45322e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <RefreshCcw size={16} /> Restart
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <BookOpen size={48} color="#e07a5f" style={{ opacity: 0.5, marginBottom: '10px' }} />
                      <h3 style={{ margin: 0, color: '#45322e' }}>Read Aloud</h3>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.4)', borderRadius: '12px', padding: '15px', marginBottom: '20px', border: '1px solid rgba(139, 115, 85, 0.2)' }}>
                      <div style={{ marginBottom: '12px' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', fontWeight: '600', color: '#8b7355', textAlign: 'left' }}>Tone</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => onGenderChange('f')}
                            style={{ flex: 1, padding: '5px', borderRadius: '6px', border: 'none', background: narrationGender === 'f' ? '#e07a5f' : '#f4f1de', color: narrationGender === 'f' ? 'white' : 'inherit', fontSize: '0.75rem' }}>Female</button>
                          <button onClick={() => onGenderChange('m')}
                            style={{ flex: 1, padding: '5px', borderRadius: '6px', border: 'none', background: narrationGender === 'm' ? '#e07a5f' : '#f4f1de', color: narrationGender === 'm' ? 'white' : 'inherit', fontSize: '0.75rem' }}>Male</button>
                        </div>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', fontWeight: '600', color: '#8b7355', textAlign: 'left' }}>Speed</p>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {['0.5x', '0.75x', '1.0x', '1.25x', '1.5x', '2.0x'].map(s => (
                            <button key={s} onClick={() => onSpeedChange(s)}
                              style={{ padding: '4px 6px', borderRadius: '4px', border: 'none', background: narrationSpeed === s ? '#8b7355' : '#f4f1de', color: narrationSpeed === s ? 'white' : 'inherit', fontSize: '0.7rem' }}>{s}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginTop: '15px' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', fontWeight: '600', color: '#8b7355', textAlign: 'left' }}>Style</p>
                        <button onClick={() => onSongModeChange(!isSongMode)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e07a5f', background: isSongMode ? '#e07a5f' : 'transparent', color: isSongMode ? 'white' : '#e07a5f', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                          <Music size={14} /> {isSongMode ? "Kids Rhyme Mode (On)" : "Kids Rhyme Mode (Off)"}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button onClick={() => onStartNarration()} className="home-cta-btn" style={{ height: '50px', background: '#e07a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Play size={22} fill="currentColor" /> Start
                      </button>
                      <button onClick={() => onRestartNarration()} className="home-cta-btn" style={{ height: '45px', background: 'transparent', color: '#45322e', border: '1px solid #45322e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <RefreshCcw size={16} /> Restart
                      </button>
                    </div>
                    <p style={{ marginTop: '15px', fontSize: '0.8rem', color: '#8b7355' }}>Continuously reads through the entire book.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {result && activeTab !== 'summary' && activeTab !== 'meaning' && (
            <div className="ai-result-box" style={{ marginTop: '25px', padding: '18px', background: 'white', borderRadius: '15px', border: '1px solid #d4a373', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e07a5f' }}></div>
                <h5 style={{ margin: 0, color: '#b5651d', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Response</h5>
              </div>
              <div
                style={{ fontSize: '0.95rem', lineHeight: '1.7', color: '#4a342e', whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{ __html: result.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>') }}
              />
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default ToolPanel;
