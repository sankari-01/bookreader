import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import ToolPanel from '../components/ToolPanel';
import VoiceController from '../components/VoiceController';
import ErrorBoundary from '../components/ErrorBoundary';
import {
  ChevronLeft, ChevronRight, Book, Highlighter, Search,
  X as CloseIcon, User, Volume2, Globe, Command, Keyboard, Play, Languages,
  FileText, Info, MessageSquare, BookOpen, Mic, MicOff, Download, Trash2, Sparkles,
  HelpCircle, CheckCircle2, AlertCircle, Timer, Award, ChevronRight as ChevronRightIcon,
  RotateCcw, FileImage, Loader2, Brain, Columns2, LayoutGrid, ZoomIn, ZoomOut, Square, Bookmark, List, Edit3
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the PDF.js worker using a more robust CDN link compatible with react-pdf v10
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const parsePages = (text) => {
  if (!text) return [];
  // Split by universal markers that catch any word between --- (including translated ones)
  const markerRegex = /--- [\s\S]+? \d+ ---/gi;
  const parts = text.split(markerRegex);
  
  // LOGGING: Useful for debugging narration content issues
  console.log(`[Parser] Raw split count: ${parts.length}`);

  if (parts.length > 1) {
    // Filter out parts that are essentially empty (leading markers or double splits)
    const validPages = parts.map(p => p.trim()).filter(p => p.length > 0);
    console.log(`[Parser] Valid pages found: ${validPages.length}`);
    if (validPages.length > 0) {
      console.log(`[Parser] First page snapshot: "${validPages[0].substring(0, 100)}..."`);
    }
    return validPages;
  }
  
  // If no markers found, return the whole text as Page 1 (Trimmed)
  const singlePage = [text.trim()].filter(p => p.length > 0);
  console.log(`[Parser] No markers found. Returning single page.`);
  return singlePage;
};

const FloatingZoomControls = ({ zoomLevel, setZoomLevel }) => {
  return (
    <div className="floating-zoom-controls">
      <button 
        className="zoom-btn" 
        onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))} 
        title="Zoom Out"
      >
        <ZoomOut size={20} />
      </button>
      <span className="zoom-percentage">{zoomLevel}%</span>
      <button 
        className="zoom-btn" 
        onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))} 
        title="Zoom In"
      >
        <ZoomIn size={20} />
      </button>
    </div>
  );
};

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

const COMMANDS = [
  { id: 'read', name: 'Read Aloud', icon: <BookOpen size={16} />, shortcut: 'R' },
  { id: 'summary', name: 'Summary', icon: <Info size={16} />, shortcut: 'S' },
  { id: 'translate', name: 'Translation', icon: <Languages size={16} />, shortcut: 'T' },
  { id: 'ask', name: 'Ask AI', icon: <MessageSquare size={16} />, shortcut: 'A' },
  { id: 'meaning', name: 'Meaning', icon: <Book size={16} />, shortcut: 'M' },
  { id: 'focus', name: 'Focus Mode', icon: <Highlighter size={16} />, shortcut: 'F' },
  { id: 'highlights', name: 'My Marks', icon: <Highlighter size={16} />, shortcut: 'K' },
  { id: 'quiz', name: 'Quiz', icon: <HelpCircle size={16} />, shortcut: 'Q' },
  { id: 'questions', name: 'Questions', icon: <Brain size={16} />, shortcut: 'P' },
  { id: 'images', name: 'Images', icon: <FileImage size={16} />, shortcut: 'I' },
  { id: 'text', name: 'Extract Text', icon: <FileText size={16} />, shortcut: 'X' },
  { id: 'notes', name: 'Notes', icon: <Edit3 size={16} />, shortcut: 'N' },
];

