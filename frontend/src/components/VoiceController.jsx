import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Mic, MicOff, Keyboard, Type, Send, BookOpen, Info, Languages, MessageSquare, Book, Highlighter, HelpCircle, Brain, FileImage, FileText, Edit3, Search, Bookmark } from 'lucide-react';

const COMMANDS = [
  { id: 'read', name: 'Read Aloud', icon: <BookOpen size={14} />, shortcut: 'R' },
  { id: 'summary', name: 'Summary', icon: <Info size={14} />, shortcut: 'S' },
  { id: 'translate', name: 'Translation', icon: <Languages size={14} />, shortcut: 'T' },
  { id: 'ask', name: 'Ask AI', icon: <MessageSquare size={14} />, shortcut: 'A' },
  { id: 'meaning', name: 'Meaning', icon: <Book size={14} />, shortcut: 'M' },
  { id: 'focus', name: 'Focus Mode', icon: <Highlighter size={14} />, shortcut: 'F' },
  { id: 'highlights', name: 'My Marks', icon: <Highlighter size={14} />, shortcut: 'K' },
  { id: 'quiz', name: 'Quiz', icon: <HelpCircle size={14} />, shortcut: 'Q' },
  { id: 'questions', name: 'Questions', icon: <Brain size={14} />, shortcut: 'P' },
  { id: 'images', name: 'Images', icon: <FileImage size={14} />, shortcut: 'I' },
  { id: 'text', name: 'Extract Text', icon: <FileText size={14} />, shortcut: 'X' },
  { id: 'notes', name: 'Notes', icon: <Edit3 size={14} />, shortcut: 'N' },
  { id: 'search', name: 'Search', icon: <Search size={14} />, shortcut: '/' },
  { id: 'bookmark', name: 'Bookmark', icon: <Bookmark size={14} />, shortcut: 'B' },
];

