import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Mic, MicOff, Keyboard, Type, Send } from 'lucide-react';

const VoiceController = ({
  onCommand,
  isActive,
  setIsActive,
  languages = []
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typedCommand, setTypedCommand] = useState('');
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');

  // Use a ref to track the latest isActive status because recognition 
  // event handlers are closures that might capture old state
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const processCommand = useCallback((text) => {
    const lowerText = text.toLowerCase().trim();
    console.log("Processing command:", lowerText);

    // Navigation Commands - More flexible matching
    if (lowerText.includes('next') || lowerText.includes('forward') || lowerText.includes('ahead')) {
      onCommand('next');
      setFeedback('Going to next page...');
    } else if (lowerText.includes('previous') || lowerText.includes('back') || lowerText.includes('return')) {
      onCommand('prev');
      setFeedback('Going to previous page...');
    }

    // Tool Commands
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

    // Reading Commands
    else if (lowerText.includes('read') || lowerText.includes('play') || lowerText.includes('narrate') || lowerText.includes('speak')) {
      onCommand('read');
      setFeedback('Starting narration...');
    } else if (lowerText.includes('pause') || lowerText.includes('stop') || lowerText.includes('wait') || lowerText.includes('hush')) {
      onCommand('pause');
      setFeedback('Paused.');
    }


    // Highlighting Commands
    else if (lowerText.includes('highlight') || lowerText.includes('mark') || lowerText.includes('stain')) {
      onCommand('highlight');
      setFeedback('Highlighting selection...');
    }

    // UI Toggles
    else if (lowerText.includes('text') || lowerText.includes('extract') || lowerText.includes('words')) {
      onCommand('text');
      setFeedback('Toggling extracted text display...');
    } else if (lowerText.includes('search') || lowerText.includes('find') || lowerText.includes('look up')) {
      onCommand('search');
      setFeedback('Toggling search...');
    } else if (lowerText.includes('focus') || lowerText.includes('read mode') || lowerText.includes('immersive')) {
      onCommand('focus');
      setFeedback('Toggling focus mode...');
    }

    // Translation Commands
    else if (lowerText.includes('translate to')) {
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
        }
      } else {
        onCommand('translate'); // Just open menu
        setFeedback('Opening translation menu...');
      }
    }

    // Fallback for translation if only "translate" is said
    else if (lowerText === 'translate') {
      onCommand('translate');
      setFeedback('Opening translation menu...');
    }

    // Disable voice control command
    else if (lowerText.includes('disable voice') || lowerText.includes('turn off') || lowerText.includes('exit voice')) {
      setFeedback('Disabling voice control...');
      setTimeout(() => setIsActive(false), 1000);
    }

    // Default feedback for recognized text that doesn't match a command
    else if (text.length > 0) {
      setFeedback(`Command "${text}" not recognized.`);
    }

    // Clear feedback and transcript preview after 3 seconds
    setTimeout(() => {
      setFeedback('');
      setTranscript('');
    }, 3000);
  }, [onCommand, languages, setIsActive]);

  const handleTypeSubmit = (e) => {
    e.preventDefault();
    if (typedCommand.trim()) {
      processCommand(typedCommand);
      setTypedCommand('');
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
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      console.log("Voice recognition started...");
      setFeedback('Listening...');
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          setTranscript(event.results[i][0].transcript);
        }
      }

      if (finalTranscript) {
        processCommand(finalTranscript);
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
      // Don't disable immediately, maybe user can still type
    }

    return () => {
      recognition.stop();
    };
  }, [isActive, isTyping, processCommand, setIsActive]);

  if (!isActive) return null;

  return (
    <div className={`voice-status-indicator ${isListening ? 'listening' : ''}`}>
      <div className="voice-mic-icon" onClick={() => setIsTyping(!isTyping)} title={isTyping ? "Switch to Voice" : "Switch to Typing"}>
        {isTyping ? <Keyboard size={20} color="#e07a5f" /> : <Mic size={20} color="#e07a5f" />}
        {!isTyping && <div className="mic-pulse"></div>}
      </div>

      <div className="voice-text-container">
        {isTyping ? (
          <form onSubmit={handleTypeSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              className="voice-command-input"
              placeholder="Type icon name (e.g. 'Read', 'Listen', 'Focus', 'Search', 'Text')..."
              value={typedCommand}
              onChange={(e) => setTypedCommand(e.target.value)}
              autoFocus
            />
            <button type="submit" style={{ display: 'none' }}></button>
          </form>
        ) : (
          <span className="voice-label">
            {feedback || (transcript ? `"${transcript}"` : "Say a command...")}
          </span>
        )}
      </div>

      <div className="voice-mode-toggle" onClick={() => setIsTyping(!isTyping)} title={isTyping ? "Enable Mic" : "Enable Keyboard"}>
        {isTyping ? <Mic size={14} /> : <Keyboard size={14} />}
      </div>
    </div>
  );
};

export default VoiceController;