const ReaderPage = () => {
  const { filename } = useParams();
  const [searchParams] = useSearchParams();
  const [currentLang, setCurrentLang] = useState(searchParams.get('lang') || 'en');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);

  const [showText, setShowText] = useState(false);
  const [pages, setPages] = useState([]);
  const [originalPages, setOriginalPages] = useState([]);

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfError, setPdfError] = useState(false);
  const viewerRef = useRef(null);
  const officeViewerRef = useRef(null);

  const [activeTab, setActiveTab] = useState('summary');
  const [hasAutoSetLang, setHasAutoSetLang] = useState(false);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const [notes, setNotes] = useState('');

  // Search States
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchBarRef = useRef(null);
  const searchBtnRef = useRef(null);
  const [pageJumpMsg, setPageJumpMsg] = useState('');
  const [isFetchingSummary, setIsFetchingSummary] = useState(false);
  const [summaryData, setSummaryData] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [analyzingPage, setAnalyzingPage] = useState(0);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizTimer, setQuizTimer] = useState(600); // 10 minutes
  const [quizLoading, setQuizLoading] = useState(false);
  const [userHighlights, setUserHighlights] = useState(() => {
    try {
      const saved = localStorage.getItem(`highlights_${filename}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [explanationData, setExplanationData] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);

  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem(`bookmarks_${filename}`);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  });
  const [showBookmarks, setShowBookmarks] = useState(false);

  const [showImagesModal, setShowImagesModal] = useState(false);
  const [extractedImages, setExtractedImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);

  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [predictionData, setPredictionData] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionActiveTab, setPredictionActiveTab] = useState('short');
  const [showAnswers, setShowAnswers] = useState({});
  const [viewMode, setViewMode] = useState('single'); // 'single', 'double', 'thumbnails'
  const [zoomLevel, setZoomLevel] = useState(100);
  
  // Narration States (Moved up to avoid TDZ errors in useEffects)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [isNarrationLoading, setIsNarrationLoading] = useState(false);
  const [narratingPage, setNarratingPage] = useState(1);
  const [audioUrl, setAudioUrl] = useState(null);
  const [narrationSpeed, setNarrationSpeed] = useState('1.0x'); 
  const [narrationGender, setNarrationGender] = useState('f');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeCues, setActiveCues] = useState([]);
  const [activeCueIndex, setActiveCueIndex] = useState(-1);
  const [narrationVoice, setNarrationVoice] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const layoutMenuRef = useRef(null);

  const [voiceActive, setVoiceActive] = useState(false);
  const [isReadMode, setIsReadMode] = useState(false);

  // Synchronous Refs for narration parameters to avoid stale closures
  const pagesRef = useRef([]);
  const langRef = useRef(currentLang);
  const speedRef = useRef(narrationSpeed);
  const genderRef = useRef(narrationGender);
  const narrationVoiceRef = useRef(narrationVoice);
  const narrationSessionRef = useRef(0);

  // Synchronize narration refs with state to avoid stale closures
  useEffect(() => { langRef.current = currentLang; }, [currentLang]);
  useEffect(() => { speedRef.current = narrationSpeed; }, [narrationSpeed]);
  useEffect(() => { genderRef.current = narrationGender; }, [narrationGender]);
  useEffect(() => { narrationVoiceRef.current = narrationVoice; }, [narrationVoice]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  useEffect(() => { narrationSessionRef.current = 0; }, [filename]);

  const handleGenderChange = (newGender) => {
    setNarrationGender(newGender);
    genderRef.current = newGender;
    if (isNarratingRef.current) {
      const resumeIndex = activeCueIndex >= 0 ? activeCueIndex : 0;
      // Restart current page from the last known word
      startNarration(narratingPageRef.current, resumeIndex);
    }
    // Clear pre-fetch for the old gender
    preFetchedAudioRef.current = null;
    preFetchPromiseRef.current = null;
  };

  const handleSpeedChange = (newSpeed) => {
    setNarrationSpeed(newSpeed);
    speedRef.current = newSpeed;
    if (isNarratingRef.current) {
      const resumeIndex = activeCueIndex >= 0 ? activeCueIndex : 0;
      startNarration(narratingPageRef.current, resumeIndex);
    }
    preFetchedAudioRef.current = null;
    preFetchPromiseRef.current = null;
  };

  const [selection, setSelection] = useState(null); 
  const [word, setWord] = useState('');
  const [activeHighlight, setActiveHighlight] = useState(null);
  const [selectionRects, setSelectionRects] = useState([]);

  const handleMouseUp = useCallback((e) => {
    // If clicking inside the menu or header, don't clear selection yet
    if (e.target.closest('.floating-context-menu') || e.target.closest('.header-icon-container')) {
      return;
    }

    const highlightEl = e.target.closest('.user-highlight');
    // More robust scroll container detection
    const scrollContainer = viewerRef.current || e.target.closest('.viewer-content') || e.target.closest('.react-pdf__Document') || e.target.closest('.office-viewer-container');
    
    if (highlightEl && scrollContainer) {
      const rect = highlightEl.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      
      setSelection({
        text: highlightEl.innerText,
        x: rect.left + rect.width / 2 - containerRect.left,
        y: (rect.top < 100 ? rect.bottom + 10 : rect.top) - containerRect.top + scrollContainer.scrollTop,
        isHighlight: true
      });
      setActiveHighlight(highlightEl);
      return;
    }

    setTimeout(() => {
      const sel = window.getSelection();
      const selected = sel.toString().trim();
      
      if (selected && sel.rangeCount > 0 && scrollContainer) {
        const range = sel.getRangeAt(0);
        const containerRect = scrollContainer.getBoundingClientRect();
        const rangeRect = range.getBoundingClientRect();
        
        if (rangeRect.height > 2) {
          const isUserHighlighted = userHighlights.some(h => h.includes(selected) || selected.includes(h));
          
          setSelection({
            text: selected,
            x: rangeRect.left + rangeRect.width / 2 - containerRect.left,
            y: rangeRect.top - containerRect.top + scrollContainer.scrollTop,
            range: range.cloneRange(),
            isHighlight: e.target.classList.contains('user-highlight') || e.target.closest('.user-highlight') || isUserHighlighted
          });
          setActiveHighlight(e.target.closest('.user-highlight'));
          setWord(selected);
          
          // Capture rects relative to scroll container
          const rects = Array.from(range.getClientRects()).map(r => ({
            left: r.left - containerRect.left,
            top: r.top - containerRect.top + scrollContainer.scrollTop,
            width: r.width,
            height: r.height
          }));
          setSelectionRects(rects);
        } else {
          setSelection(null);
          setActiveHighlight(null);
          setSelectionRects([]);
        }
      } else {
        setSelection(null);
        setWord('');
        setActiveHighlight(null);
        setSelectionRects([]);
      }
    }, 10);
  }, [userHighlights]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const handleLanguageChange = (newLang) => {
    setCurrentLang(newLang);
    langRef.current = newLang;
    setSummaryData('');
    stopNarration();
    preFetchedAudioRef.current = null;
    preFetchPromiseRef.current = null;
  };





  useEffect(() => {
    // Global error listener for debugging
    const handleError = (e) => {
      console.error("Global captured error:", e.error || e.message);
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(`highlights_${filename}`, JSON.stringify(userHighlights));
  }, [userHighlights, filename]);

  // Handle Notebook Persistence
  useEffect(() => {
    if (filename) {
      const savedNotes = localStorage.getItem(`notes_${filename}`);
      setNotes(savedNotes || '');
    }
  }, [filename]);

  const handleNotesChange = (e) => {
    const val = e.target.value;
    setNotes(val);
    if (filename) localStorage.setItem(`notes_${filename}`, val);
  };

  // Sync Highlights & Auto-scroll for Narration
  useEffect(() => {
    if (isNarrating && activeCueIndex !== -1 && viewerRef.current) {
      // Re-apply highlights to the PDF layer for the current narrating page
      applyHighlightsToElement(viewerRef.current, activeCueIndex);
    }
  }, [activeCueIndex, isNarrating, narratingPage]);

  useEffect(() => {
    if (isNarrating && activeCueIndex !== -1 && showText) {
      // Smooth scroll the extracted text modal to the active word
      const modalBody = document.querySelector('.text-modal-body');
      const activeWord = modalBody?.querySelector('.active-narrate-word');
      if (activeWord && modalBody) {
        const topPos = activeWord.offsetTop;
        modalBody.scrollTo({
          top: topPos - modalBody.clientHeight / 2,
          behavior: 'smooth'
        });
      }
    }
  }, [activeCueIndex, isNarrating, showText]);

  // Narration States

  // Fetch Available Voices
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const resp = await fetch('/api/voices');
        const data = await resp.json();
        setAvailableVoices(data);
      } catch (e) { console.error("Failed to fetch voices:", e); }
    };
    fetchVoices();
  }, []);

  // Refs for stable narration across renders
  const isAutoScrollingRef = useRef(false);
  const audioRef = useRef(null);
  const isNarratingRef = useRef(false);
  const narratingPageRef = useRef(1);
  const preFetchedAudioRef = useRef(null); 
  const preFetchPromiseRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore key events if the user is typing in an input or textarea
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      } else if (e.code === 'ArrowRight') {
        const next = Math.min(currentPage + 1, numPages);
        if (next !== currentPage) {
          setCurrentPage(next);
          if (data?.is_pdf) scrollToPdfPage(next);
          else scrollToTextPage(next);
        }
      } else if (e.code === 'ArrowLeft') {
        const prev = Math.max(currentPage - 1, 1);
        if (prev !== currentPage) {
          setCurrentPage(prev);
          if (data?.is_pdf) scrollToPdfPage(prev);
          else scrollToTextPage(prev);
        }
      } else {
        const key = e.key.toLowerCase();
        if (key === 't') { e.preventDefault(); handleReadTranslationClick(); }
        else if (key === 'f') { e.preventDefault(); setIsReadMode(!isReadMode); }
        else if (key === 'v') { e.preventDefault(); setVoiceActive(!voiceActive); }
        else if (key === 'x') { e.preventDefault(); setShowText(!showText); }
        else if (key === '/') { e.preventDefault(); setShowSearch(!showSearch); }
        else if (key === 'k') { e.preventDefault(); setShowHighlights(true); }
        else if (key === 'b') { e.preventDefault(); toggleBookmark(currentPage); }
        else if (key === 'q') { e.preventDefault(); handleStartQuiz(); }
        else if (key === 'p') { e.preventDefault(); handleStartPrediction(); }
        else if (key === 'i') { e.preventDefault(); if (data?.has_images) handleExtractImages(); }
        else if (key === 'n') { e.preventDefault(); setIsNotebookOpen(!isNotebookOpen); }
        // These rely on handleToolClick
        else if (key === 's') { e.preventDefault(); handleToolClick('summary'); }
        else if (key === 'a') { e.preventDefault(); handleToolClick('ask'); }
        else if (key === 'r') { e.preventDefault(); handleToolClick('speak'); if (!isNarrating) startNarration(); }
        else if (key === 'm') { e.preventDefault(); handleToolClick('meaning'); }
      }
    };

    const handleClickOutside = (e) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target)) {
        setShowLayoutMenu(false);
      }
      if (searchBarRef.current && !searchBarRef.current.contains(e.target) && searchBtnRef.current && !searchBtnRef.current.contains(e.target)) {
        setShowSearch(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    filename, currentLang, numPages, currentPage, isNarrating, 
    showSearch, voiceActive, showText, isReadMode, data, isPlaying, isNotebookOpen
  ]);


  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (isNarratingRef.current) {
      console.log("Narration settings changed, restarting current page audio...");
      preFetchedAudioRef.current = null;
      preFetchPromiseRef.current = null;
      playPage(narratingPageRef.current);
    }
  }, [narrationSpeed, narrationGender, currentLang, pages]);


  const handleReadTranslationClick = () => {
    if (currentLang.toLowerCase() !== (data?.detected_lang || 'en').toLowerCase()) {
      setShowLangMenu(true);
    } else {
      setIsAnalyzing(true);
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
    
    if (newLang === 'original' || newLang === (data?.detected_lang || 'en')) {
      setCurrentLang(data?.detected_lang || 'en');
      setShowOverlay(false);
      setSummaryData('');
      preFetchedAudioRef.current = null;
      preFetchPromiseRef.current = null;
      return;
    }

    setShowOverlay(true);
    setIsAnalyzing(true);
    setAnalyzingPage(0);

    // Start the 'Analyzing' animation immediately to give the "magic" feel
    let p = 0;
    const interval = setInterval(() => {
      p += 5;
      if (p > 98) p = 98; 
      setAnalyzingPage(p);
    }, 60);

    try {
      // Fetch the translation status
      const resp = await fetch('/api/prepare_translation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ filename, lang: newLang })
      });
      const result = await resp.json();
      
      // Even if it's 'ready', we wait a brief moment to let the animation play (satisfying UX)
      const minimumDelay = 1500; // 1.5 seconds minimum for the magic feel
      setTimeout(() => {
        clearInterval(interval);
        setAnalyzingPage(100);
        
        setTimeout(() => {
          setIsAnalyzing(false);
          setCurrentLang(newLang);
          setSummaryData('');
          // Clear pre-fetched audio when language changes
          preFetchedAudioRef.current = null;
          preFetchPromiseRef.current = null;
        }, 400);
      }, minimumDelay);

    } catch (e) {
      console.error("Preparation failed:", e);
      clearInterval(interval);
      setIsAnalyzing(false);
    }
  };
  const handleVoiceCommand = (command, value) => {
    switch (command) {
      case 'next': {
        const next = Math.min(currentPage + 1, numPages);
        setCurrentPage(next);
        if (data?.is_pdf) scrollToPdfPage(next);
        break;
      }
      case 'prev': {
        const prev = Math.max(currentPage - 1, 1);
        setCurrentPage(prev);
        if (data?.is_pdf) scrollToPdfPage(prev);
        break;
      }
      case 'jump': {
        if (value && !isNaN(value)) {
          const targetPage = Math.max(1, Math.min(parseInt(value, 10), numPages));
          setCurrentPage(targetPage);
          if (data?.is_pdf) scrollToPdfPage(targetPage);
        }
        break;
      }
      case 'meaning': handleToolClick('meaning'); break;
      case 'summary': handleToolClick('summary'); break;
      case 'ask': handleToolClick('ask'); break;
      case 'highlight': handleHighlight(); break;
      case 'translate':
        if (value) selectLanguage(value);
        else handleReadTranslationClick();
        break;
      case 'text': setShowText(prev => !prev); break;
      case 'search': setShowSearch(prev => !prev); break;
      case 'focus': setIsReadMode(prev => !prev); break;
      case 'read': 
        if (value && !isNaN(value)) {
          const targetPage = Math.max(1, Math.min(parseInt(value, 10), numPages));
          setCurrentPage(targetPage);
          if (data?.is_pdf) scrollToPdfPage(targetPage);
          // Start narration for that page
          setTimeout(() => {
            handleToolClick('speak');
            startNarration();
          }, 500);
        } else if (selection && selection.text) {
          handleReadSelection();
        } else {
          handleToolClick('speak'); 
          startNarration(); 
        }
        break;
      case 'pause': 
      case 'stop':
        stopNarration();
        break;
      default: 
        if (command) {
          const matchedLang = allLanguages.find(l => 
            command.toLowerCase() === l.name.toLowerCase() || 
            command.toLowerCase() === l.code.toLowerCase()
          );
          if (matchedLang) {
            selectLanguage(matchedLang.code);
            break;
          }
        }
        console.log("Unknown voice command:", command);
    }
  };

  const latestVoiceCommandRef = useRef(handleVoiceCommand);
  useEffect(() => {
    latestVoiceCommandRef.current = handleVoiceCommand;
  });

  const stableVoiceCommand = React.useCallback((cmd, val) => {
    latestVoiceCommandRef.current(cmd, val);
  }, []);

  const scrollToPdfPage = (pageNumber) => {
    if (viewerRef.current) {
      const pageEl = viewerRef.current.querySelector(`[data-page-number="${pageNumber}"]`);
      if (pageEl) {
        isAutoScrollingRef.current = true;
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setCurrentPage(pageNumber);
        setTimeout(() => { isAutoScrollingRef.current = false; }, 1000);
      }
    }
  };

  const scrollToTextPage = (pageNumber) => {
    if (viewerRef.current) {
      const pageEl = viewerRef.current.querySelector(`#page-${pageNumber}`);
      if (pageEl) {
        isAutoScrollingRef.current = true;
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setCurrentPage(pageNumber);
        setTimeout(() => { isAutoScrollingRef.current = false; }, 1000);
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

  const stopNarration = () => {
    isNarratingRef.current = false;
    narrationSessionRef.current += 1; // Invalidate any in-flight fetches
    setIsNarrating(false);
    setIsPlaying(false);
    setIsNarrationLoading(false);
    setActiveCueIndex(-1);
    setActiveCues([]);
    if (audioRef.current) {
      audioRef.current.pause();
      // Use a silent source rather than empty string to cleanly stop loading
      audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      audioRef.current.load();
    }
  };

  const restartNarration = () => {
    stopNarration();
    setTimeout(() => { startNarration(1); }, 100);
  };

  const parseVTT = (vttText) => {
    if (!vttText) return [];
    const cues = [];
    const normalized = vttText.replace(/\r\n/g, '\n');
    const blocks = normalized.split(/\n\n+/);
    blocks.forEach(block => {
      const match = block.match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\n+(.*)/s);
      if (match) {
        try {
          const startRaw = match[1].split(':');
          const startSec = (parseInt(startRaw[0]) * 3600) + (parseInt(startRaw[1]) * 60) + parseFloat(startRaw[2]);
          const endRaw = match[2].split(':');
          const endSec = (parseInt(endRaw[0]) * 3600) + (parseInt(endRaw[1]) * 60) + parseFloat(endRaw[2]);
          cues.push({ start: startSec, end: endSec, word: match[3].trim() });
        } catch (e) { console.warn("VTT parse block error:", e); }
      }
    });
    return cues;
  };

  const log_error = (msg) => {
    console.error(`[ReaderPage Error] ${msg}`);
  };

  const startNarration = async (startPage = null, startWordIndex = 0) => {
    const isMidPageResume = startWordIndex > 0;
    
    // If already narrating and user clicked 'Read' again without a specific page, toggle stop.
    if (isNarratingRef.current && startPage === null && !isMidPageResume) {
      stopNarration();
      return;
    }
    
    // If we're currently fetching translation/rendering, don't start narration yet
    if (loading) {
       log_error("Narration delayed: Data still loading/translating...");
       return;
    }

    // Increment session to invalidate past attempts
    const session = narrationSessionRef.current + 1;
    narrationSessionRef.current = session;

    if (pagesRef.current.length === 0 && data?.text) {
      const reParsed = parsePages(data.text);
      setPages(reParsed);
      pagesRef.current = reParsed;
    }

    if (!audioRef.current) audioRef.current = new Audio();
    // Pre-emptively unlock audio on user gesture
    audioRef.current.play().catch(() => {}); 
    audioRef.current.pause();

    setIsNarrating(true);
    isNarratingRef.current = true;
    
    const pageToStart = startPage || currentPage || 1;
    setNarratingPage(pageToStart);
    narratingPageRef.current = pageToStart;
    
    // Small delay to ensure state propagates before fetch
    setTimeout(() => { 
      if (narrationSessionRef.current === session) {
        playPage(pageToStart, session, startWordIndex); 
      }
    }, 50);
  };
  const preFetchPage = (nextPageNum) => {
    // Lifted isNarrating check to allow early preparation
    if (nextPageNum > (pagesRef.current.length || 0)) return;
    const nextText = pagesRef.current[nextPageNum - 1];
    if (!nextText || nextText.trim() === "" || nextText.includes('[Empty Page]')) {
      preFetchPage(nextPageNum + 1);
      return;
    }
    const rateMap = { '0.5x': '-50%', '0.75x': '-25%', '1.0x': '+0%', '1.25x': '+25%', '1.5x': '+50%', '2.0x': '+100%' };
    const rate = rateMap[speedRef.current] || '+0%';

    preFetchPromiseRef.current = (async () => {
      try {
        console.log(`Narration: Pre-charging Page ${nextPageNum}...`);
        const resp = await fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
          body: new URLSearchParams({ 
            text: nextText, 
            filename, 
            lang: langRef.current, 
            rate, 
            gender: genderRef.current, 
            expressive: 'false', 
            voice: narrationVoiceRef.current || ""
          })
        });
        const result = await resp.json();
        if (result.audio_url) {
          const res = { pageNum: nextPageNum, ...result };
          preFetchedAudioRef.current = res;
          return res;
        }
      } catch (err) { console.warn("Narration: Pre-charge error:", err); }
      return null;
    })();
  };
  const playPage = async (pageNum, session = null, startWordIndex = 0) => {
    const currentSession = session || narrationSessionRef.current;
    if (!isNarratingRef.current || narrationSessionRef.current !== currentSession) return;
    
    setNumPages(pagesRef.current.length);
    setCurrentPage(pageNum);
    if (data?.is_pdf) scrollToPdfPage(pageNum);
    else scrollToTextPage(pageNum);

    const totalPages = pagesRef.current.length;
    let pageText = pagesRef.current[pageNum - 1];
    
    if (startWordIndex > 0 && pageText) {
       // Slice the text from the specified word index
       const words = pageText.split(/(\s+)/);
       // Word index 0 = parts[0], parts[1] (space)
       // Word index X = parts[X*2]
       const remainder = words.slice(startWordIndex * 2);
       pageText = remainder.join('');
    }

    if (!pageText || pageText.trim() === "" || pageText.includes('[Empty Page]')) {
      if (isNarratingRef.current && pageNum < totalPages) {
        const next = pageNum + 1;
        setNarratingPage(next);
        narratingPageRef.current = next;
        playPage(next, currentSession);
      } else { stopNarration(); }
      return;
    }

    try {
      let result;
      // IMMEDIATE DATA CONSUMPTION: If audio is already pre-fetched/pre-charging, grab it instantly
      if (preFetchPromiseRef.current) {
        // If it's already a completed promise or close to it, we wait briefly but don't set loading yet 
        // to avoid flicker if it's instant (cached)
        const possibleResult = await Promise.race([
          preFetchPromiseRef.current,
          new Promise(r => setTimeout(() => r('PENDING'), 50)) // 50ms race to keep it feeling instant
        ]);
        
        if (possibleResult && possibleResult !== 'PENDING' && possibleResult.pageNum === pageNum && !startWordIndex) {
          result = possibleResult;
          preFetchPromiseRef.current = null;
        }
      }

      if (!result && preFetchedAudioRef.current && preFetchedAudioRef.current.pageNum === pageNum && !startWordIndex) {
        result = preFetchedAudioRef.current;
        preFetchedAudioRef.current = null;
      }
      
      // If still no result after rapid check, THEN show loading state
      if (!result) {
        setIsNarrationLoading(true);
        const rateMap = { '0.5x': '-50%', '0.75x': '-25%', '1.0x': '+0%', '1.25x': '+25%', '1.5x': '+50%', '2.0x': '+100%' };
        const rate = rateMap[speedRef.current] || '+0%';
        const resp = await fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
          body: new URLSearchParams({ 
            text: pageText, 
            filename, 
            lang: langRef.current, 
            rate, 
            gender: genderRef.current, 
            expressive: 'false', 
            voice: narrationVoiceRef.current || ""
          })
        });
        result = await resp.json();
      }

      // Critical check: narration might have stopped or changed session during fetch
      if (!isNarratingRef.current || narrationSessionRef.current !== currentSession) {
        setIsNarrationLoading(false);
        return;
      }

      setIsNarrationLoading(false);

      if (result.audio_url) {
        if (result.vtt_url) {
          try {
            const vttResp = await fetch(result.vtt_url);
            const vttText = await vttResp.text();
            const cues = parseVTT(vttText);
            setActiveCues(cues);
          } catch (e) {
            console.warn("VTT loading error:", e);
            setActiveCues([]);
          }
        } else {
          setActiveCues([]);
        }

        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.src = result.audio_url;
        setAudioUrl(result.audio_url);
        
        audioRef.current.ontimeupdate = () => {
          const currentTime = audioRef.current.currentTime;
          const idx = activeCues.findIndex(cue => currentTime >= cue.start && currentTime <= cue.end);
          if (idx !== -1) {
              setActiveCueIndex(idx + startWordIndex);
          }
        };

        audioRef.current.onplay = () => { 
          setIsPlaying(true); 
          preFetchPage(pageNum + 1); 
        };
        
        audioRef.current.onerror = (e) => {
            console.error("Audio playback error:", e);
            stopNarration();
        };

        audioRef.current.onended = () => {
          setActiveCueIndex(-1);
          setActiveCues([]);
          if (isNarratingRef.current && narrationSessionRef.current === currentSession && narratingPageRef.current < pages.length) {
            const next = narratingPageRef.current + 1;
            setNarratingPage(next);
            narratingPageRef.current = next;
            playPage(next, currentSession);
          } else if (narrationSessionRef.current === currentSession) { 
            stopNarration(); 
          }
        };

        try {
          await audioRef.current.play();
        } catch (playErr) {
          if (playErr.name !== 'AbortError') {
             console.error("Narration Play Error:", playErr);
             stopNarration();
          }
        }
      } else {
        stopNarration();
      }
    } catch (err) {
      console.error("Narration error:", err);
      setIsNarrationLoading(false);
      stopNarration();
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
      else { audioRef.current.play(); setIsPlaying(true); }
    }
  };
  useEffect(() => {
    if (data && data.text) {
      const parsed = parsePages(data.text);
      setPages(parsed);
      
      if (data.original_text) {
        const origParsed = parsePages(data.original_text);
        setOriginalPages(origParsed);
      } else {
        setOriginalPages(parsed);
      }

      if (!data.is_pdf && parsed.length > 0) {
        setNumPages(parsed.length);
        setCurrentPage(1);
      }

      // INSTANT READ ALOUD: Pre-charge Page 1 as soon as book is opened
      if (parsed.length > 0) {
        setTimeout(() => preFetchPage(1), 100);
      }
    }
  }, [data]);

  const handleReadSelection = async () => {
    if (!selection || !selection.text) return;
    if (isNarrating) stopNarration();
    try {
      const rateMap = { '0.5x': '-50%', '0.75x': '-25%', '1.0x': '+0%', '1.25x': '+25%', '1.5x': '+50%', '2.0x': '+100%' };
      const rate = rateMap[narrationSpeed] || '+0%';
      const resp = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams({ text: selection.text, filename, lang: currentLang, rate, gender: narrationGender, expressive: 'false' })
      });
      const result = await resp.json();
      if (result.audio_url) {
        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.src = result.audio_url;
        
        // Handle VTT if returned
        if (result.vtt_url) {
          try {
            const vttResp = await fetch(result.vtt_url);
            const vttText = await vttResp.text();
            const cues = parseVTT(vttText);
            setActiveCues(cues);
            setActiveCueIndex(0);
          } catch (e) { console.warn("VTT fetch error for selection:", e); }
        } else {
          setActiveCues([]);
          setActiveCueIndex(-1);
        }

        // Provide visual feedback in the header
        setIsNarrating(true);
        isNarratingRef.current = true;
        setIsPlaying(true);
        
        // Update ontimeupdate for selection reading
        audioRef.current.ontimeupdate = () => {
          const currentTime = audioRef.current.currentTime;
          const idx = activeCues.findIndex(cue => currentTime >= cue.start && currentTime <= cue.end);
          if (idx !== -1) setActiveCueIndex(idx);
        };

        audioRef.current.onended = () => { 
          stopNarration(); 
          setActiveCues([]);
          setActiveCueIndex(-1);
        };
        audioRef.current.onerror = () => { stopNarration(); };
        
        await audioRef.current.play();
      }
    } catch (err) { console.error("Read selection error:", err); }
  };

  const handleHighlight = () => {
    if (selection && selection.text) {
      const textToHighlight = selection.text.trim();
      if (textToHighlight && textToHighlight.length > 1) {
        // Add to highlights if not already exactly there
        if (!userHighlights.includes(textToHighlight)) {
          setUserHighlights(prev => [...prev, textToHighlight]);
        }
      }
      // CRITICAL: Clear selection and window selection to dismiss menu
      setSelection(null);
      setWord('');
      setSelectionRects([]);
      window.getSelection().removeAllRanges();
    }
  };

  const handleDownloadHighlights = () => {
    if (userHighlights.length === 0) return;
    const content = `Highlights from ${filename}\n\n` + userHighlights.map((h, i) => `${i+1}. ${h}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.split('.')[0]}_highlights.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExplainSelection = async () => {
    if (!selection || !selection.text) return;
    setIsExplaining(true);
    handleToolClick('explain');
    setExplanationData(''); // Clear previous
    try {
      const resp = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams({ text: selection.text, filename, lang: currentLang })
      });
      const result = await resp.json();
      if (result.explanation) {
        setExplanationData(result.explanation);
      } else if (result.error) {
        setExplanationData(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error("Explain selection error:", err);
      setExplanationData("Failed to connect to the AI service.");
    } finally {
      setIsExplaining(false);
    }
  };

  const handleUnhighlight = () => {
    if (selection && selection.text) {
      const textToRemove = selection.text.trim();
      setUserHighlights(prev => prev.filter(h => h !== textToRemove));
    } else if (activeHighlight) {
      const textToRemove = activeHighlight.innerText.trim();
      setUserHighlights(prev => prev.filter(h => h !== textToRemove));
    }
    setSelection(null);
    setActiveHighlight(null);
  };

  const handleToolClick = (toolId) => {
    setActiveTab(toolId);
    setShowPanel(true);
    
    if (toolId === 'summary' && !summaryData) {
      setIsFetchingSummary(true);
      fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ filename, lang: currentLang })
      })
      .then(r => r.json())
      .then(data => {
        setSummaryData(data.summary || "Could not generate summary.");
        setIsFetchingSummary(false);
      })
      .catch(e => {
        console.error("Summary failed:", e);
        setIsFetchingSummary(false);
      });
    }
  };

  const toggleBookmark = (page) => {
    const isBookmarked = bookmarks.includes(page);
    let newBookmarks;
    if (isBookmarked) {
      newBookmarks = bookmarks.filter(b => b !== page);
    } else {
      newBookmarks = [...bookmarks, page];
    }
    setBookmarks(newBookmarks);
    localStorage.setItem(`bookmarks_${filename}`, JSON.stringify(newBookmarks));
  };

  const handleExtractImages = async () => {
    setShowImagesModal(true);
    if (extractedImages.length > 0) return;
    setImagesLoading(true);
    try {
      const resp = await fetch('/api/extract_images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ filename })
      });
      const result = await resp.json();
      if (result.images) setExtractedImages(result.images);
    } catch (e) { console.error("Image extraction failed:", e); }
    finally { setImagesLoading(false); }
  };

  const handleStartPrediction = async () => {
    setShowPredictionModal(true);
    if (predictionData) return;
    setPredictionLoading(true);
    try {
      const resp = await fetch('/api/predict_questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ filename, lang: currentLang })
      });
      const result = await resp.json();
      if (result.short_questions || result.long_questions) setPredictionData(result);
      else if (result.error) { alert(result.error); setShowPredictionModal(false); }
    } catch (e) {
      console.error("Prediction failed:", e);
      alert("Could not reach the AI Service.");
      setShowPredictionModal(false);
    } finally { setPredictionLoading(false); }
  };

  const handleStartQuiz = async () => {
    if (!showQuiz) resetQuiz();
    setShowQuiz(true);
    if (quizQuestions.length > 0) return;
    setQuizLoading(true);
    try {
      const resp = await fetch('/api/generate_quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ filename, lang: currentLang })
      });
      const result = await resp.json();
      if (result.questions) {
        setQuizQuestions(result.questions);
        if (result.message) setQuizMessage(result.message);
        setQuizTimer(600);
      }
    } catch (e) { console.error("Quiz failed:", e); }
    finally { setQuizLoading(false); }
  };

  const handleQuizAnswer = (qIdx, oIdx) => {
    if (quizFinished) return;
    setQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
  };

  const handleFinishQuiz = async () => {
    setQuizFinished(true);
    const score = quizQuestions.reduce((acc, q, idx) => acc + (quizAnswers[idx] === q.answer ? 1 : 0), 0);
    try {
      await fetch('/api/save_quiz_score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ filename, score, total: quizQuestions.length })
      });
    } catch (e) { console.warn("Could not save score:", e); }
  };

  const resetQuiz = () => {
    setCurrentQuizIndex(0);
    setQuizAnswers({});
    setQuizFinished(false);
    setQuizTimer(600);
    setQuizQuestions([]);
    setQuizMessage('');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const applyHighlightsToElement = (container, activeWordIdx = -1) => {
    if (!container) return;
    const marks = container.querySelectorAll('mark.search-highlight, mark.user-highlight, mark.active-narrate-word');
    marks.forEach(m => {
      const parent = m.parentNode;
      if (parent) {
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
      }
    });

    const terms = [searchTerm, ...userHighlights].filter(t => t && t.trim().length > 1);
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    let nodes = [];
    let fullText = "";
    let node;
    while (node = walker.nextNode()) {
      nodes.push({ node, start: fullText.length, end: fullText.length + node.nodeValue.length });
      fullText += node.nodeValue;
    }

    if (activeWordIdx !== -1 && activeCues.length > activeWordIdx) {
      const wordsInText = fullText.split(/(\s+)/);
      let wordCounter = 0;
      let currentOffset = 0;
      for (const part of wordsInText) {
        if (/\S/.test(part)) {
          if (wordCounter === activeWordIdx) {
            const matchStart = currentOffset;
            const matchEnd = currentOffset + part.length;
            const range = document.createRange();
            let startSet = false, endSet = false;
            nodes.forEach(n => {
              if (!startSet && matchStart >= n.start && matchStart < n.end) {
                range.setStart(n.node, matchStart - n.start);
                startSet = true;
              }
              if (!endSet && matchEnd > n.start && matchEnd <= n.end) {
                range.setEnd(n.node, matchEnd - n.start);
                endSet = true;
              }
            });
            if (startSet && endSet) {
              const mark = document.createElement('mark');
              mark.className = 'active-narrate-word';
              try { range.surroundContents(mark); } catch (e) {}
            }
            break;
          }
          wordCounter++;
        }
        currentOffset += part.length;
      }
    }

    terms.forEach(term => {
      const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      let match;
      while ((match = regex.exec(fullText)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + term.length;
        const range = document.createRange();
        let startSet = false, endSet = false;
        nodes.forEach(n => {
          if (!startSet && matchStart >= n.start && matchStart < n.end) { range.setStart(n.node, matchStart - n.start); startSet = true; }
          if (!endSet && matchEnd > n.start && matchEnd <= n.end) { range.setEnd(n.node, matchEnd - n.start); endSet = true; }
        });
        if (startSet && endSet && !range.startContainer.parentElement.closest('mark')) {
          try {
            const fragment = range.extractContents();
            const wrapNode = (node) => {
              if (node.nodeType === Node.TEXT_NODE) {
                const m = document.createElement('mark');
                m.className = term === searchTerm ? 'search-highlight' : 'user-highlight';
                m.appendChild(node.cloneNode());
                return m;
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                const newNode = node.cloneNode(false);
                Array.from(node.childNodes).forEach(child => newNode.appendChild(wrapNode(child)));
                return newNode;
              }
              return node.cloneNode(true);
            };
            const wrappedFragment = document.createDocumentFragment();
            Array.from(fragment.childNodes).forEach(child => wrappedFragment.appendChild(wrapNode(child)));
            range.insertNode(wrappedFragment);
          } catch (e) {}
        }
      }
    });
  };

  const highlightText = (text, highlight, activeWordIndex = -1) => {
    if (!text) return text;
    if (activeWordIndex !== -1) {
      const parts = text.split(/(\s+)/);
      let wordCounter = 0;
      return (
        <>
          {parts.map((part, i) => {
            if (/\S/.test(part)) {
              const currentIdx = wordCounter++;
              const isUserHighlighted = userHighlights.some(uh => uh.toLowerCase().includes(part.toLowerCase()));
              if (currentIdx === activeWordIndex) {
                return <mark key={i} className={isUserHighlighted ? 'user-highlight active-narrate-word' : 'active-narrate-word'}>{part}</mark>;
              }
              if (isUserHighlighted) return <mark key={i} className="user-highlight">{part}</mark>;
              if (highlight && part.toLowerCase().includes(highlight.toLowerCase())) return <mark key={i} className="search-highlight">{part}</mark>;
              return part;
            }
            return part;
          })}
        </>
      );
    }
    let result = [{ content: text, isHighlight: false, type: null }];
    const splitParts = (searchTerm, type) => {
      if (!searchTerm || !searchTerm.trim()) return;
      const term = searchTerm.trim();
      const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      let newResult = [];
      result.forEach(part => {
        if (part.isHighlight) newResult.push(part);
        else {
          part.content.split(regex).forEach(snip => {
            if (snip && snip.toLowerCase() === term.toLowerCase()) newResult.push({ content: snip, isHighlight: true, type });
            else if (snip) newResult.push({ content: snip, isHighlight: false, type: null });
          });
        }
      });
      result = newResult;
    };
    splitParts(highlight, 'search');
    userHighlights.forEach(uh => splitParts(uh, 'user'));
    return <>{result.map((part, i) => part.isHighlight ? <mark key={i} className={part.type === 'search' ? 'search-highlight' : 'user-highlight'}>{part.content}</mark> : part.content)}</>;
  };

  const highlightHtml = (html, search) => {
    if (!html) return html;
    let result = html;
    const apply = (term, className) => {
      if (!term || !term.trim()) return;
      const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fuzzy = escaped.replace(/\s+/g, '(<[^>]*>)*\\s+(<[^>]*>)*');
      const regex = new RegExp(`(${fuzzy})(?![^<]*>)`, 'gi');
      result = result.replace(regex, (match) => `<mark class="${className}">${match}</mark>`);
    };
    apply(search, 'search-highlight');
    userHighlights.forEach(uh => apply(uh, 'user-highlight'));
    return result;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/read/${encodeURIComponent(filename)}?lang=${currentLang}`);
      const result = await resp.json();
      setData(result);
      if (!hasAutoSetLang && result.detected_lang && result.detected_lang !== currentLang && currentLang === 'en') {
        setHasAutoSetLang(true);
        setCurrentLang(result.detected_lang);
      }
      if (result.text) {
        const parsed = parsePages(result.text);
        setPages(parsed);
        const countFromPages = parsed.length > 0 ? parsed.length : 1;
        setNumPages(result.pages || result.count || countFromPages);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const [summaryLang, setSummaryLang] = useState('');
  const fetchSummary = async (force = false) => {
    if (!data || !data.text || isFetchingSummary) return;
    if (summaryData && summaryLang === currentLang && !force) return;
    setIsFetchingSummary(true);
    try {
      const resp = await fetch('/api/summarize_file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams({ filename, lang: currentLang })
      });
      const result = await resp.json();
      if (result.summary) setSummaryData(result.summary);
    } catch (err) { console.error("BG Summary Fetch Error:", err); }
    finally { setIsFetchingSummary(false); }
  };

  useEffect(() => {
    if (data && data.text) {
      if (!summaryData || summaryLang !== currentLang) {
        fetchSummary();
        setSummaryLang(currentLang);
      }
    }
  }, [data, currentLang, summaryData, summaryLang]);

  useEffect(() => { fetchData(); }, [filename, currentLang]);

  useEffect(() => {
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
            setSelection({ text: selected, x: iframeRect.left + rect.left + rect.width / 2, y: iframeRect.top + rect.top - 60, range: null });
            setWord(selected);
          }
        } catch (e) {}
      }
    };
    const iframe = document.querySelector('iframe');
    if (iframe) {
      iframe.onload = () => { 
        try { iframe.contentDocument.addEventListener('mouseup', handleIframeMouseUp); } catch (e) {} 
      };
    }
    return () => {
       if (iframe && iframe.contentDocument) { try { iframe.contentDocument.removeEventListener('mouseup', handleIframeMouseUp); } catch (e) {} }
    };
  }, [filename, currentLang]);

  useEffect(() => {
    if (data?.is_pdf) {
      document.querySelectorAll('.react-pdf__Page__textContent').forEach(layer => {
        const container = layer.closest('[data-page-number]');
        const pageNum = container ? parseInt(container.getAttribute('data-page-number'), 10) : -1;
        applyHighlightsToElement(layer, narratingPage === pageNum ? activeCueIndex : -1);
      });
    }
    if (data?.is_office && officeViewerRef.current) applyHighlightsToElement(officeViewerRef.current, isNarrating ? activeCueIndex : -1);
  }, [searchTerm, userHighlights, data?.is_pdf, data?.is_office, activeCueIndex, narratingPage, isNarrating]);

  useEffect(() => {
    if (showText && isNarrating) {
      const activeWordEl = document.querySelector('.text-modal-body .active-narrate-word');
      if (activeWordEl) activeWordEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else {
        const activePageEl = document.querySelector(`.text-modal-body #page-${narratingPage}`);
        if (activePageEl) activePageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [showText, isNarrating, activeCueIndex, narratingPage]);

  useEffect(() => {
    let interval;
    if (showQuiz && !quizFinished && !quizLoading && quizTimer > 0) {
      interval = setInterval(() => {
        setQuizTimer(prev => {
          if (prev <= 1) { handleFinishQuiz(); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showQuiz, quizFinished, quizLoading, quizTimer]);

  if (loading) return (
    <div className="loading-overlay active">
      <div className="magic-book-container"><div className="magic-book"></div></div>
      <p style={{ color: 'white', marginTop: '20px' }}>Magic Gathering Content...</p>
    </div>
  );

  if (!data) return <div style={{ color: '#4a342e', padding: '100px', textAlign: 'center', background: 'white' }}>Error loading book: {filename}</div>;

  const headerViewControls = (
    <div className="view-controls-header">
      {isNarrating && (
        <div className="header-icon-container stop-btn" title="Stop Narration" onClick={stopNarration}>
          <div className="header-icon" style={{ background: '#e74c3c' }}>
            <Square size={16} fill="white" />
          </div>
          <span className="header-icon-label" style={{ color: '#e74c3c' }}>Stop</span>
        </div>
      )}
      <div className="layout-dropdown-wrapper" ref={layoutMenuRef}>
        <div 
          className={`header-icon-container layout-toggle-btn ${showLayoutMenu ? 'active' : ''}`} 
          title="Change Layout" 
          onClick={() => setShowLayoutMenu(!showLayoutMenu)}
        >
          <div className="header-icon">
            {viewMode === 'single' ? <Square size={18} /> : <Columns2 size={18} />}
          </div>
          <span className="header-icon-label">Layout</span>
        </div>
        
        {showLayoutMenu && (
          <div className="layout-mini-dropdown">
            <div className={`layout-option ${viewMode === 'single' ? 'active' : ''}`} onClick={() => { setViewMode('single'); setShowLayoutMenu(false); }}>
              <div className="layout-option-icon"><Square size={14} /></div>
              <span>Single</span>
            </div>
            <div className={`layout-option ${viewMode === 'double' ? 'active' : ''}`} onClick={() => { setViewMode('double'); setShowLayoutMenu(false); }}>
              <div className="layout-option-icon"><Columns2 size={14} /></div>
              <span>Double</span>
            </div>
          </div>
        )}
      </div>
      <div className="header-controls-divider"></div>
      <div className={`header-icon-container ${bookmarks.includes(currentPage) ? 'active' : ''}`} title="Bookmark" onClick={() => toggleBookmark(currentPage)}>
        <div className="header-icon"><Bookmark size={18} fill={bookmarks.includes(currentPage) ? "#e07a5f" : "none"} /></div>
        <span className="header-icon-label">Mark</span>
      </div>
      <div className="header-icon-container" title="Bookmarks" onClick={() => setShowBookmarks(true)}>
        <div className="header-icon"><List size={18} /></div>
        <span className="header-icon-label">List</span>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
    <div className={`reader-root ${isReadMode ? 'read-mode-active' : ''}`} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'url(/static/user_parchment.jpg) repeat' }}>
      <style>{`
        .reader-root { display: flex !important; visibility: visible !important; opacity: 1 !important; }
        .reader-main { display: flex !important; visibility: visible !important; opacity: 1 !important; flex: 1 !important; height: auto !important; min-height: 500px !important; }
        header { display: flex !important; visibility: visible !important; opacity: 1 !important; background: #4a342e !important; }
        .original-file-viewer { display: flex !important; visibility: visible !important; opacity: 1 !important; flex: 1 !important; }
        .viewer-content { display: block !important; visibility: visible !important; opacity: 1 !important; height: 100% !important; }
      `}</style>
      {/* Persistent Selection Overlay */}
      <Header 
        subtitle={data?.filename || 'No Filename'} 
        originalLang={data?.detected_lang || 'en'} 
        showBack={true} 
        leftContent={headerViewControls}
        moreTools={
          <>
            <div className="header-icon-container" title="Extracted Text (X)" onClick={() => setShowText(!showText)}>
              <div className="header-icon"><FileText size={18} color="#faedcd" /></div>
              <kbd className="shortcut-key-label">X</kbd>
              <span className="header-icon-label">Text</span>
            </div>
            <div className="header-icon-container" title="Ask AI (A)" onClick={() => handleToolClick('ask')}>
              <div className="header-icon"><MessageSquare size={18} color="#faedcd" /></div>
              <kbd className="shortcut-key-label">A</kbd>
              <span className="header-icon-label">Ask AI</span>
            </div>
            <div className="header-icon-container" title="Meaning (M)" onClick={() => handleToolClick('meaning')}>
              <div className="header-icon"><Book size={18} color="#faedcd" /></div>
              <kbd className="shortcut-key-label">M</kbd>
              <span className="header-icon-label">Meaning</span>
            </div>
            <div className={`header-icon-container ${isReadMode ? 'active-focus' : ''}`} title="Focus Mode (F)" onClick={() => setIsReadMode(!isReadMode)}>
              <div className="header-icon"><Highlighter size={18} color={isReadMode ? "#ffffff" : "#faedcd"} style={{ transform: 'rotate(45deg)' }} /></div>
              <kbd className="shortcut-key-label">F</kbd>
              <span className="header-icon-label">Focus</span>
            </div>
            <div className="header-icon-container" title="See Highlights" onClick={() => setShowHighlights(true)}>
              <div className="header-icon" style={{ position: 'relative' }}>
                <Highlighter size={18} color="#faedcd" />
                {userHighlights.length > 0 && <span className="highlight-badge">{userHighlights.length}</span>}
              </div>
              <kbd className="shortcut-key-label">K</kbd>
              <span className="header-icon-label">My Marks</span>
            </div>
            <div className="header-icon-container" title="Take a Quiz (Q)" onClick={() => handleStartQuiz()}>
              <div className="header-icon"><HelpCircle size={18} color="#faedcd" /></div>
              <kbd className="shortcut-key-label">Q</kbd>
              <span className="header-icon-label">Quiz</span>
            </div>
            <div className="header-icon-container" title="Predicted Questions (P)" onClick={handleStartPrediction}>
              <div className="header-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={18} color="#faedcd" />
                <span style={{ fontSize: '10px', position: 'absolute', bottom: '-2px', right: '-2px' }}>❓</span>
              </div>
              <kbd className="shortcut-key-label">P</kbd>
              <span className="header-icon-label">Questions</span>
            </div>
            {data?.has_images && (
              <div className="header-icon-container" title="Extract Images & Explanations" onClick={handleExtractImages}>
                <div className="header-icon"><FileImage size={18} color="#faedcd" /></div>
                <kbd className="shortcut-key-label">I</kbd>
                <span className="header-icon-label">Images</span>
              </div>
            )}
          </>
        }
      >
        <div className="header-icon-container" title="Read Aloud (R)" onClick={() => { handleToolClick('speak'); if (!isNarrating) startNarration(); }}>
          <div className="header-icon"><BookOpen size={18} color="#faedcd" /></div>
          <kbd className="shortcut-key-label">R</kbd>
          <span className="header-icon-label">Read</span>
        </div>
        <div className="header-icon-container" title="Summary (S)" onClick={() => handleToolClick('summary')}>
          <div className="header-icon"><Info size={18} color="#faedcd" /></div>
          <kbd className="shortcut-key-label">S</kbd>
          <span className="header-icon-label">Summary</span>
        </div>
        <div className={`header-icon-container ${showOverlay ? 'active-translation' : ''}`} title="Translation (T)" onClick={() => handleReadTranslationClick()}>
          <div className="header-icon"><Languages size={18} color="#faedcd" /></div>
          <kbd className="shortcut-key-label">T</kbd>
          <span className="header-icon-label">Translation</span>
          {showOverlay && <div className="translation-pulse"></div>}
        </div>
        <div ref={searchBtnRef} className={`header-icon-container search-btn-premium ${showSearch ? 'active' : ''}`} title="Search (/)" onClick={() => setShowSearch(!showSearch)}>
          <div className="header-icon">
            <Search size={18} color={showSearch ? "#ffffff" : "#faedcd"} />
            <div className="search-icon-pulse"></div>
          </div>
          <kbd className="shortcut-key-label">/</kbd>
          <span className="header-icon-label">Search</span>
        </div>
        <div className={`header-icon-container ${isNotebookOpen ? 'notebook-toggle-btn-vibrant' : ''}`} title="Notebook (N)" onClick={() => setIsNotebookOpen(!isNotebookOpen)}>
          <div className="header-icon"><Edit3 size={18} color={isNotebookOpen ? "#ffffff" : "#faedcd"} /></div>
          <kbd className="shortcut-key-label">N</kbd>
          <span className="header-icon-label">Notes</span>
        </div>
      </Header>

      {showSearch && (
        <div ref={searchBarRef} className="search-bar-inline">
          <div className="search-input-wrapper">
            <Search size={20} className="search-icon-inner" />
            <input
              type="text"
              placeholder="Type icon name or page number…"
              value={searchTerm}
              onKeyDown={(e) => {
                if (suggestions.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSuggestionIndex(prev => (prev + 1) % suggestions.length);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const selected = suggestionIndex >= 0 ? suggestions[suggestionIndex] : null;
                    if (selected) {
                      if (selected.type === 'command') handleVoiceCommand(selected.id);
                      else selectLanguage(selected.code);
                      setSearchTerm('');
                      setSuggestions([]);
                      setShowSearch(false);
                    }
                  } else if (e.key === 'Escape') {
                    setSuggestions([]);
                  }
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                setSearchTerm(val);
                
                if (!val.trim()) {
                  setSuggestions([]);
                  setPageJumpMsg('');
                  return;
                }

                const pageMatch = val.trim().match(/^(?:p(?:age)?\s*)?(\d+)$/i);
                
                // Suggestions filtering
                const normalizedVal = val.trim().toLowerCase();
                const matchedCmds = COMMANDS.filter(c => 
                  c.name.toLowerCase().includes(normalizedVal)
                ).map(c => ({ ...c, type: 'command' }));

                const matchedLangs = allLanguages.filter(l => 
                  l.name.toLowerCase().includes(normalizedVal) || 
                  l.code.toLowerCase().includes(normalizedVal)
                ).map(l => ({ ...l, type: 'language' }));

                const combined = []; // Disabled suggestions in search bar as requested
                setSuggestions(combined);
                setSuggestionIndex(-1);

                if (pageMatch) {
                  const target = parseInt(pageMatch[1], 10);
                  if (target >= 1 && target <= numPages) {
                    setPageJumpMsg(`Jumping to page ${target}`);
                    setCurrentPage(target);
                    if (data?.is_pdf) scrollToPdfPage(target);
                    else scrollToTextPage(target);
                  } else { setPageJumpMsg(`Page ${target} out of range`); }
                } else { 
                  // If it's a perfect match for a language or command, we can show it in badge
                  const exactLang = allLanguages.find(l => normalizedVal === l.name.toLowerCase());
                  if (exactLang) setPageJumpMsg(`Language: ${exactLang.name}`);
                  else setPageJumpMsg(''); 
                }
              }}
              onBlur={() => setTimeout(() => setSuggestions([]), 200)}
              autoFocus
            />
            {searchTerm && <CloseIcon size={18} className="clear-search" onClick={() => { setSearchTerm(''); setPageJumpMsg(''); setSuggestions([]); }} />}
          </div>
          {pageJumpMsg && <div className="page-jump-badge">{pageJumpMsg}</div>}
          
          {suggestions.length > 0 && (
            <div className="search-suggestions-dropdown">
              {suggestions.map((item, idx) => (
                <div 
                  key={item.id || item.code}
                  className={`suggestion-item ${idx === suggestionIndex ? 'active' : ''} ${item.type}`}
                  onClick={() => {
                    if (item.type === 'command') handleVoiceCommand(item.id);
                    else selectLanguage(item.code);
                    setSearchTerm('');
                    setSuggestions([]);
                    setShowSearch(false);
                  }}
                >
                  <span className="suggestion-icon">
                    {item.type === 'command' ? item.icon : <Languages size={14} />}
                  </span>
                  <span className="suggestion-name">{item.name}</span>
                  {item.shortcut && <span className="suggestion-shortcut">{item.shortcut}</span>}
                  {item.type === 'language' && <span className="suggestion-type-tag">Language</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      <div className="book-title-section">
        <h1 className="book-display-title">{data?.filename}</h1>
      </div>

      <main className="reader-main" style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <ToolPanel
          active={showPanel}
          onClose={() => { setShowPanel(false); setWord(''); }}
          filename={filename}
          text={data?.text}
          lang={currentLang}
          detectedLang={data?.detected_lang}
          detectedLangName={data?.detected_lang_name}
          externalTab={activeTab}
          initialWord={word}
          initialSummary={summaryData}
          initialExplanation={explanationData}
          isExplaining={isExplaining}
          isFetchingSummary={isFetchingSummary}
          onLanguageChange={handleLanguageChange}
          isNarrating={isNarrating}
          isPlaying={isPlaying}
          narratingPage={narratingPage}
          togglePlayback={togglePlayback}
          onStopNarration={stopNarration}
          onRestartNarration={restartNarration}
          onStartNarration={startNarration}
          currentViewPage={currentPage}
          narrationSpeed={narrationSpeed}
          onSpeedChange={handleSpeedChange}
          narrationGender={narrationGender}
          onGenderChange={handleGenderChange}
          narrationVoice={narrationVoice}
          onVoiceChange={setNarrationVoice}
          availableVoices={availableVoices}
        />

        <div style={{ flex: 1, display: 'flex', padding: '10px', gap: '10px', position: 'relative', overflow: 'hidden' }}>

          {isNarrationLoading && (
            <div style={{ position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', background: '#e07a5f', color: '#fff', padding: '12px 24px', borderRadius: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1000, animation: 'fadeIn 0.3s ease' }}>
              <div style={{ width: '18px', height: '18px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <span style={{ fontSize: '0.95rem', fontWeight: '600', letterSpacing: '0.5px' }}>Preparing Audio...</span>
              <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          <div className={`original-file-viewer ${currentLang.toLowerCase() !== (data?.detected_lang || 'en').toLowerCase() ? 'translating' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'transparent', borderRadius: '12px', position: 'relative', minHeight: 0 }}>
            <div className="viewer-content" style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Selection Overlay for non-PDF modes */}
              {!data.is_pdf && selection && (
                <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10000, width: '100%', height: '100%' }}>
                  {selectionRects.map((rect, i) => (
                    <div key={i} style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height, backgroundColor: 'rgba(0, 120, 215, 0.2)', borderRadius: '2px' }} />
                  ))}
                  <div className="floating-context-menu" style={{ left: selection.x, top: selection.y, transform: 'translateX(-50%) translateY(-100%)', marginTop: '-10px', position: 'absolute', display: 'flex', gap: '8px', background: '#4a342e', padding: '6px 10px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', zIndex: 10001, border: '1px solid #d4a373', pointerEvents: 'auto' }} onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
                    <div onClick={(e) => { e.stopPropagation(); handleToolClick('meaning'); setSelection(null); }} className="context-menu-btn" title="Meaning"><Book size={18} /></div>
                    <div onClick={(e) => { e.stopPropagation(); handleExplainSelection(); setSelection(null); }} className="context-menu-btn" title="Explain"><Sparkles size={18} /></div>
                    <div onClick={(e) => { e.stopPropagation(); handleReadSelection(); }} className="context-menu-btn" title="Read Selection"><Play size={18} /></div>
                    {selection.isHighlight ? (
                      <div onClick={(e) => { e.stopPropagation(); handleUnhighlight(); }} className="context-menu-btn" title="Remove Highlight" style={{ color: '#e74c3c' }}><Highlighter size={18} /></div>
                    ) : selection.range && (
                      <div onClick={(e) => { e.stopPropagation(); handleHighlight(); }} className="context-menu-btn" title="Highlight"><Highlighter size={18} /></div>
                    )}
                  </div>
                </div>
              )}
              {data.is_pdf ? (
                <div ref={viewerRef} onScroll={handlePdfScroll} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', scrollBehavior: 'smooth' }}>
                  {/* Selection Overlay for PDF mode */}
                  {selection && (
                    <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10000, width: '100%', height: '100%' }}>
                      {selectionRects.map((rect, i) => (
                        <div key={i} style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height, backgroundColor: 'rgba(0, 120, 215, 0.2)', borderRadius: '2px' }} />
                      ))}
                      <div className="floating-context-menu" style={{ left: selection.x, top: selection.y, transform: 'translateX(-50%) translateY(-100%)', marginTop: '-10px', position: 'absolute', display: 'flex', gap: '8px', background: '#4a342e', padding: '6px 10px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', zIndex: 10001, border: '1px solid #d4a373', pointerEvents: 'auto' }} onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
                        <div onClick={(e) => { e.stopPropagation(); handleToolClick('meaning'); setSelection(null); }} className="context-menu-btn" title="Meaning"><Book size={18} /></div>
                        <div onClick={(e) => { e.stopPropagation(); handleExplainSelection(); setSelection(null); }} className="context-menu-btn" title="Explain"><Sparkles size={18} /></div>
                        <div onClick={(e) => { e.stopPropagation(); handleReadSelection(); }} className="context-menu-btn" title="Read Selection"><Play size={18} /></div>
                        {selection.isHighlight ? (
                          <div onClick={(e) => { e.stopPropagation(); handleUnhighlight(); }} className="context-menu-btn" title="Remove Highlight" style={{ color: '#e74c3c' }}><Highlighter size={18} /></div>
                        ) : selection.range && (
                          <div onClick={(e) => { e.stopPropagation(); handleHighlight(); }} className="context-menu-btn" title="Highlight"><Highlighter size={18} /></div>
                        )}
                      </div>
                    </div>
                  )}
                  {pdfError ? (
                    <div className="error-preview">Failed to load PDF locally.</div>
                  ) : (
                    <Document
                      file={`/uploads/${encodeURIComponent(data.preview_filename || filename)}`}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={() => setPdfError(true)}
                      loading={<div style={{ padding: '20px' }}>Loading PDF...</div>}
                      className={`pdf-document ${viewMode === 'double' ? 'double-view' : ''}`}
                    >
                      <div className="zoom-wrapper" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', width: '100%', transition: 'transform 0.2s ease-out' }}>
                        {viewMode === 'double' ? (
                          Array.from(new Array(Math.ceil(numPages / 2)), (_, i) => {
                            const p1 = i * 2 + 1;
                            const p2 = i * 2 + 2;
                            return (
                              <div key={`pair_${i}`} className="pdf-page-pair" style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '20px 0' }}>
                                {[p1, p2].map(pageNum => pageNum <= numPages && (
                                  <div key={`page_${pageNum}`} data-page-number={pageNum} className="pdf-page-container" style={{ position: 'relative' }}>
                                    <Page 
                                      pageNumber={pageNum} 
                                      width={Math.min(window.innerWidth * 0.45, 600)} 
                                      renderAnnotationLayer={true} 
                                      renderTextLayer={true}
                                      onRenderTextLayerSuccess={() => {
                                        const layer = document.querySelector(`[data-page-number="${pageNum}"] .react-pdf__Page__textContent`);
                                        if (layer && typeof applyHighlightsToElement === 'function') applyHighlightsToElement(layer);
                                      }}
                                    />
                                    {showOverlay && pages[pageNum-1] && (
                                      <div className="page-translation-overlay"><div className="page-translation-card">{highlightText(pages[pageNum-1], searchTerm, narratingPage === pageNum ? activeCueIndex : -1)}</div></div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })
                        ) : (
                          Array.from(new Array(numPages || 0), (el, index) => {
                            const pageNum = index + 1;
                            const isVisible = (numPages <= 40) || (Math.abs(pageNum - currentPage) <= 5);
                            return (
                              <div key={`page_${pageNum}`} data-page-number={pageNum} className={`pdf-page-container ${narratingPage === pageNum ? 'is-narrating' : ''}`} style={{ position: 'relative', minHeight: isVisible ? 'auto' : '820px', width: '100%', display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                                {isVisible ? (
                                  <>
                                    <Page 
                                      pageNumber={pageNum} 
                                      width={Math.min(window.innerWidth * 0.8, 800)} 
                                      renderAnnotationLayer={true} 
                                      renderTextLayer={true} 
                                      onRenderTextLayerSuccess={() => {
                                        const layer = document.querySelector(`[data-page-number="${pageNum}"] .react-pdf__Page__textContent`);
                                        if (layer && typeof applyHighlightsToElement === 'function') applyHighlightsToElement(layer);
                                      }}
                                    />
                                    {showOverlay && pages[index] && (
                                      <div className="page-translation-overlay"><div className="page-translation-card">{highlightText(pages[index], searchTerm, narratingPage === index + 1 ? activeCueIndex : -1)}</div></div>
                                    )}
                                  </>
                                ) : (
                                  <div className="page-placeholder"><div className="magic-book-tiny"></div><p>Magic Gathering Content...</p></div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </Document>
                  )}
                </div>
              ) : data.is_office ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <div className="premium-reader-page" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}>
                    <div 
                      ref={officeViewerRef}
                      dangerouslySetInnerHTML={{ __html: highlightHtml(data.office_html, searchTerm) }} 
                      className="office-viewer" 
                    />
                    {showOverlay && pages[currentPage - 1] && (
                      <div className="page-translation-overlay"><div className="page-translation-card">{highlightText(pages[currentPage - 1], searchTerm, isNarrating ? activeCueIndex : -1)}</div></div>
                    )}
                  </div>
                  <div className="pdf-navigation" style={{ marginTop: '20px' }}>
                    <span className="page-info">Document View</span>
                  </div>
                </div>
              ) : data.is_image ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
                  <div className="premium-reader-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', minHeight: 'auto', transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}>
                    <img src={`/uploads/${encodeURIComponent(data.filename)}`} alt="Book Page" style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
                    {(showOverlay || searchTerm) && data.text && (
                      <div className="page-translation-overlay" style={{ background: searchTerm && !showOverlay ? 'transparent' : 'rgba(255, 255, 255, 0.7)' }}>
                        <div className="page-translation-card" style={{ boxShadow: searchTerm && !showOverlay ? 'none' : '' }}>
                          {highlightText(data.text, searchTerm, isNarrating ? activeCueIndex : -1)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="pdf-navigation" style={{ marginTop: '20px' }}>
                    <span className="page-info">Image View</span>
                  </div>
                </div>
              ) : data.is_video ? ( 
                <video src={`/uploads/${encodeURIComponent(data.filename)}`} controls style={{ maxWidth: '100%' }} /> 
              ) : pages.length > 0 ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className={`text-view-container ${viewMode === 'double' ? 'double-mode' : ''}`} style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
                    <div ref={viewerRef} className={`premium-reader-page book-text-page ${narratingPage === currentPage ? 'is-narrating' : ''}`} onClick={() => startNarration(currentPage)} style={{ cursor: 'pointer' }}>
                      <div className="book-text-content">{highlightText(pages[currentPage - 1], searchTerm, narratingPage === currentPage ? activeCueIndex : -1)}</div>
                      {showOverlay && pages[currentPage - 1] && (
                        <div className="page-translation-overlay"><div className="page-translation-card">{highlightText(pages[currentPage - 1], searchTerm, narratingPage === currentPage ? activeCueIndex : -1)}</div></div>
                      )}
                    </div>
                    {viewMode === 'double' && currentPage < numPages && (
                      <div className={`premium-reader-page book-text-page ${narratingPage === currentPage + 1 ? 'is-narrating' : ''}`} onClick={() => startNarration(currentPage + 1)} style={{ cursor: 'pointer' }}>
                        <div className="book-text-content">{highlightText(pages[currentPage], searchTerm, narratingPage === currentPage + 1 ? activeCueIndex : -1)}</div>
                        {showOverlay && pages[currentPage] && (
                          <div className="page-translation-overlay"><div className="page-translation-card">{highlightText(pages[currentPage], searchTerm, narratingPage === currentPage + 1 ? activeCueIndex : -1)}</div></div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="pdf-navigation" style={{ marginTop: '20px' }}>
                    <button className="nav-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - (viewMode === 'double' ? 2 : 1)))}><ChevronLeft size={20} /> Previous</button>
                    <span className="page-info">
                      {viewMode === 'double' && currentPage < numPages ? `Pages ${currentPage}-${currentPage+1}` : `Page ${currentPage}`} of {numPages}
                    </span>
                    <button className="nav-btn" disabled={currentPage >= numPages} onClick={() => setCurrentPage(prev => Math.min(numPages, prev + (viewMode === 'double' ? 2 : 1)))}>Next <ChevronRight size={20} /></button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          
          {/* Dedicated Notebook Panel */}
          {isNotebookOpen && (
            <div className="notebook-paper-panel">
              <div className="notebook-sheet">
                <div className="notebook-header-vibrant">
                  <h3>Pocket Notebook</h3>
                  <button 
                    onClick={() => { if(window.confirm('Clear all notes?')) handleNotesChange({target:{value:''}}); }}
                    style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Trash2 size={14} /> Clear
                  </button>
                </div>
                <textarea 
                  className="notebook-textarea"
                  placeholder="Type your notes here while seeing the book..."
                  value={notes}
                  onChange={handleNotesChange}
                  autoFocus
                />
                <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#8b7355', textAlign: 'right' }}>
                  Auto-saved for {filename}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>


      {showText && (
        <div className="text-modal-overlay" onClick={() => setShowText(false)}>
          <div className="text-modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#4a342e', fontFamily: "'Alice', serif" }}>Extracted Book Text</h3>
              <button onClick={() => setShowText(false)} style={{ margin: 0, background: '#e74c3c', padding: '8px 15px' }}>Close</button>
            </div>
            <div className="text-modal-body">
              {pages.map((p, i) => (
                <div key={i} id={`page-${i + 1}`} className={`text-page ${currentPage === i + 1 ? 'active-page' : ''} ${narratingPage === i + 1 ? 'narrating' : ''}`} onClick={() => startNarration(i + 1)} style={{ cursor: 'pointer', padding: '15px', borderRadius: '8px', position: 'relative', borderBottom: '1px solid #eee' }}>
                  <div style={{ fontSize: '0.7rem', color: '#8b7355', marginBottom: '5px' }}>Page {i + 1}</div>
                  {highlightText(p, searchTerm, narratingPage === i + 1 ? activeCueIndex : -1)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showHighlights && (
        <div className="text-modal-overlay" onClick={() => setShowHighlights(false)}>
          <div className="text-modal-content" onClick={(e) => e.stopPropagation()} style={{ border: '2px solid #d4a373' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Highlighter size={24} color="#b5651d" />
                <h3 style={{ margin: 0, color: '#4a342e', fontFamily: "'Alice', serif" }}>Your Stored Highlights ({userHighlights.length})</h3>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="download-btn-premium" onClick={handleDownloadHighlights} style={{ margin: 0, background: '#27ae60', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={16} /> Download (.txt)
                </button>
                <button onClick={() => setShowHighlights(false)} style={{ margin: 0, background: '#e74c3c' }}>Close</button>
              </div>
            </div>
            <div className="text-modal-body" style={{ background: 'rgba(255, 248, 235, 0.9)' }}>
              {userHighlights.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#8b7355' }}>
                  <Highlighter size={48} style={{ opacity: 0.2, marginBottom: '15px' }} />
                  <p>You haven't highlighted any text yet. Select text in the book to mark it!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {userHighlights.map((h, i) => (
                    <div key={i} className="highlight-item-card">
                      <div className="highlight-item-number">{i + 1}</div>
                      <div className="highlight-item-text">{h}</div>
                      <button 
                        className="remove-highlight-btn" 
                        onClick={(e) => { e.stopPropagation(); setUserHighlights(prev => prev.filter(item => item !== h)); }}
                        title="Remove highlight"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="analyzing-overlay">
          <div className="analyzing-content">
            <div className="analyzing-scanner"><div className="scan-line"></div><Languages size={60} className="analyzing-icon" /></div>
            <h2>Analyzing Book Content</h2>
            <p>Preparing the magic ink for translation...</p>
            <div className="analysis-progress-container"><div className="analysis-progress-bar" style={{ width: `${analyzingPage}%` }}></div></div>
            <span className="analysis-percentage">{analyzingPage}% Complete</span>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="shortcuts-full-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="shortcuts-full-content" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-full-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}><Keyboard size={32} color="#e07a5f" /><h2 style={{ margin: 0, color: '#4a342e', fontFamily: "'Alice', serif" }}>Magic Keyboard Shortcuts</h2></div>
              <button className="close-shortcuts" onClick={() => setShowShortcuts(false)}><CloseIcon /></button>
            </div>
            <div className="shortcuts-full-grid">
              <div className="shortcut-full-item"><kbd>S</kbd> <span>Summarize the Book</span></div>
              <div className="shortcut-full-item"><kbd>A</kbd> <span>Ask AI Anything</span></div>
              <div className="shortcut-full-item"><kbd>R</kbd> <span>Start Narration (Read)</span></div>
              <div className="shortcut-full-item"><kbd>T</kbd> <span>Translate Book</span></div>
              <div className="shortcut-full-item"><kbd>M</kbd> <span>Word Meaning</span></div>
              <div className="shortcut-full-item"><kbd>F</kbd> <span>Focus Mode</span></div>
              <div className="shortcut-full-item"><kbd>N</kbd> <span>Pocket Notebook (Blank Paper)</span></div>
              <div className="shortcut-full-item"><kbd>V</kbd> <span>Toggle Voice Control</span></div>
              <div className="shortcut-full-item"><kbd>X</kbd> <span>Toggle Extracted Text</span></div>
              <div className="shortcut-full-item"><kbd>/</kbd> <span>Open Search</span></div>
              <div className="shortcut-full-item"><kbd>K</kbd> <span>See My Highlights</span></div>
              <div className="shortcut-full-item"><kbd>Q</kbd> <span>Take a Quiz</span></div>
              <div className="shortcut-full-item"><kbd>P</kbd> <span>Smart Question Prediction</span></div>
              <div className="shortcut-divider-full"></div>
              <div className="shortcut-full-item"><kbd>Space</kbd> <span>Play / Pause</span></div>
              <div className="shortcut-full-item"><kbd>←</kbd> <kbd>→</kbd> <span>Previous / Next Page</span></div>
              <div className="shortcut-full-item"><kbd>H</kbd> <span>Toggle this Help Overlay</span></div>
            </div>
          </div>
        </div>
      )}

      {showLangMenu && (
        <div className="lang-menu-overlay" onClick={() => setShowLangMenu(false)}>
          <div className="lang-menu-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px 0', color: '#4a342e', fontFamily: "'Alice', serif" }}>Select Translation Language</h3>
            <div className="lang-grid">
              <button className="lang-btn original-lang-btn" onClick={() => selectLanguage('original')} style={{ gridColumn: '1 / -1', marginBottom: '10px', background: 'rgba(224, 122, 95, 0.2)', border: '1px dashed #e07a5f', padding: '12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#4a342e', fontWeight: 'bold' }}><Globe size={18} /> <span>Original Book Language</span></button>
              {allLanguages.map((item) => (
                <div key={item.code} className={`lang-item ${currentLang === item.code ? 'active' : ''}`} onClick={() => selectLanguage(item.code)}>
                  <span className="lang-name">{item.name}</span>
                  {item.code === data?.detected_lang && <span className="lang-tag">Original</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <VoiceController isActive={voiceActive} setIsActive={setVoiceActive} onCommand={stableVoiceCommand} languages={allLanguages} />

      {showQuiz && (
        <div className="quiz-modal-overlay">
          <div className="quiz-modal-content">
            <div className="quiz-header">
              <div className="quiz-title-group">
                <div className="quiz-icon-badge"><HelpCircle size={28} color="#ffffff" /></div>
                <div>
                  <h2 className="quiz-main-title">AI Knowledge Check</h2>
                  <p className="quiz-subtitle">{filename}</p>
                </div>
              </div>
              <div className="quiz-header-controls">
                {!quizFinished && !quizLoading && (
                  <div className="quiz-timer-badge">
                    <Timer size={18} />
                    <span>{formatTime(quizTimer)}</span>
                  </div>
                )}
                <button className="quiz-close-btn" onClick={() => { setShowQuiz(false); resetQuiz(); }}><CloseIcon size={24} /></button>
              </div>
            </div>

            <div className="quiz-body">
              {quizLoading ? (
                <div className="quiz-loading-state">
                  <div className="quiz-magic-loader">
                    <div className="loader-circle"></div>
                    <HelpCircle size={40} className="loader-icon-bounce" />
                  </div>
                  <h3>Generating Your Quiz...</h3>
                  <p>Gemini is analyzing the book to create relevant questions.</p>
                  {quizMessage && <div className="quiz-status-notice free-mode">{quizMessage}</div>}
                </div>
              ) : quizFinished ? (
                <div className="quiz-results-container">
                  <div className="quiz-results-card">
                    <Award size={64} color="#d4a373" className="award-icon" />
                    <h2>Quiz Completed!</h2>
                    <div className="score-display">
                      <span className="score-num">{quizQuestions.reduce((acc, q, idx) => acc + (quizAnswers[idx] === q.answer ? 1 : 0), 0)}</span>
                      <span className="score-total">/ {quizQuestions.length}</span>
                    </div>
                    <p className="score-message">
                      {quizQuestions.reduce((acc, q, idx) => acc + (quizAnswers[idx] === q.answer ? 1 : 0), 0) > 7 ? "Excellent! You have a great grasp of the content." : "Good effort! Keep reading to improve your score."}
                    </p>
                    <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                      <button className="quiz-btn-primary" onClick={() => { setQuizFinished(false); setQuizAnswers({}); setCurrentQuizIndex(0); setQuizTimer(600); }}><RotateCcw size={18} /> Restart Quiz</button>
                      <button className="quiz-btn-secondary" onClick={() => { setShowQuiz(false); resetQuiz(); }}>Close</button>
                    </div>
                  </div>

                  <div className="quiz-review-section">
                    <h3 className="review-title">Review Answers</h3>
                    <div className="review-list">
                      {quizQuestions.map((q, idx) => (
                        <div key={idx} className={`review-item ${quizAnswers[idx] === q.answer ? 'correct' : 'wrong'}`}>
                          <div className="review-q-num">Q{idx + 1}</div>
                          <div className="review-content">
                            <p className="review-question">{q.question}</p>
                            <div className="review-labels">
                              <span className="your-ans">Your Answer: {q.options[quizAnswers[idx]] || 'None'}</span>
                              {quizAnswers[idx] !== q.answer && <span className="correct-ans">Correct: {q.options[q.answer]}</span>}
                            </div>
                            <p className="review-explanation"><strong>Explanation:</strong> {q.explanation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="quiz-question-container">
                  {quizMessage && (
                    <div className="quiz-status-banner fade-in">
                      <AlertCircle size={16} />
                      <span>{quizMessage}</span>
                    </div>
                  )}
                  <div className="quiz-progress-wrapper">
                    <div className="quiz-progress-info">
                      <span>Question <strong>{currentQuizIndex + 1}</strong> of {quizQuestions.length}</span>
                      <span>{Math.round(((currentQuizIndex + 1) / quizQuestions.length) * 100)}% Complete</span>
                    </div>
                    <div className="quiz-progress-bar-bg">
                      <div className="quiz-progress-bar-fill" style={{ width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%` }}></div>
                    </div>
                  </div>

                  <div className="question-card pulse-in">
                    <h3 className="question-text">{quizQuestions[currentQuizIndex]?.question}</h3>
                    <div className="options-grid">
                      {quizQuestions[currentQuizIndex]?.options.map((option, idx) => (
                        <button 
                          key={idx} 
                          className={`option-button ${quizAnswers[currentQuizIndex] === idx ? 'selected' : ''}`}
                          onClick={() => handleQuizAnswer(currentQuizIndex, idx)}
                        >
                          <div className="option-letter">{String.fromCharCode(65 + idx)}</div>
                          <div className="option-label">{option}</div>
                          {quizAnswers[currentQuizIndex] === idx && <CheckCircle2 size={20} className="check-icon" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="quiz-navigation">
                    <button 
                      className="quiz-nav-btn" 
                      onClick={() => setCurrentQuizIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentQuizIndex === 0}
                    >
                      Previous
                    </button>
                    {currentQuizIndex === quizQuestions.length - 1 ? (
                      <button 
                        className="quiz-finish-btn" 
                        onClick={handleFinishQuiz}
                        disabled={quizAnswers[currentQuizIndex] === undefined}
                      >
                        Finish Quiz
                      </button>
                    ) : (
                      <button 
                        className="quiz-nav-btn primary" 
                        onClick={() => setCurrentQuizIndex(prev => prev + 1)}
                        disabled={quizAnswers[currentQuizIndex] === undefined}
                      >
                        Next <ChevronRightIcon size={18} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPredictionModal && (
        <div className="quiz-modal-overlay" style={{ zIndex: 30000 }}>
          <div className="quiz-modal-content" style={{ maxWidth: '1000px', height: '90vh' }}>
            <div className="quiz-header" style={{ background: 'linear-gradient(135deg, #4a342e 0%, #6d4c41 100%)' }}>
              <div className="quiz-title-group">
                <div className="quiz-icon-badge" style={{ background: '#d4a373' }}><Brain size={28} color="#ffffff" /></div>
                <div>
                  <h2 className="quiz-main-title">Predicted Important Questions</h2>
                  <p className="quiz-subtitle">AI-powered exam preparation for: {filename}</p>
                </div>
              </div>
              <div className="quiz-header-controls">
                <button className="quiz-close-btn" onClick={() => setShowPredictionModal(false)}><CloseIcon size={24} /></button>
              </div>
            </div>

            <div className="quiz-body" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 140px)' }}>
              <div style={{ display: 'flex', gap: '15px', padding: '20px', borderBottom: '1px solid #eee', background: 'white' }}>
                <button 
                  className={`quiz-tab-btn ${predictionActiveTab === 'short' ? 'active' : ''}`}
                  onClick={() => setPredictionActiveTab('short')}
                  style={{ 
                    flex: 1, padding: '12px', borderRadius: '10px', border: 'none', 
                    background: predictionActiveTab === 'short' ? '#d4a373' : '#f5ebe0',
                    color: predictionActiveTab === 'short' ? 'white' : '#4a342e',
                    fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s'
                  }}
                >
                  Short Answer Questions
                </button>
                <button 
                  className={`quiz-tab-btn ${predictionActiveTab === 'long' ? 'active' : ''}`}
                  onClick={() => setPredictionActiveTab('long')}
                  style={{ 
                    flex: 1, padding: '12px', borderRadius: '10px', border: 'none', 
                    background: predictionActiveTab === 'long' ? '#d4a373' : '#f5ebe0',
                    color: predictionActiveTab === 'long' ? 'white' : '#4a342e',
                    fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s'
                  }}
                >
                  Long Answer Questions
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '25px', background: '#fcfaf7' }}>
                {predictionLoading ? (
                  <div className="quiz-loading-state" style={{ padding: '80px 0' }}>
                    <div className="quiz-magic-loader">
                      <div className="loader-circle"></div>
                      <Brain size={40} className="loader-icon-bounce" color="#d4a373" />
                    </div>
                    <h3>Analyzing Book Architecture...</h3>
                    <p>Generating exam-level predicted questions based on key topics.</p>
                  </div>
                ) : !predictionData ? (
                   <div style={{ textAlign: 'center', padding: '60px', opacity: 0.6 }}>
                    <p>No predictions available yet.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {(predictionActiveTab === 'short' ? predictionData.short_questions : predictionData.long_questions)?.map((q, idx) => (
                      <div key={idx} className="prediction-card" style={{ 
                        background: 'white', borderRadius: '16px', padding: '20px', 
                        border: '1px solid #e9dcc9', boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                        transition: 'all 0.3s ease', position: 'relative'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{ 
                              background: '#4a342e', color: 'white', width: '28px', height: '28px', 
                              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.8rem', fontWeight: 'bold'
                            }}>{idx + 1}</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <span className={`difficulty-badge ${q.difficulty.toLowerCase()}`} style={{
                                padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '600',
                                backgroundColor: q.difficulty === 'Easy' ? '#d5f5e3' : q.difficulty === 'Medium' ? '#fdebd0' : '#fadbd8',
                                color: q.difficulty === 'Easy' ? '#1d8348' : q.difficulty === 'Medium' ? '#b7950b' : '#943126'
                              }}>{q.difficulty}</span>
                              {q.is_important && <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', background: '#f1c40f', color: '#4a342e', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(241, 196, 15, 0.3)' }}><Award size={14} /> Most Important</span>}
                            </div>
                          </div>
                        </div>

                        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#2c3e50', lineHeight: '1.5' }}>{q.question}</h3>
                        
                        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '15px' }}>
                          <button 
                            className="show-ans-toggle"
                            onClick={() => setShowAnswers(prev => ({ ...prev, [`${predictionActiveTab}_${idx}`]: !prev[`${predictionActiveTab}_${idx}`] }))}
                            style={{ 
                              background: 'transparent', border: '1px solid #d4a373', color: '#d4a373',
                              padding: '6px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem',
                              fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                          >
                            {showAnswers[`${predictionActiveTab}_${idx}`] ? 'Hide Answer' : 'Show Answer'}
                          </button>

                          {showAnswers[`${predictionActiveTab}_${idx}`] && (
                            <div className="answer-content-box" style={{ 
                              marginTop: '15px', padding: '15px', background: '#fdf7f0', 
                              borderRadius: '10px', borderLeft: '4px solid #d4a373',
                              animation: 'slideDown 0.3s ease-out'
                            }}>
                              <p style={{ margin: 0, fontSize: '0.95rem', color: '#4a342e', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                {q.answer.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                                  if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={i} style={{ color: '#000', fontWeight: '800', background: 'rgba(212, 163, 115, 0.1)', padding: '0 2px', borderRadius: '4px' }}>{part.slice(2, -2)}</strong>;
                                  }
                                  return part;
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '20px', background: 'white', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button 
                  className="quiz-btn-primary" 
                  onClick={() => { setShowPredictionModal(false); handleStartQuiz(); }}
                  style={{ background: '#4a342e', border: 'none' }}
                >
                  Start Quiz Mode
                </button>
              </div>
              <button className="home-cta-btn" onClick={() => setShowPredictionModal(false)} style={{ width: 'auto', padding: '0 30px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showImagesModal && (
        <div className="quiz-modal-overlay" style={{ zIndex: 2000 }}>
          <div className="quiz-card" style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="quiz-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#e07a5f', padding: '8px', borderRadius: '10px' }}><FileImage color="white" size={20} /></div>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Extracted Images & Content</h2>
              </div>
              <button className="close-quiz" onClick={() => setShowImagesModal(false)}><CloseIcon /></button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f8f4f0' }}>
              {imagesLoading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                  <Loader2 className="spin" size={48} color="#e07a5f" />
                  <p style={{ marginTop: '20px', color: '#4a342e' }}>Scanning document for images and generating explanations...</p>
                </div>
              ) : extractedImages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', opacity: 0.6 }}>
                  <p>No internal images found in this document.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {extractedImages.map((img, idx) => (
                    <div key={idx} className="image-extraction-card" style={{ background: 'white', borderRadius: '15px', overflow: 'hidden', border: '1px solid #d4a373', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                      <div style={{ position: 'relative', height: '200px', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={img.url} alt={`Extracted ${idx}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem' }}>
                          Page {img.page}
                        </div>
                      </div>
                      <div style={{ padding: '15px' }}>
                        <h5 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#8b7355', textTransform: 'uppercase' }}>Image Explanation</h5>
                        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5', color: '#4a342e' }}>{img.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div style={{ padding: '15px 20px', borderTop: '1px solid #eee', background: 'white', textAlign: 'right' }}>
              <button className="home-cta-btn" onClick={() => setShowImagesModal(false)} style={{ width: 'auto', padding: '0 25px' }}>Close Gallery</button>
            </div>
          </div>
        </div>
      )}

      {showBookmarks && (
        <div className="text-modal-overlay" onClick={() => setShowBookmarks(false)}>
          <div className="text-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bookmark size={24} color="#e07a5f" fill="#e07a5f" />
                <h3 style={{ margin: 0, color: '#4a342e', fontFamily: "'Alice', serif" }}>Your Bookmarks</h3>
              </div>
              <button onClick={() => setShowBookmarks(false)} className="close-thumbnails" style={{ background: 'none', border: 'none', cursor: 'pointer' }}><CloseIcon size={24} /></button>
            </div>
            <div className="bookmarks-list">
              {bookmarks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8b7355' }}>
                  <Bookmark size={48} style={{ opacity: 0.2, marginBottom: '15px' }} />
                  <p>No bookmarks yet. Click the bookmark icon to save a page!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {bookmarks.map((page) => (
                    <div key={page} className={`bookmark-item ${narratingPage === page ? 'is-narrating' : ''}`} onClick={() => { setCurrentPage(page); setShowBookmarks(false); if(data?.is_pdf) scrollToPdfPage(page); else scrollToTextPage(page); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: 'white', borderRadius: '10px', border: '1px solid #eee', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontWeight: 'bold', color: '#4a342e' }}>Page {page}</div>
                        {narratingPage === page && (
                          <div className="now-reading-tag" style={{ fontSize: '0.6rem', background: '#e07a5f', color: 'white', padding: '2px 6px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Volume2 size={10} /> Reading
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleBookmark(page); }}
                        style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '5px' }}
                        title="Remove Bookmark"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Zoom Controls - Bottom Right */}
      <FloatingZoomControls 
        zoomLevel={zoomLevel} 
        setZoomLevel={setZoomLevel} 
      />

      {/* Floating Voice Assistant - Professional Pill */}
      <div 
        className={`voice-assistant-pill ${voiceActive ? 'active-voice' : ''}`} 
        onClick={() => setVoiceActive(!voiceActive)}
        title="Toggle Voice Assistant (V)"
      >
        <div className="header-icon">
          {voiceActive ? <Mic size={20} /> : <MicOff size={20} />}
        </div>
        <span className="voice-text">Access icons by text or voice</span>
      </div>

      {/* Reading Progress Bar */}
      <div className="reading-progress-container">
        <div className="reading-progress-fill" style={{ width: `${numPages > 0 ? (currentPage / numPages) * 100 : 0}%` }}></div>
        <div className="reading-progress-text">{Math.round(numPages > 0 ? (currentPage / numPages) * 100 : 0)}% Read</div>
      </div>
      {/* View controls moved to header */}

      {viewMode === 'thumbnails' && (
        <div className="thumbnail-overlay fade-in" onClick={() => setViewMode('single')}>
          <div className="thumbnail-grid-container" onClick={(e) => e.stopPropagation()}>
            <div className="thumbnail-header">
              <h3>All Pages</h3>
              <button className="close-thumbnails" onClick={() => setViewMode('single')}><CloseIcon size={24} /></button>
            </div>
            <div className="thumbnail-grid">
              {pages.map((p, idx) => (
                <div key={idx} className={`thumbnail-item ${narratingPage === idx + 1 ? 'is-narrating' : ''} ${currentPage === idx + 1 ? 'active' : ''}`} onClick={() => { setCurrentPage(idx + 1); setViewMode('single'); if(data?.is_pdf) scrollToPdfPage(idx+1); else scrollToTextPage(idx+1); }}>
                  <div className="thumbnail-page-box">
                    <span className="thumb-page-num">{idx + 1}</span>
                    <div className="thumb-content-preview">
                       {p.slice(0, 100)}...
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Floating Context Menu */}
      {selection && (
        <div 
          className="floating-context-menu" 
          style={{ 
            position: 'absolute', 
            left: `${selection.x}px`, 
            top: `${selection.y}px`,
            transform: 'translate(-50%, -120%)',
            zIndex: 10000
          }}
        >
          <div className="context-menu-inner">
            <button onClick={handleReadSelection} title="Read Aloud" className="ctx-btn read">
              <Volume2 size={16} />
              <span>Read</span>
            </button>
            <button onClick={handleExplainSelection} title="AI Explanation" className="ctx-btn explain">
              <Sparkles size={16} />
              <span>Explain</span>
            </button>
            {selection.isHighlight ? (
              <button onClick={handleUnhighlight} title="Remove Highlight" className="ctx-btn remove">
                <Trash2 size={16} />
                <span>Remove</span>
              </button>
            ) : (
              <button onClick={handleHighlight} title="Highlight Text" className="ctx-btn highlight">
                <Highlighter size={16} />
                <span>Highlight</span>
              </button>
            )}
            <div className="ctx-divider"></div>
            <button className="close-context" onClick={() => setSelection(null)}>
              <CloseIcon size={14} />
            </button>
          </div>
          <div className="context-menu-arrow"></div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
};

export default ReaderPage;