const VoiceController = ({
  onCommand,
  isActive,
  setIsActive,
  languages = []
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typedCommand, setTypedCommand] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');

  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);
  const processCommand = useCallback((text) => {
    if (!text) return false;
    const lowerText = text.toLowerCase().trim();
    let matched = true;

    const readMatch = lowerText.match(/(?:read|play|narrate|speak|listen)(?:\s+(?:page|p\.?))?\s+(\d+)/i);
    const jumpMatch = lowerText.match(/(?:go to|jump to|page)\s+(\d+)/i);
    const pureNumberMatch = lowerText.match(/^(\d+)$/);

    if (readMatch) {
      const pageNum = parseInt(readMatch[1], 10);
      onCommand('read', pageNum);
      setFeedback(`Jumping to page ${pageNum} and starting narration...`);
    } else if (jumpMatch || pureNumberMatch) {
      const pageNum = parseInt((jumpMatch ? jumpMatch[1] : pureNumberMatch[1]), 10);
      onCommand('jump', pageNum);
      setFeedback(`Jumping to page ${pageNum}...`);
    } else if (lowerText.includes('next') || lowerText.includes('forward') || lowerText.includes('ahead') || lowerText.includes('right')) {
      onCommand('next');
      setFeedback('Going to next page...');
    } else if (lowerText.includes('previous') || lowerText.includes('back') || lowerText.includes('return') || lowerText.includes('left')) {
      onCommand('prev');
      setFeedback('Going to previous page...');
    }
    else if (lowerText.includes('meaning') || lowerText.includes('dictionary') || lowerText.includes('define') || lowerText.includes('word')) {
      onCommand('meaning');
      setFeedback('Opening Meaning tool...');
    } else if (lowerText.includes('summarize') || lowerText.includes('summary') || lowerText.includes('shorten') || lowerText.includes('brief')) {
      onCommand('summary');
      setFeedback('Generating summary...');
    } else if (lowerText.includes('ask') || lowerText.includes('ai') || lowerText.includes('question')) {
      onCommand('ask');
      setFeedback('Opening Ask AI...');
    }
    else if (lowerText.includes('read') || lowerText.includes('play') || lowerText.includes('narrate') || lowerText.includes('speak') || lowerText.includes('listen')) {
      onCommand('read');
      setFeedback('Starting narration...');
    } else if (lowerText.includes('pause') || lowerText.includes('stop') || lowerText.includes('wait') || lowerText.includes('hush')) {
      onCommand('pause');
      setFeedback('Paused.');
    }
    else if (lowerText.includes('highlight') || lowerText.includes('mark') || lowerText.includes('stain')) {
      onCommand('highlight');
      setFeedback('Highlighting selection...');
    }
    else if (lowerText.includes('text') || lowerText.includes('extract') || lowerText.includes('words')) {
      onCommand('text');
      setFeedback('Toggling extracted text display...');
    } else if (lowerText.includes('search') || lowerText.includes('find') || lowerText.includes('look up')) {
      onCommand('search');
      setFeedback('Toggling search...');
    } else if (lowerText.includes('focus') || lowerText.includes('read mode') || lowerText.includes('immersive')) {
      onCommand('focus');
      setFeedback('Toggling focus mode...');
    } else if (lowerText.includes('quiz') || lowerText.includes('test')) {
      onCommand('quiz');
      setFeedback('Starting quiz...');
    } else if (lowerText.includes('question') || lowerText.includes('predict')) {
      onCommand('questions');
      setFeedback('Opening predicted questions...');
    } else if (lowerText.includes('image') || lowerText.includes('picture')) {
      onCommand('images');
      setFeedback('Extracting images...');
    } else if (lowerText.includes('note') || lowerText.includes('notebook')) {
      onCommand('notes');
      setFeedback('Opening notebook...');
    } else if (lowerText.includes('bookmark') || lowerText.includes('save page')) {
      onCommand('bookmark');
      setFeedback('Toggling bookmark...');
    } else if (lowerText.includes('marks') || lowerText.includes('my marks')) {
      onCommand('highlights');
      setFeedback('Showing your marks...');
    }
    
    // Check if the input exactly matches any icon name or ID as a generic fallback
    const directCmd = COMMANDS.find(c => 
      lowerText === c.name.toLowerCase() || 
      lowerText === c.id.toLowerCase() ||
      (lowerText.length > 3 && c.name.toLowerCase().includes(lowerText))
    );

    if (directCmd) {
      onCommand(directCmd.id);
      setFeedback(`Activating ${directCmd.name}...`);
    } else {
      const checkLanguageMatch = (input) => {
      return languages.find(l => 
        input.toLowerCase() === l.name.toLowerCase() || 
        input.toLowerCase() === l.code.toLowerCase()
      );
    };

    const matchedLangDirect = checkLanguageMatch(lowerText);

    if (lowerText.includes('translate to')) {
      const parts = lowerText.split('translate to');
      if (parts.length > 1) {
        const langPart = parts[1].trim();
        const matchedLang = languages.find(l =>
          langPart.includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(langPart)
        );

        if (matchedLang) {
          onCommand('translate', matchedLang.code);
          setFeedback(`Translating to ${matchedLang.name}...`);
        } else {
          setFeedback(`Language "${langPart}" not recognized.`);
          matched = false;
        }
      } else {
        onCommand('translate');
        setFeedback('Opening translation menu...');
      }
    }
    else if (matchedLangDirect) {
      onCommand('translate', matchedLangDirect.code);
      setFeedback(`Translating to ${matchedLangDirect.name}...`);
    }
    else if (lowerText === 'translate') {
      onCommand('translate');
      setFeedback('Opening translation menu...');
    }
    else if (lowerText.includes('disable voice') || lowerText.includes('turn off') || lowerText.includes('exit voice') || lowerText.includes('close voice')) {
      setFeedback('Disabling voice control...');
      setTimeout(() => setIsActive(false), 1000);
    }
    else {
      matched = false;
      if (text.length > 0) {
        setFeedback(`Say a command... (Heard: "${text}")`);
      }
      }
    }

    if (matched || text.length > 0) {
      setTimeout(() => {
        setFeedback('');
        setTranscript('');
      }, 3000);
    }
    
    return matched;
  }, [onCommand, languages, setIsActive]);

  const handleTypeSubmit = (e) => {
    e.preventDefault();
    if (typedCommand.trim()) {
      processCommand(typedCommand);
      setTypedCommand('');
      setSuggestions([]);
      setSuggestionIndex(-1);
    }
  };

  useEffect(() => {
    if (!isActive || isTyping) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported in this browser.");
      setIsActive(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      console.log("Voice recognition started...");
      setFeedback('Listening...');
    };

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }

      setTranscript(currentTranscript);

      if (currentTranscript.trim()) {
        const normalizedVal = currentTranscript.trim().toLowerCase();
        const matchedCmds = COMMANDS.filter(c => 
          c.name.toLowerCase().includes(normalizedVal)
        ).map(c => ({ ...c, type: 'command' }));

        const matchedLangs = languages.filter(l => 
          l.name.toLowerCase().includes(normalizedVal) || 
          l.code.toLowerCase().includes(normalizedVal)
        ).map(l => ({ ...l, type: 'language' }));

        setSuggestions([...matchedCmds, ...matchedLangs].slice(0, 5));
      } else {
        setSuggestions([]);
      }

      if (processCommand(currentTranscript)) {
        setSuggestions([]);
        recognition.stop();
      }
    };

    recognition.onnomatch = () => {
      setFeedback("Sorry, I didn't recognize that command.");
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'not-allowed') {
        setIsActive(false);
      } else if (event.error === 'network') {
        setFeedback("Network error with speech recognition.");
      }
    };

    recognition.onend = () => {
      if (isActiveRef.current && !isTyping) {
        try {
          recognition.start();
        } catch (e) {
          console.log("Failed to restart recognition:", e);
        }
      } else {
        setIsListening(false);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Initial start failed:", e);
    }

    return () => {
      recognition.stop();
    };
  }, [isActive, isTyping, processCommand, setIsActive, languages]);

  if (!isActive) return null;

  return (
    <div className={`voice-status-indicator ${isListening ? 'listening' : ''}`}>
      <div className="voice-mic-icon" onClick={() => setIsTyping(!isTyping)} title={isTyping ? "Switch to Voice" : "Switch to Typing"}>
        {isTyping ? <Keyboard size={20} color="#e07a5f" /> : <Mic size={20} color="#e07a5f" />}
        {!isTyping && <div className="mic-pulse"></div>}
      </div>

      <div className="voice-text-container">
        {isTyping ? (
          <form onSubmit={handleTypeSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            <input
              type="text"
              className="voice-command-input"
              placeholder="Type icon name (e.g. 'Read', 'Focus', 'Tamil')..."
              value={typedCommand}
              onKeyDown={(e) => {
                if (suggestions.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSuggestionIndex(prev => (prev + 1) % suggestions.length);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                  } else if (e.key === 'Enter') {
                    if (suggestionIndex >= 0) {
                      e.preventDefault();
                      const selected = suggestions[suggestionIndex];
                      if (selected.type === 'command') processCommand(selected.id);
                      else processCommand(selected.name); 
                      setTypedCommand('');
                      setSuggestions([]);
                      setSuggestionIndex(-1);
                    }
                  } else if (e.key === 'Escape') {
                    setSuggestions([]);
                  }
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                setTypedCommand(val);
                
                if (!val.trim()) {
                  setSuggestions([]);
                  return;
                }

                const normalizedVal = val.trim().toLowerCase();
                const matchedCmds = COMMANDS.filter(c => 
                  c.name.toLowerCase().includes(normalizedVal)
                ).map(c => ({ ...c, type: 'command' }));

                const matchedLangs = languages.filter(l => 
                  l.name.toLowerCase().includes(normalizedVal) || 
                  l.code.toLowerCase().includes(normalizedVal)
                ).map(l => ({ ...l, type: 'language' }));

                const combined = [...matchedCmds, ...matchedLangs].slice(0, 5);
                setSuggestions(combined);
                setSuggestionIndex(combined.length > 0 ? 0 : -1);
              }}
              onBlur={() => setTimeout(() => setSuggestions([]), 200)}
              autoFocus
            />
            <button type="submit" style={{ display: 'none' }}></button>

            {suggestions.length > 0 && !feedback && (
              <div className="voice-suggestions">
                {suggestions.map((item, idx) => (
                  <div 
                    key={item.id || item.code}
                    className={`suggestion-item ${idx === suggestionIndex ? 'active' : ''} ${item.type}`}
                    onClick={() => {
                      if (item.type === 'command') processCommand(item.id);
                      else processCommand(item.name);
                      setTypedCommand('');
                      setSuggestions([]);
                    }}
                  >
                    <span className="suggestion-icon">
                      {item.type === 'command' ? item.icon : <Languages size={14} />}
                    </span>
                    <span className="suggestion-name">{item.name}</span>
                    <span className="suggestion-hint">
                      {item.type === 'command' ? 'Command' : 'Language'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </form>
        ) : (
          <div style={{ position: 'relative' }}>
            <span className="voice-label">
              {feedback || (transcript ? `"${transcript}"` : "Say a command...")}
            </span>
            {suggestions.length > 0 && !feedback && (
              <div className="voice-suggestions">
                {suggestions.map((item) => (
                  <div key={item.id || item.code} className="suggestion-item active">
                    <span className="suggestion-icon">
                      {item.type === 'command' ? item.icon : <Languages size={14} />}
                    </span>
                    <span className="suggestion-name">{item.name}</span>
                    <span className="suggestion-hint">
                      {item.type === 'command' ? 'Command' : 'Language'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="voice-mode-toggle" onClick={() => setIsTyping(!isTyping)} title={isTyping ? "Enable Mic" : "Enable Keyboard"}>
        {isTyping ? <Mic size={14} /> : <Keyboard size={14} />}
      </div>
    </div>
  );
};

export default VoiceController;
