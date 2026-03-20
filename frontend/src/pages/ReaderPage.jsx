import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import ToolPanel from '../components/ToolPanel';
import VoiceController from '../components/VoiceController';
import { FileText, Menu, Info, MessageSquare, Volume2, Book, Languages, Highlighter, ChevronLeft, ChevronRight, Play, Pause, Search, Mic, MicOff, X as CloseIcon } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const parsePages = (text) => {
  if (!text) return [];
  // Split by universal markers that catch any word between --- (including translated ones)
  const markerRegex = /--- [\s\S]+? \d+ ---/gi;
  const parts = text.split(markerRegex);
  
  // Clean each page: trim whitespace and remove any trailing "extra contents"
  return parts
    .map(p => p.trim()) 
    .filter(p => p.length > 0);
};

const ReaderPage = () => {
  const { filename } = useParams();
  const [searchParams] = useSearchParams();
  const [currentLang, setCurrentLang] = useState(searchParams.get('lang') || 'en');
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);

  const [showText, setShowText] = useState(false);
  const [pages, setPages] = useState([]);

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfError, setPdfError] = useState(false);
  const viewerRef = useRef(null);
  
  const [activeTab, setActiveTab] = useState('summary');
  const [hasAutoSetLang, setHasAutoSetLang] = useState(false);

  // Search States
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageJumpMsg, setPageJumpMsg] = useState('');
  const [summaryData, setSummaryData] = useState('');
  const [isFetchingSummary, setIsFetchingSummary] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [analyzingPage, setAnalyzingPage] = useState(0);
  const [voiceActive, setVoiceActive] = useState(false);
  const [isReadMode, setIsReadMode] = useState(false);

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

  const handleReadTranslationClick = () => {
    if (currentLang.toLowerCase() !== (data?.detected_lang || 'en').toLowerCase()) {
        setShowLangMenu(true);
    } else {
        setIsAnalyzing(true);
        // Simulate initial analysis
        let p = 0;
        const interval = setInterval(() => {
            p += Math.floor(Math.random() * 10) + 5;
            if (p > 100) p = 100;
            setAnalyzingPage(p);
            if (p >= 100) {
                clearInterval(interval);
                setIsAnalyzing(false);
                setShowLangMenu(true);
            }
        }, 80);
    }
  };

  const selectLanguage = async (newLang) => {
    setShowLangMenu(false);
    if (newLang === (data?.detected_lang || 'en')) {
        setCurrentLang(data?.detected_lang || 'en');
        return;
    }
    
    setIsAnalyzing(true);
    setAnalyzingPage(0);
    
    // Start progress bar
    let p = 0;
    const interval = setInterval(() => {
        p += 2;
        if (p > 95) p = 95; // Wait at 95 until back-end finishes
        setAnalyzingPage(p);
    }, 100);

    try {
        const resp = await fetch('/api/prepare_translation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ filename, lang: newLang })
        });
        const result = await resp.json();
    } catch (e) {
        console.error("Preparation failed:", e);
    } finally {
        clearInterval(interval);
        setAnalyzingPage(100);
        setTimeout(() => {
            setIsAnalyzing(false);
            setCurrentLang(newLang);
            setSummaryData('');
            // Reset audio so it re-generates in the new language
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setAudioUrl(null);
            setIsPlaying(false);
        }, 500);
    }
  };

  const handleVoiceCommand = (command, value) => {
    switch (command) {
      case 'next': {
        const next = Math.min(currentPage + 1, numPages);
        setCurrentPage(next);
        if (data.is_pdf) scrollToPdfPage(next);
        break;
      }
      case 'prev': {
        const prev = Math.max(currentPage - 1, 1);
        setCurrentPage(prev);
        if (data.is_pdf) scrollToPdfPage(prev);
        break;
      }
      case 'meaning':
        handleToolClick('meaning');
        break;
      case 'summary':
        handleToolClick('summary');
        break;
      case 'ask':
        handleToolClick('ask');
        break;
      case 'read':
        if (audioUrl) {
            if (!isPlaying) togglePlayback();
        } else {
            handleStartNarration();
        }
        break;
      case 'pause':
        if (isPlaying) togglePlayback();
        break;
      case 'highlight':
        handleHighlight();
        break;
      case 'translate':
        if (value) selectLanguage(value);
        else handleReadTranslationClick();
        break;
      case 'text':
        setShowText(prev => !prev);
        break;
      case 'search':
        setShowSearch(prev => !prev);
        break;
      case 'focus':
        setIsReadMode(prev => !prev);
        break;
      default:
        console.log("Unknown voice command:", command);
    }
  };

  const isAutoScrollingRef = useRef(false);

  const scrollToPdfPage = (pageNumber) => {
    if (viewerRef.current) {
        const pageEl = viewerRef.current.querySelector(`[data-page-number="${pageNumber}"]`);
        if (pageEl) {
            isAutoScrollingRef.current = true;
            pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setCurrentPage(pageNumber);
            // Reset auto-scrolling flag after smooth scroll completes
            setTimeout(() => {
                isAutoScrollingRef.current = false;
            }, 1000);
        }
    }
  };

  const handlePdfScroll = () => {
    if (!viewerRef.current || !data?.is_pdf || isAutoScrollingRef.current) return;
    
    const container = viewerRef.current;
    const pageElements = container.querySelectorAll('[data-page-number]');
    let mostVisiblePage = currentPage;
    let maxVisibleHeight = 0;

    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;

    pageElements.forEach((el) => {
      const pageTop = el.offsetTop;
      const pageBottom = pageTop + el.offsetHeight;
      const pageNum = parseInt(el.getAttribute('data-page-number'), 10);

      const visibleTop = Math.max(containerTop, pageTop);
      const visibleBottom = Math.min(containerBottom, pageBottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      if (visibleHeight > maxVisibleHeight) {
        maxVisibleHeight = visibleHeight;
        mostVisiblePage = pageNum;
      }
    });

    if (mostVisiblePage !== currentPage && mostVisiblePage > 0) {
      setCurrentPage(mostVisiblePage);
    }
  };

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setPdfError(false);
  }



  // Selection Meaning States
  const [selection, setSelection] = useState(null); // { text: '', x: 0, y: 0, range: null, isHighlight: false }
  const [word, setWord] = useState('');
  const [activeHighlight, setActiveHighlight] = useState(null);

  // Lifted Audio State
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // Narration (page-by-page Read Aloud) state
  const [isNarrating, setIsNarrating] = useState(false);
  const [narratingPage, setNarratingPage] = useState(0);
  const isNarratingRef = useRef(false); // Ref avoids stale closure in onended callback
  const narratingPageRef = useRef(0);

  const startNarration = async (pageNum) => {
    if (!data || pageNum < 1 || pageNum > numPages) {
      // Finished or out of range — stop narration cleanly
      setIsNarrating(false);
      isNarratingRef.current = false;
      setIsPlaying(false);
      setNarratingPage(0);
      narratingPageRef.current = 0;
      setAiResult(''); // Clear the narrating state from ToolPanel
      return;
    }

    // Navigate to the page being narrated
    setCurrentPage(pageNum);
    setNarratingPage(pageNum);
    narratingPageRef.current = pageNum;
    if (data.is_pdf) scrollToPdfPage(pageNum);

    const pageText = pages[pageNum - 1]?.replace(/--- [\s\S]+? \d+ ---/gi, '').trim();
    if (!pageText || pageText.length < 2) {
      // Skip empty or purely marker-based pages
      if (isNarratingRef.current) startNarration(pageNum + 1);
      return;
    }

    try {
      const resp = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams({ text: pageText, filename, lang: currentLang })
      });
      const result = await resp.json();
      if (result.error) {
        console.error('TTS error from backend:', result.error);
        alert(`Read Aloud failed: ${result.error}`);
        setIsNarrating(false);
        isNarratingRef.current = false;
        return;
      }
      if (result.audio_url) {
        // Reuse audio object or create new one only if necessary
        let audio = audioRef.current;
        if (!audio) {
          audio = new Audio();
          audioRef.current = audio;
        } else {
          audio.pause();
          audio.src = '';
        }
        
        audio.preload = 'auto';
        audio.src = result.audio_url;
        audio.volume = 1.0;
        audio.muted = false;
        setAudioUrl(result.audio_url);

        audio.onended = () => {
          if (isNarratingRef.current) {
            startNarration(narratingPageRef.current + 1);
          } else {
            setIsPlaying(false);
            setAiResult(''); // Narration finished
          }
        };

        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setIsPlaying(false);
          // Try to continue to next page even on error
          if (isNarratingRef.current) {
            startNarration(narratingPageRef.current + 1);
          }
        };

        try {
          await audio.play();
          setIsPlaying(true);
        } catch (playErr) {
          console.error('audio.play() rejected:', playErr);
          // Removed alert per user request
          setIsPlaying(false);
          setIsNarrating(false);
          isNarratingRef.current = false;
        }
      }
    } catch (err) {
      console.error('Narration error:', err);
      setIsNarrating(false);
      isNarratingRef.current = false;
    }
  };

  const stopNarration = () => {
    setIsNarrating(false);
    isNarratingRef.current = false;
    setIsPlaying(false);
    setNarratingPage(0);
    narratingPageRef.current = 0;
    setAiResult(''); // Clear the narrating state from ToolPanel
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setAudioUrl(null);
  };

  const handleStartNarration = () => {
    setIsNarrating(true);
    isNarratingRef.current = true;
    setAiResult('narrator_active'); // Notify ToolPanel to show narration view
    setResultTab('speak');
    setShowPanel(true);
    
    // Pre-initialize audio to capture user gesture
    if (!audioRef.current) {
        audioRef.current = new Audio();
    }
    audioRef.current.play().catch(() => {}); // Capture gesture
    
    startNarration(currentPage);
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleMouseUp = (e) => {
    // Check if we clicked an existing highlight
    const highlightEl = e.target.closest('.user-highlight');
    if (highlightEl) {
      const rect = highlightEl.getBoundingClientRect();
      setSelection({
        text: highlightEl.innerText,
        x: rect.left + rect.width / 2,
        y: rect.top < 100 ? rect.bottom + 10 : rect.top,
        isHighlight: true
      });
      setActiveHighlight(highlightEl);
      return;
    }

    // Small timeout to let selection settle
    setTimeout(() => {
      const selected = window.getSelection().toString().trim();
      if (selected && selected.length >= 1) {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          setSelection({
            text: selected,
            x: rect.left + rect.width / 2,
            y: rect.top < 100 ? rect.bottom + 10 : rect.top, // Show below if at the very top, otherwise above
            range: range.cloneRange() // Store the range for highlighting
          });
          
          // Auto-fill the word in the meaning tool if panel is open or about to open
          setWord(selected);
        }
      } else {
        // If clicking away (not on the floating menu or header icons), clear selection
        if (!e.target.closest('.floating-context-menu') && !e.target.closest('.header-icon-container')) {
          setSelection(null);
          setWord('');
          setActiveHighlight(null);
        }
      }
    }, 10);
  };

  useEffect(() => {
    if (data && data.text) {
        const parsed = parsePages(data.text);
        setPages(parsed);
        if (!data.is_pdf && parsed.length > 0) {
            setNumPages(parsed.length);
            setCurrentPage(1);
        }
    }
  }, [data]);

  const handleHighlight = () => {
    if (selection && selection.range) {
      try {
        const range = selection.range;
        const highlightId = 'hl-' + Date.now();
        const nodes = [];
        
        if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
          nodes.push(range.startContainer);
        } else {
          const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );

          let currentNode = walker.nextNode();
          while (currentNode) {
            if (range.intersectsNode(currentNode)) {
              nodes.push(currentNode);
            }
            currentNode = walker.nextNode();
          }
        }

        nodes.forEach((node) => {
          try {
            const nodeRange = document.createRange();
            nodeRange.selectNodeContents(node);
            
            if (node === range.startContainer) nodeRange.setStart(node, range.startOffset);
            if (node === range.endContainer) nodeRange.setEnd(node, range.endOffset);

            if (nodeRange.toString().length > 0) {
                const span = document.createElement('span');
                span.className = 'user-highlight';
                span.setAttribute('data-highlight-id', highlightId);
                
                // Using extract/insert for maximum robustness
                const content = nodeRange.extractContents();
                span.appendChild(content);
                nodeRange.insertNode(span);
            }
          } catch (err) {
            console.warn("Highlight error:", err);
          }
        });

        window.getSelection().removeAllRanges();
        setSelection(null);
      } catch (e) {
        console.error("Highlighting failed: ", e);
        setSelection(null);
      }
    }
  };

  const handleSpeakSelection = async (selectedText) => {
    if (!selectedText) return;
    
    // Toggle behavior: if already playing, pause and return
    if (isPlaying && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        return;
    }
    
    // Stop any existing narration before starting new one
    if (audioRef.current) {
        audioRef.current.pause();
    }

    try {
        const resp = await fetch('/api/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
            body: new URLSearchParams({ text: selectedText, filename, lang: currentLang })
        });
        const data = await resp.json();
        if (data.audio_url) {
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
            } catch (pErr) {
                console.error("Speak selection play error:", pErr);
                // Removed alert per user request
                setIsPlaying(false);
            }
        }
    } catch (err) {
        console.error("Speak Selection Error:", err);
    }
  };

  const handleUnhighlight = () => {
    if (activeHighlight) {
      const highlightId = activeHighlight.getAttribute('data-highlight-id');
      
      if (highlightId) {
        // Collect all parts of this highlight group
        const allParts = document.querySelectorAll(`.user-highlight[data-highlight-id="${highlightId}"]`);
        allParts.forEach(part => {
          const parent = part.parentNode;
          while (part.firstChild) {
            parent.insertBefore(part.firstChild, part);
          }
          parent.removeChild(part);
        });
      } else {
        // Fallback for older highlights without ID
        const parent = activeHighlight.parentNode;
        while (activeHighlight.firstChild) {
          parent.insertBefore(activeHighlight.firstChild, activeHighlight);
        }
        parent.removeChild(activeHighlight);
      }
      
      setSelection(null);
      setActiveHighlight(null);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/read/${filename}?lang=${currentLang}`);
      const result = await resp.json();
      setData(result);

      // Auto-detect language synchronization: 
      // If no language is explicitly set (default is 'en'), 
      // and we are NOT in translation mode (user intentionally chose 'en'), 
      // auto-switch to the book's true original language.
      if (!hasAutoSetLang && result.detected_lang && result.detected_lang !== currentLang && currentLang === 'en') {
        setHasAutoSetLang(true);
        setCurrentLang(result.detected_lang);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    if (!data || !data.text || summaryData || isFetchingSummary) return;
    setIsFetchingSummary(true);
    try {
        const resp = await fetch('/api/summarize_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
            body: new URLSearchParams({ filename, lang: currentLang, text: data.text })
        });
        const result = await resp.json();
        if (result.summary) {
            setSummaryData(result.summary);
        }
    } catch (err) {
        console.error("BG Summary Fetch Error:", err);
    } finally {
        setIsFetchingSummary(false);
    }
  };

  useEffect(() => {
    if (data && data.text && !summaryData) {
        fetchSummary();
    }
  }, [data, currentLang]);

  useEffect(() => {
    fetchData();
  }, [filename, currentLang]);
    
  useEffect(() => {
    // Attempt to attach listener to iframe for PDF selection
    const handleIframeMouseUp = () => {
      const iframe = document.querySelector('iframe');
      if (iframe) {
        try {
          const iframeWindow = iframe.contentWindow;
          const selected = iframeWindow.getSelection().toString().trim();
          if (selected && selected.length > 1) {
            const range = iframeWindow.getSelection().getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const iframeRect = iframe.getBoundingClientRect();
            
            setSelection({
              text: selected,
              x: iframeRect.left + rect.left + rect.width / 2,
              y: iframeRect.top + rect.top - 60,
              range: null // Native iframe selection ranges can't be modified cross-origin easily
            });
            setWord(selected);
          }
        } catch (e) {
          // Browser prevented access to iframe (common for native PDF viewer)
          console.log("Iframe selection access denied or not possible.");
        }
      }
    };

    const iframe = document.querySelector('iframe');
    if (iframe) {
      iframe.onload = () => {
        try {
          iframe.contentDocument.addEventListener('mouseup', handleIframeMouseUp);
        } catch (e) {
          console.log("Could not attach listener to iframe document.");
        }
      };
    }
    
    return () => {
      if (iframe && iframe.contentDocument) {
        try {
          iframe.contentDocument.removeEventListener('mouseup', handleIframeMouseUp);
        } catch (e) {}
      }
    };
  }, [filename, currentLang]);

  if (loading) return (
    <div className="loading-overlay active">
      <div className="magic-book-container"><div className="magic-book"></div></div>
      <p style={{ color: 'white', marginTop: '20px' }}>Reading {filename}...</p>
    </div>
  );

  if (!data) return <div>Error loading book.</div>;

  const handleToolClick = (tabId) => {
    setActiveTab(tabId);
    setShowPanel(true);
  };

  const handleTranslateScroll = (e) => {
    if (viewerRef.current) {
        viewerRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const highlightText = (text, highlight) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? 
            <mark key={i} className="search-highlight">{part}</mark> : 
            part
        )}
      </span>
    );
  };

  return (
    <div className={`reader-root ${isReadMode ? 'read-mode-active' : ''}`} onMouseUp={handleMouseUp}>
      <Header 
        showBack={true}
        hideNav={true}
        togglePlayback={togglePlayback}
      >
        <div className="header-icon-container" title="Extracted Text" onClick={() => setShowText(!showText)}>
          <div className="header-icon"><FileText size={18} color="#faedcd" /></div>
          <span className="header-icon-label">Text</span>
        </div>
        <div className="header-icon-container" title="Summarize" onClick={() => handleToolClick('summary')}>
          <div className="header-icon"><Info size={18} color="#faedcd" /></div>
          <span className="header-icon-label">Summary</span>
        </div>
        <div className="header-icon-container" title="Ask AI" onClick={() => handleToolClick('ask')}>
          <div className="header-icon"><MessageSquare size={18} color="#faedcd" /></div>
          <span className="header-icon-label">Ask AI</span>
        </div>
        <div className="header-icon-container" title="Listen" onClick={() => {
            if (audioUrl) {
                togglePlayback();
            } else {
                handleToolClick('speak');
            }
        }}>
          <div className="header-icon">
            {audioUrl && isPlaying ? <Pause size={18} color="#e07a5f" /> : <Volume2 size={18} color={audioUrl ? "#e07a5f" : "#faedcd"} />}
          </div>
          <span className="header-icon-label" style={{ color: audioUrl ? "#e07a5f" : "#faedcd" }}>
            {audioUrl && isPlaying ? "Pause" : "Listen"}
          </span>
        </div>
        <div className="header-icon-container" title="Meaning" onClick={() => handleToolClick('meaning')}>
          <div className="header-icon"><Book size={18} color="#faedcd" /></div>
          <span className="header-icon-label">Meaning</span>
        </div>
        <div className={`header-icon-container ${currentLang.toLowerCase() !== (data?.detected_lang || 'en').toLowerCase() ? 'active-translation' : ''}`} title="Translation" onClick={() => handleReadTranslationClick()}>
          <div className="header-icon"><Languages size={18} color="#faedcd" /></div>
          <span className="header-icon-label">Translation</span>
          {currentLang.toLowerCase() !== (data?.detected_lang || 'en').toLowerCase() && <div className="translation-pulse"></div>}
        </div>
        <div className={`header-icon-container search-btn-premium ${showSearch ? 'active' : ''}`} title="Search" onClick={() => setShowSearch(!showSearch)}>
          <div className="header-icon">
            <Search size={18} color={showSearch ? "#ffffff" : "#faedcd"} />
            <div className="search-icon-pulse"></div>
          </div>
          <span className="header-icon-label">Search</span>
        </div>
        <div className={`header-icon-container ${voiceActive ? 'active-voice' : ''}`} title={voiceActive ? "Disable Voice Control" : "Enable Voice Control"} onClick={() => setVoiceActive(!voiceActive)}>
          <div className="header-icon">
            {voiceActive ? <Mic size={18} color="#e07a5f" /> : <MicOff size={18} color="#faedcd" />}
            {voiceActive && <div className="voice-icon-pulse"></div>}
          </div>
          <span className="header-icon-label" style={{ color: voiceActive ? "#e07a5f" : "#faedcd" }}>Voice</span>
        </div>
        
        <div className={`header-icon-container ${isReadMode ? 'active-focus' : ''}`} title={isReadMode ? "Disable Focus Mode" : "Enable Focus Mode"} onClick={() => setIsReadMode(!isReadMode)}>
          <div className="header-icon">
            <Highlighter size={18} color={isReadMode ? "#ffffff" : "#faedcd"} style={{ transform: 'rotate(45deg)' }} />
          </div>
          <span className="header-icon-label" style={{ color: isReadMode ? "#e07a5f" : "#faedcd" }}>Focus</span>
        </div>
        </Header>

        {showSearch && (
          <div className="search-bar-inline">
            <div className="search-input-wrapper">
              <Search size={20} className="search-icon-inner" />
              <input 
                type="text" 
                placeholder="Search text or type a page number (e.g. 5)…" 
                value={searchTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchTerm(val);
                  // Page jump detection: pure number, 'p5', or 'page 5'
                  const pageMatch = val.trim().match(/^(?:p(?:age)?\s*)?(\d+)$/i);
                  if (pageMatch) {
                    const target = parseInt(pageMatch[1], 10);
                    if (target >= 1 && target <= numPages) {
                      setPageJumpMsg(`Jumping to page ${target}`);
                      setCurrentPage(target);
                      if (data.is_pdf) scrollToPdfPage(target);
                    } else {
                      setPageJumpMsg(`Page ${target} out of range (1–${numPages})`);
                    }
                  } else {
                    setPageJumpMsg('');
                  }
                }}
                autoFocus
              />
              {searchTerm && (
                <CloseIcon 
                  size={18} 
                  className="clear-search" 
                  onClick={() => { setSearchTerm(''); setPageJumpMsg(''); }} 
                />
              )}
            </div>
            {pageJumpMsg && (
              <div className="page-jump-badge">{pageJumpMsg}</div>
            )}
          </div>
        )}

        <div className="book-title-section">
            <h1 className="book-display-title">{data?.filename}</h1>

        </div>
      
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <ToolPanel 
          active={showPanel} 
          onClose={() => { setShowPanel(false); setWord(''); }} 
          filename={filename} 
          text={data.text}
          lang={currentLang}
          detectedLang={data?.detected_lang}
          detectedLangName={data?.detected_lang_name}
          externalTab={activeTab}
          initialWord={word}
          initialSummary={summaryData}
          isFetchingSummary={isFetchingSummary}
          onLanguageChange={(newLang) => {
            setCurrentLang(newLang);
            setSummaryData(''); // Reset summary so it re-fetches in new language
            if (audioRef.current) {
                audioRef.current.pause();
                setAudioUrl(null);
                setIsPlaying(false);
            }
          }}
          audioUrl={audioUrl}
          setAudioUrl={setAudioUrl}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          audioRef={audioRef}
          togglePlayback={togglePlayback}
          isNarrating={isNarrating}
          narratingPage={narratingPage}
          onStartNarration={handleStartNarration}
          onStopNarration={stopNarration}
          currentViewPage={currentPage}
        />

        <div style={{ flex: 1, display: 'flex', padding: '10px', gap: '10px', overflow: 'hidden', position: 'relative' }}>
          {/* Decorative Side Animation */}
          <div className="side-decoration-left">
              <div className="mini-book-wrapper">
                  <div className="magic-glow"></div>
                  <div className="mini-book">
                      <div className="mini-page"></div>
                      <div className="mini-page"></div>
                      <div className="mini-page"></div>
                  </div>
              </div>
          </div>

          {/* Main Document Viewer with Immersive Translation Overlay */}
          <div className={`original-file-viewer ${currentLang.toLowerCase() !== (data?.detected_lang || 'en').toLowerCase() ? 'translating' : ''}`} style={{ flex: 1, display: 'flex', background: 'transparent', borderRadius: '12px', position: 'relative' }}>
            <div className="viewer-content">
              {/* Illustrations/Background are ALWAYS shows now */}
              {data.is_pdf ? (
                <div 
                    ref={viewerRef} 
                    onScroll={handlePdfScroll}
                    style={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', scrollBehavior: 'smooth' }}
                >
                  {pdfError ? (
                    <div className="error-preview">Failed to load PDF locally.</div>
                  ) : (
                    <Document
                      file={`/uploads/${data.preview_filename}`}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={(error) => { console.error('Error loading PDF:', error); setPdfError(true); }}
                      loading={<div style={{ padding: '20px' }}>Loading PDF...</div>}
                      className="pdf-document"
                    >
                      {Array.from(new Array(numPages || 0), (el, index) => {
                        const pageNum = index + 1;
                        // For small books ( < 40 pages), show everything. For large books, use a +/- 5 page buffer.
                        const isVisible = (numPages <= 40) || (Math.abs(pageNum - currentPage) <= 5);
                        
                        return (
                          <div
                            key={`page_${pageNum}`}
                            data-page-number={pageNum}
                            style={{ 
                              position: 'relative', 
                              minHeight: isVisible ? 'auto' : '820px',
                              width: '100%',
                              display: 'flex',
                              justifyContent: 'center',
                              padding: '20px 0',
                              background: 'transparent'
                            }}
                            className={isNarrating && narratingPage === pageNum ? 'is-narrating-pdf' : ''}
                          >
                            {isNarrating && narratingPage === pageNum && (
                              <div className="narrating-badge pdf-narrating-badge">
                                <span className="reading-bar"></span>
                                <span className="reading-bar"></span>
                                <span className="reading-bar"></span>
                                <span style={{ marginLeft: '8px' }}>Reading Page {pageNum}</span>
                              </div>
                            )}
                            
                            {isVisible ? (
                              <>
                                <Page 
                                  pageNumber={pageNum} 
                                  width={Math.min(window.innerWidth * 0.8, 800)}
                                  renderAnnotationLayer={true}
                                  renderTextLayer={true}
                                  loading={<div style={{ height: '800px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)' }}>Loading content...</div>}
                                />
                                {currentLang.toLowerCase() !== (data?.detected_lang || 'en').toLowerCase() && pages[index] && (
                                  <div className="page-translation-overlay">
                                      <div className="page-translation-card">
                                          {pages[index]}
                                      </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div style={{ height: '800px', width: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '2px dashed rgba(0,0,0,0.1)' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div className="magic-book-tiny"></div>
                                    <p style={{ marginTop: '10px' }}>Magic Gathering Content...</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </Document>
                  )}
                </div>
              ) : (!data.is_pdf && !data.is_image && !data.is_video && pages.length > 0) ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className={`react-pdf-page book-text-page ${isNarrating ? 'is-narrating' : ''}`}>
                        {isNarrating && (
                          <div className="narrating-badge">
                            <span className="reading-bar"></span>
                            <span className="reading-bar"></span>
                            <span className="reading-bar"></span>
                            <span className="reading-bar"></span>
                            <span className="reading-bar"></span>
                            <span style={{ marginLeft: '8px', fontSize: '0.8rem' }}>Reading Page {narratingPage}</span>
                          </div>
                        )}
                        <div className="book-text-content">
                            {highlightText(pages[currentPage - 1], searchTerm)}
                        </div>
                    </div>
                    {currentLang.toLowerCase() !== (data?.detected_lang || 'en').toLowerCase() && (
                        <div className="page-translation-overlay">
                            <div className="page-translation-card">
                                {pages[currentPage - 1]}
                            </div>
                        </div>
                    )}
                    
                    {/* Navigation for non-PDF pages */}
                    <div className="pdf-navigation" style={{ marginTop: '20px' }}>
                        <button 
                            className="nav-btn" 
                            disabled={currentPage <= 1} 
                            onClick={() => setCurrentPage(prev => prev - 1)}
                        >
                            <ChevronLeft size={20} /> Previous
                        </button>
                        <span className="page-info">
                            Page {currentPage} of {numPages}
                        </span>
                        <button 
                            className="nav-btn" 
                            disabled={currentPage >= numPages} 
                            onClick={() => setCurrentPage(prev => prev + 1)}
                        >
                            Next <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
              ) : data.is_office ? (
                <div style={{ position: 'relative' }}>
                    <div dangerouslySetInnerHTML={{ __html: data.office_html }} className="office-viewer" />
                    {currentLang.toLowerCase() !== (data?.detected_lang || 'en').toLowerCase() && data.text && (
                        <div className="page-translation-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                            <div className="page-translation-card">
                                {data.text}
                            </div>
                        </div>
                    )}
                </div>
              ) : data.is_image ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={`/uploads/${data.filename}`} alt="Book Page" style={{ objectFit: 'contain' }} />
                    {currentLang.toLowerCase() !== (data?.detected_lang || 'en').toLowerCase() && data.text && (
                        <div className="page-translation-overlay">
                            <div className="page-translation-card">
                                {data.text}
                            </div>
                        </div>
                    )}
                </div>
              ) : data.is_video ? (
                <video src={`/uploads/${data.filename}`} controls />
              ) : null}
            </div>
          </div>

          {/* Decorative Right Side Animation */}
          <div className="side-decoration-right">
              <div className="mini-book-wrapper">
                  <div className="magic-glow"></div>
                  <div className="mini-book">
                      <div className="mini-page"></div>
                      <div className="mini-page"></div>
                      <div className="mini-page"></div>
                  </div>
              </div>
          </div>

          {/* Floating selection buttons */}
          {selection && (
            <div 
              className="floating-context-menu"
              style={{ 
                left: selection.x, 
                top: selection.y, 
                transform: 'translateX(-50%) translateY(-100%)',
                marginTop: '-10px',
                position: 'fixed',
                display: 'flex',
                gap: '8px',
                background: '#4a342e',
                padding: '8px 12px',
                borderRadius: '8px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                zIndex: 10001,
                border: '1px solid #d4a373'
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <div
                onClick={(e) => { 
                  e.stopPropagation(); 
                  handleToolClick('meaning');
                  setSelection(null);
                }}
                className="context-menu-btn"
                title="Find Meaning"
              >
                <Book size={18} />
                <span>Meaning</span>
              </div>

              <div
                onClick={(e) => { 
                  e.stopPropagation(); 
                  handleSpeakSelection(selection.text);
                }}
                className="context-menu-btn"
                title="Read Aloud"
              >
                {isPlaying ? <Pause size={18} color="#e07a5f" /> : <Volume2 size={18} />}
                <span>Speak</span>
              </div>
              
              {selection.isHighlight ? (
                <div
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    handleUnhighlight();
                  }}
                  className="context-menu-btn"
                  title="Remove Highlight"
                  style={{ color: '#e74c3c' }}
                >
                  <Highlighter size={18} />
                  <span>Unhighlight</span>
                </div>
              ) : selection.range && (
                <div
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    handleHighlight();
                  }}
                  className="context-menu-btn"
                  title="Highlight Text"
                >
                  <Highlighter size={18} />
                  <span>Highlight</span>
                </div>
              )}
            </div>
          )}

          {/* Overlay Text Extraction Modal */}

          {showText && (
            <div className="text-modal-overlay" onClick={() => setShowText(false)}>
              <div className="text-modal-content" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: '#4a342e', fontFamily: "'Alice', serif" }}>Extracted Book Text</h3>
                  <button onClick={() => setShowText(false)} style={{ margin: 0, background: '#e74c3c', padding: '8px 15px' }}>Close</button>
                </div>
                <div className="text-modal-body">
                  {highlightText((data.text || "").replace(/--- (?:Page|Slide) \d+ ---/g, "").trim(), searchTerm) || "No text could be extracted from this file."}
                </div>
              </div>
            </div>
          )}
          {/* Analyzing Overlay */}
          {isAnalyzing && (
            <div className="analyzing-overlay">
                <div className="analyzing-content">
                    <div className="analyzing-scanner">
                        <div className="scan-line"></div>
                        <Languages size={60} className="analyzing-icon" />
                    </div>
                    <h2>Analyzing Book Content</h2>
                    <p>Preparing the magic ink for translation...</p>
                    <div className="analysis-progress-container">
                        <div className="analysis-progress-bar" style={{ width: `${analyzingPage}%` }}></div>
                    </div>
                    <span className="analysis-percentage">{analyzingPage}% Complete</span>
                </div>
            </div>
          )}

          {/* Language Selection Menu */}
          {showLangMenu && (
            <div className="lang-menu-overlay" onClick={() => setShowLangMenu(false)}>
                <div className="lang-menu-content" onClick={(e) => e.stopPropagation()}>
                    <div className="lang-menu-header">
                        <h3>Select Translation Language</h3>
                        <button onClick={() => setShowLangMenu(false)} className="close-lang-menu"><CloseIcon size={20} /></button>
                    </div>
                    <div className="lang-grid">
                        {allLanguages.map((item) => (
                            <div 
                                key={item.code} 
                                className={`lang-item ${currentLang === item.code ? 'active' : ''}`}
                                onClick={() => selectLanguage(item.code)}
                            >
                                <span className="lang-name">{item.name}</span>
                                {item.code === data?.detected_lang && <span className="lang-tag">Original</span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          )}

          {/* Voice Control Indicator */}
          <VoiceController 
            isActive={voiceActive} 
            setIsActive={setVoiceActive}
            onCommand={handleVoiceCommand}
            languages={allLanguages}
          />
        </div>
      </main>
    </div>
  );
};

export default ReaderPage;
