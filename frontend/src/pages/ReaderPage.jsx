import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import ToolPanel from '../components/ToolPanel';
import VoiceController from '../components/VoiceController';
import {
  ChevronLeft, ChevronRight, Book, Highlighter, Search,
  X as CloseIcon, User, Volume2, Globe, Command, Keyboard, Play, Languages,
  FileText, Info, MessageSquare, BookOpen, Mic, MicOff, Download, Trash2,
  HelpCircle, CheckCircle2, AlertCircle, Timer, Award, ChevronRight as ChevronRightIcon,
  RotateCcw, FileImage, Loader2, Brain, Columns2, LayoutGrid, ZoomIn, ZoomOut, Square
} from 'lucide-react';
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

  // Clean each page: trim whitespace
  const refinedParts = parts.map(p => p.trim());

  // If the book starts with a marker (very common), parts[0] is an empty string before the first split.
  // We remove this first empty component, but PRESERVE all other empty strings (which represent blank pages).
  if (refinedParts.length > 0 && refinedParts[0] === "") {
    refinedParts.shift();
  }

  console.log(`Parsed ${refinedParts.length} pages from text (length: ${text.length})`);
  return refinedParts;
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
  const [originalPages, setOriginalPages] = useState([]);

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
  const [isFetchingSummary, setIsFetchingSummary] = useState(false);
  const [summaryData, setSummaryData] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);

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
  const [quizMessage, setQuizMessage] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const [isReadMode, setIsReadMode] = useState(false);
  const [userHighlights, setUserHighlights] = useState(() => {
    try {
      const saved = localStorage.getItem(`highlights_${filename}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

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
      if (result.images) {
        setExtractedImages(result.images);
      }
    } catch (e) {
      console.error("Image extraction failed:", e);
    } finally {
      setImagesLoading(false);
    }
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
      if (result.short_questions || result.long_questions) {
        setPredictionData(result);
      } else if (result.error) {
        alert(result.error);
        setShowPredictionModal(false);
      }
    } catch (e) {
      console.error("Prediction failed:", e);
      alert("Could not reach the AI Service.");
      setShowPredictionModal(false);
    } finally {
      setPredictionLoading(false);
    }
  };

  const updateTimestamp = async (type) => {
    try {
      await fetch('/api/book/timestamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ filename, type })
      });
    } catch (e) {
      console.error(`Failed to update ${type} timestamp:`, e);
    }
  };

  useEffect(() => {
    if (filename) {
      updateTimestamp('opened');
    }
    
    const handleUnload = () => {
      const formData = new FormData();
      formData.append('filename', filename);
      formData.append('type', 'closed');
      navigator.sendBeacon('/api/book/timestamp', formData);
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      updateTimestamp('closed');
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [filename]);

  useEffect(() => {
    localStorage.setItem(`highlights_${filename}`, JSON.stringify(userHighlights));
  }, [userHighlights, filename]);

  // Narration States
  const [isPlaying, setIsPlaying] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [isNarrationLoading, setIsNarrationLoading] = useState(false);
  const [narratingPage, setNarratingPage] = useState(1);
  const [audioUrl, setAudioUrl] = useState(null);
  const [narrationSpeed, setNarrationSpeed] = useState('1.0x'); 
  const [narrationGender, setNarrationGender] = useState('f');
  const [isSongMode, setIsSongMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeCues, setActiveCues] = useState([]);
  const [activeCueIndex, setActiveCueIndex] = useState(-1);

  // Refs for stable narration across renders
  const isAutoScrollingRef = useRef(false);
  const audioRef = useRef(null);
  const isNarratingRef = useRef(false);
  const narratingPageRef = useRef(1);
  const preFetchedAudioRef = useRef(null); 
  const preFetchPromiseRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
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
        if (key === 's') { e.preventDefault(); handleToolClick('summary'); }
        else if (key === 'a') { e.preventDefault(); handleToolClick('ask'); }
        else if (key === 'r') { e.preventDefault(); handleToolClick('speak'); if (!isNarrating) startNarration(); }
        else if (key === 'm') { e.preventDefault(); handleToolClick('meaning'); }
        else if (key === 't') { e.preventDefault(); handleReadTranslationClick(); }
        else if (key === 'f') { e.preventDefault(); setIsReadMode(!isReadMode); }
        else if (key === 'v') { e.preventDefault(); setVoiceActive(!voiceActive); }
        else if (key === 'x') { e.preventDefault(); setShowText(!showText); }
        else if (key === '/') { e.preventDefault(); setShowSearch(!showSearch); }
        else if (key === 'k') { e.preventDefault(); setShowHighlights(true); }
        else if (key === 'q') { e.preventDefault(); handleStartQuiz(); }
        else if (key === 'p') { e.preventDefault(); handleStartPrediction(); }
        else if (key === 'i') { e.preventDefault(); if (data?.has_images) handleExtractImages(); }
        else if (key === 'h') { e.preventDefault(); /* Global help or toggle labels? */ }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filename, currentLang]);

  const applyHighlightsToElement = (element) => {
    if (!element) return;
    const terms = [];
    if (searchTerm && searchTerm.trim()) terms.push({ text: searchTerm.trim(), type: 'search' });
    userHighlights.forEach(uh => { if (uh && uh.trim()) terms.push({ text: uh.trim(), type: 'user' }); });
    if (terms.length === 0) return;

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    let node;
    while (node = walker.nextNode()) nodes.push(node);

    nodes.forEach(textNode => {
      const content = textNode.nodeValue;
      if (!content || content.trim().length === 0) return;
      
      let newHtml = content;
      let hasMatch = false;

      const sortedTerms = [...terms].sort((a, b) => b.text.length - a.text.length);

      sortedTerms.forEach(term => {
        const escaped = term.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})(?![^<]*>)`, 'gi');
        if (regex.test(newHtml)) {
          hasMatch = true;
          const className = term.type === 'search' ? 'search-highlight' : 'user-highlight';
          newHtml = newHtml.replace(regex, (match) => `<mark class="${className}" style="color: transparent !important; background-color: ${term.type === 'search' ? 'rgba(255, 218, 106, 0.4)' : 'rgba(255, 224, 102, 0.6)'} !important;">${match}</mark>`);
        }
      });

      if (hasMatch) {
        const span = document.createElement('span');
        span.className = 'highlight-container';
        span.innerHTML = newHtml;
        if (textNode.parentNode) textNode.parentNode.replaceChild(span, textNode);
      }
    });
  };

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
  }, [narrationSpeed, narrationGender]);

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
      return;
    }

    setShowOverlay(true);
    setIsAnalyzing(true);
    setAnalyzingPage(0);

    let p = 0;
    const interval = setInterval(() => {
      p += 2;
      if (p > 95) p = 95; 
      setAnalyzingPage(p);
    }, 100);

    try {
      await fetch('/api/prepare_translation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ filename, lang: newLang })
      });
    } catch (e) {
      console.error("Preparation failed:", e);
    } finally {
      clearInterval(interval);
      setAnalyzingPage(100);
      setTimeout(() => {
        setIsAnalyzing(false);
        setCurrentLang(newLang);
        setSummaryData('');
      }, 500);
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
      case 'read': handleToolClick('speak'); startNarration(); break;
      case 'pause': togglePlayback(); break;
      default: console.log("Unknown voice command:", command);
    }
  };

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
    setIsNarrating(false);
    setIsPlaying(false);
    setIsNarrationLoading(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  const restartNarration = () => {
    stopNarration();
    setTimeout(() => { startNarration(1); }, 100);
  };

  const parseVTT = (vttText) => {
    const cues = [];
    const blocks = vttText.split(/\n\n+/);
    blocks.forEach(block => {
      const match = block.match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\n(.*)/s);
      if (match) {
        const startRaw = match[1].split(':');
        const startSec = (parseInt(startRaw[0]) * 3600) + (parseInt(startRaw[1]) * 60) + parseFloat(startRaw[2]);
        const endRaw = match[2].split(':');
        const endSec = (parseInt(endRaw[0]) * 3600) + (parseInt(endRaw[1]) * 60) + parseFloat(endRaw[2]);
        cues.push({ start: startSec, end: endSec, word: match[3].trim() });
      }
    });
    return cues;
  };

  const startNarration = async (startPage = null) => {
    if (isNarratingRef.current && startPage === null) {
      stopNarration();
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.play().then(() => { audioRef.current.pause(); }).catch(e => console.log("Audio unlock:", e));

    setIsNarrating(true);
    isNarratingRef.current = true;

    if (pages.length === 0 && data?.text) {
      const reParsed = parsePages(data.text);
      setPages(reParsed);
      if (reParsed.length === 0) {
        stopNarration();
        return;
      }
    }

    const pageToStart = startPage || currentPage || 1;
    setNarratingPage(pageToStart);
    narratingPageRef.current = pageToStart;
    setTimeout(() => { playPage(pageToStart); }, 100);
  };

  const preFetchNextPage = (nextPageNum) => {
    if (!isNarratingRef.current || nextPageNum > pages.length) return;
    const nextText = pages[nextPageNum - 1];
    if (!nextText || nextText.trim() === "" || nextText.includes('[Empty Page]')) {
      preFetchNextPage(nextPageNum + 1);
      return;
    }
    const rateMap = { '0.5x': '-50%', '0.75x': '-25%', '1.0x': '+0%', '1.25x': '+25%', '1.5x': '+50%', '2.0x': '+100%' };
    const rate = rateMap[narrationSpeed] || '+0%';

    preFetchPromiseRef.current = (async () => {
      try {
        const resp = await fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
          body: new URLSearchParams({ text: nextText, filename, lang: data?.detected_lang || currentLang, rate, gender: narrationGender, is_song: isSongMode, expressive: 'false' })
        });
        const result = await resp.json();
        if (result.audio_url) {
          const res = { pageNum: nextPageNum, ...result };
          preFetchedAudioRef.current = res;
          return res;
        }
      } catch (err) { console.warn("Pre-fetch error:", err); }
      return null;
    })();
  };

  const playPage = async (pageNum) => {
    if (!isNarratingRef.current) return;
    setNumPages(pages.length);
    setCurrentPage(pageNum);
    if (data?.is_pdf) scrollToPdfPage(pageNum);
    else scrollToTextPage(pageNum);

    const totalPages = originalPages.length || pages.length;
    const pageText = (originalPages.length > 0 ? originalPages[pageNum - 1] : pages[pageNum - 1]);
    if (!pageText || pageText.trim() === "" || pageText.includes('[Empty Page]')) {
      if (isNarratingRef.current && pageNum < totalPages) {
        const next = pageNum + 1;
        setNarratingPage(next);
        narratingPageRef.current = next;
        playPage(next);
      } else { stopNarration(); }
      return;
    }

    try {
      setIsNarrationLoading(true);
      let result;
      if (preFetchPromiseRef.current) {
        const preFetched = await preFetchPromiseRef.current;
        if (preFetched && preFetched.pageNum === pageNum) { result = preFetched; }
        preFetchPromiseRef.current = null;
      }
      if (!result && preFetchedAudioRef.current && preFetchedAudioRef.current.pageNum === pageNum) {
        result = preFetchedAudioRef.current;
        preFetchedAudioRef.current = null;
      }
      if (!result) {
        const rateMap = { '0.5x': '-50%', '0.75x': '-25%', '1.0x': '+0%', '1.25x': '+25%', '1.5x': '+50%', '2.0x': '+100%' };
        const rate = rateMap[narrationSpeed] || '+0%';
        const resp = await fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
          body: new URLSearchParams({ text: pageText, filename, lang: data?.detected_lang || currentLang, rate, gender: narrationGender, is_song: isSongMode, expressive: 'false' })
        });
        result = await resp.json();
      }

      setIsNarrationLoading(false);

      if (result.audio_url && isNarratingRef.current) {
        // Handle VTT synchronization
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
          if (idx !== -1) setActiveCueIndex(idx);
        };

        audioRef.current.onplay = () => { setIsPlaying(true); preFetchNextPage(pageNum + 1); };
        audioRef.current.onended = () => {
          setActiveCueIndex(-1);
          setActiveCues([]);
          if (isNarratingRef.current && narratingPageRef.current < (originalPages.length || pages.length)) {
            const next = narratingPageRef.current + 1;
            setNarratingPage(next);
            narratingPageRef.current = next;
            playPage(next);
          } else { stopNarration(); }
        };
        await audioRef.current.play();
      } else {
        setIsNarrationLoading(false);
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

  const [selection, setSelection] = useState(null); 
  const [word, setWord] = useState('');
  const [activeHighlight, setActiveHighlight] = useState(null);
  const [selectionRects, setSelectionRects] = useState([]);

  const handleMouseUp = (e) => {
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
    setTimeout(() => {
      const selected = window.getSelection().toString().trim();
      const sel = window.getSelection();
      if (selected && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (Math.abs(range.getBoundingClientRect().height) > 2) {
          const isUserHighlighted = userHighlights.some(h => h.includes(selected) || selected.includes(h));
          setSelection({
            text: selected,
            x: e.clientX,
            y: e.clientY - 20,
            range: range.cloneRange(),
            isHighlight: e.target.classList.contains('user-highlight') || e.target.closest('.user-highlight') || isUserHighlighted
          });
          setActiveHighlight(e.target.closest('.user-highlight'));
          setWord(selected);
          
          // Capture rects for persistent selection UI
          const rects = Array.from(range.getClientRects()).map(r => ({
            left: r.left,
            top: r.top,
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
        if (!e.target.closest('.floating-context-menu') && !e.target.closest('.header-icon-container')) {
          setSelection(null);
          setWord('');
          setActiveHighlight(null);
          setSelectionRects([]);
        }
      }
    }, 10);
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
        body: new URLSearchParams({ text: selection.text, filename, lang: currentLang, rate, gender: narrationGender, is_song: isSongMode, expressive: 'false' })
      });
      const result = await resp.json();
      if (result.audio_url) {
        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.src = result.audio_url;
        audioRef.current.play();
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
      setSelection(null);
      setWord('');
      setSelectionRects([]);
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
        setNumPages(parsed.length);
        if (result.pages) setNumPages(result.pages);
        else if (result.count) setNumPages(result.count);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
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
      if (result.summary) setSummaryData(result.summary);
    } catch (err) { console.error("BG Summary Fetch Error:", err); }
    finally { setIsFetchingSummary(false); }
  };

  useEffect(() => {
    if (data && data.text && !summaryData) fetchSummary();
  }, [data, currentLang]);

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
            setSelection({
              text: selected,
              x: iframeRect.left + rect.left + rect.width / 2,
              y: iframeRect.top + rect.top - 60,
              range: null
            });
            setWord(selected);
          }
        } catch (e) { console.log("Iframe selection denied."); }
      }
    };
    const iframe = document.querySelector('iframe');
    if (iframe) {
      iframe.onload = () => {
        try { iframe.contentDocument.addEventListener('mouseup', handleIframeMouseUp); }
        catch (e) { console.log("Could not attach listener to iframe."); }
      };
    }
    return () => {
      if (iframe && iframe.contentDocument) {
        try { iframe.contentDocument.removeEventListener('mouseup', handleIframeMouseUp); }
        catch (e) { }
      }
    };
  }, [filename, currentLang]);


  // Handle Highlighting in PDF Text Layer
  useEffect(() => {
    if (!data?.is_pdf) return;
    // When search/highlights change, re-apply to all rendered pages
    const textLayers = document.querySelectorAll('.react-pdf__Page__textContent');
    textLayers.forEach(layer => {
      // Clear marks first
      const marks = layer.querySelectorAll('mark.search-highlight, mark.user-highlight');
      marks.forEach(m => {
        const parent = m.parentNode;
        if (parent) {
          while (m.firstChild) parent.insertBefore(m.firstChild, m);
          parent.removeChild(m);
        }
      });
      applyHighlightsToElement(layer);
    });
  }, [searchTerm, userHighlights, data?.is_pdf]);

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

  useEffect(() => {
    let interval;
    if (showQuiz && !quizFinished && !quizLoading && quizTimer > 0) {
      interval = setInterval(() => {
        setQuizTimer(prev => {
          if (prev <= 1) {
            handleFinishQuiz();
            return 0;
          }
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

  if (!data) return <div style={{ color: '#4a342e', padding: '100px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>Error loading book: {filename}<br/>(Please ensure the backend is running)</div>;

  const handleStartQuiz = async () => {
    setShowQuiz(true);
    if (quizQuestions.length === 0) {
      setQuizLoading(true);
      setQuizMessage('');
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
        } else if (result.error) {
          alert(result.error);
          setShowQuiz(false);
        } else {
          alert("Failed to generate quiz. Unknown error.");
          setShowQuiz(false);
        }
      } catch (e) { 
        console.error("Quiz fetch failed:", e);
        alert("Could not reach the AI Service. Please check if your backend is running."); 
        setShowQuiz(false);
      } finally {
        setQuizLoading(false);
      }
    }
  };

  const handleQuizAnswer = (questionIdx, optionIdx) => {
    if (quizFinished) return;
    setQuizAnswers(prev => ({ ...prev, [questionIdx]: optionIdx }));
  };



  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const handleToolClick = (tabId) => { setActiveTab(tabId); setShowPanel(true); };

  const highlightText = (text, highlight, activeWordIndex = -1) => {
    if (!text) return text;
    
    // Layer 1: Word-level splitting for narration
    // We only split by words if activeWordIndex is active to keep performance up.
    if (activeWordIndex !== -1) {
      // Split into space-separated words, but keep the space
      const parts = text.split(/(\s+)/);
      let wordCounter = 0;
      return (
        <>
          {parts.map((part, i) => {
            const isWord = /\S/.test(part);
            if (isWord) {
              const currentIdx = wordCounter++;
              if (currentIdx === activeWordIndex) {
                return <span key={i} className="active-narrate-word">{part}</span>;
              }
              // Still apply simple search highlighting for other words
              if (highlight && part.toLowerCase().includes(highlight.toLowerCase())) {
                return <mark key={i} className="search-highlight">{part}</mark>;
              }
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
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      
      let newResult = [];
      result.forEach(part => {
        if (part.isHighlight) {
          newResult.push(part);
        } else {
          const snippets = part.content.split(regex);
          snippets.forEach(snip => {
            if (snip && snip.toLowerCase() === term.toLowerCase()) {
              newResult.push({ content: snip, isHighlight: true, type });
            } else if (snip) {
              newResult.push({ content: snip, isHighlight: false, type: null });
            }
          });
        }
      });
      result = newResult;
    };

    // Apply search term
    splitParts(highlight, 'search');
    // Apply user highlights
    userHighlights.forEach(uh => splitParts(uh, 'user'));

    return (
      <>
        {result.map((part, i) => 
          part.isHighlight ? (
            <mark key={i} className={part.type === 'search' ? 'search-highlight' : 'user-highlight'}>
              {part.content}
            </mark>
          ) : (
            part.content
          )
        )}
      </>
    );
  };

  const highlightHtml = (html, search) => {
    if (!html) return html;
    let result = html;
    
    const apply = (term, className) => {
      if (!term || !term.trim()) return;
      const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})(?![^<]*>)`, 'gi');
      result = result.replace(regex, (match) => `<mark class="${className}">${match}</mark>`);
    };

    apply(search, 'search-highlight');
    userHighlights.forEach(uh => apply(uh, 'user-highlight'));
    return result;
  };

  return (
    <div className={`reader-root ${isReadMode ? 'read-mode-active' : ''}`} onMouseUp={handleMouseUp}>
      {/* Persistent Selection Overlay */}
      {selection && selectionRects.map((rect, i) => (
        <div key={i} style={{
          position: 'fixed',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          backgroundColor: 'rgba(0, 120, 215, 0.3)',
          pointerEvents: 'none',
          zIndex: 10000,
          borderRadius: '2px'
        }} />
      ))}
      <Header 
        subtitle={data?.filename} 
        originalLang={data?.detected_lang || 'en'} 
        showBack={true} 
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
            <div className="header-icon-container" title="Take a Quiz" onClick={() => handleStartQuiz()}>
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
        <div className={`header-icon-container search-btn-premium ${showSearch ? 'active' : ''}`} title="Search (/)" onClick={() => setShowSearch(!showSearch)}>
          <div className="header-icon">
            <Search size={18} color={showSearch ? "#ffffff" : "#faedcd"} />
            <div className="search-icon-pulse"></div>
          </div>
          <kbd className="shortcut-key-label">/</kbd>
          <span className="header-icon-label">Search</span>
        </div>
      </Header>

      {showSearch && (
        <div className="search-bar-inline">
          <div className="search-input-wrapper">
            <Search size={20} className="search-icon-inner" />
            <input
              type="text"
              placeholder="Search text or type a page number…"
              value={searchTerm}
              onChange={(e) => {
                const val = e.target.value;
                setSearchTerm(val);
                const pageMatch = val.trim().match(/^(?:p(?:age)?\s*)?(\d+)$/i);
                if (pageMatch) {
                  const target = parseInt(pageMatch[1], 10);
                  if (target >= 1 && target <= numPages) {
                    setPageJumpMsg(`Jumping to page ${target}`);
                    setCurrentPage(target);
                    if (data?.is_pdf) scrollToPdfPage(target);
                    else scrollToTextPage(target);
                  } else { setPageJumpMsg(`Page ${target} out of range`); }
                } else { setPageJumpMsg(''); }
              }}
              autoFocus
            />
            {searchTerm && <CloseIcon size={18} className="clear-search" onClick={() => { setSearchTerm(''); setPageJumpMsg(''); }} />}
          </div>
          {pageJumpMsg && <div className="page-jump-badge">{pageJumpMsg}</div>}
        </div>
      )}

      <div className="book-title-section">
        <h1 className="book-display-title">{data?.filename}</h1>
      </div>

      <main style={{ flex: 1, display: 'flex', position: 'relative' }}>
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
          onLanguageChange={(newLang) => { setCurrentLang(newLang); setSummaryData(''); }}
          isNarrating={isNarrating}
          isPlaying={isPlaying}
          narratingPage={narratingPage}
          togglePlayback={togglePlayback}
          onStopNarration={stopNarration}
          onRestartNarration={restartNarration}
          onStartNarration={startNarration}
          currentViewPage={currentPage}
          narrationSpeed={narrationSpeed}
          onSpeedChange={setNarrationSpeed}
          narrationGender={narrationGender}
          onGenderChange={setNarrationGender}
          isSongMode={isSongMode}
          onSongModeChange={setIsSongMode}
        />

        <div style={{ flex: 1, display: 'flex', padding: '10px', gap: '10px', position: 'relative' }}>

          {isNarrationLoading && (
            <div style={{ position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', background: '#e07a5f', color: '#fff', padding: '12px 24px', borderRadius: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1000, animation: 'fadeIn 0.3s ease' }}>
              <div style={{ width: '18px', height: '18px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <span style={{ fontSize: '0.95rem', fontWeight: '600', letterSpacing: '0.5px' }}>Preparing Audio...</span>
              <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          <div className={`original-file-viewer ${currentLang.toLowerCase() !== (data?.detected_lang || 'en').toLowerCase() ? 'translating' : ''}`} style={{ flex: 1, display: 'flex', background: 'transparent', borderRadius: '12px', position: 'relative' }}>
            <div className="viewer-content">
              {data.is_pdf ? (
                <div ref={viewerRef} onScroll={handlePdfScroll} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', scrollBehavior: 'smooth' }}>
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
                              <div key={`page_${pageNum}`} data-page-number={pageNum} className="pdf-page-container" style={{ position: 'relative', minHeight: isVisible ? 'auto' : '820px', width: '100%', display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
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
                <div style={{ position: 'relative' }}>
                  <div dangerouslySetInnerHTML={{ __html: highlightHtml(data.office_html, searchTerm) }} className="office-viewer" />
                  {showOverlay && data.text && (
                    <div className="page-translation-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}><div className="page-translation-card">{highlightText(data.text, searchTerm, isNarrating ? activeCueIndex : -1)}</div></div>
                  )}
                </div>
              ) : data.is_image ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.05)', padding: '40px 0' }}>
                  <div className="image-page-container" style={{ position: 'relative', backgroundColor: '#ffffff', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', borderRadius: '4px', maxWidth: '800px', width: '90%', display: 'flex', justifyContent: 'center' }}>
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
                    <span className="page-info">Page 1 of 1</span>
                  </div>
                </div>
              ) : data.is_video ? ( 
                <video src={`/uploads/${encodeURIComponent(data.filename)}`} controls style={{ maxWidth: '100%' }} /> 
              ) : pages.length > 0 ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className={`text-view-container ${viewMode === 'double' ? 'double-mode' : ''}`} style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
                    <div ref={viewerRef} className={`react-pdf-page book-text-page ${narratingPage === currentPage ? 'narrating' : ''}`} onClick={() => startNarration(currentPage)} style={{ cursor: 'pointer' }}>
                      <div className="book-text-content">{highlightText(pages[currentPage - 1], searchTerm, narratingPage === currentPage ? activeCueIndex : -1)}</div>
                      {showOverlay && pages[currentPage - 1] && (
                        <div className="page-translation-overlay"><div className="page-translation-card">{highlightText(pages[currentPage - 1], searchTerm, narratingPage === currentPage ? activeCueIndex : -1)}</div></div>
                      )}
                    </div>
                    {viewMode === 'double' && currentPage < numPages && (
                      <div className={`react-pdf-page book-text-page ${narratingPage === currentPage + 1 ? 'narrating' : ''}`} onClick={() => startNarration(currentPage + 1)} style={{ cursor: 'pointer' }}>
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

        </div>
      </main>

      {selection && (
        <div className="floating-context-menu" style={{ left: selection.x, top: selection.y, transform: 'translateX(-50%) translateY(-100%)', marginTop: '-10px', position: 'fixed', display: 'flex', gap: '8px', background: '#4a342e', padding: '6px 10px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', zIndex: 10001, border: '1px solid #d4a373' }} onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
          <div onClick={(e) => { e.stopPropagation(); handleToolClick('meaning'); setSelection(null); }} className="context-menu-btn" title="Meaning"><Book size={18} /></div>
          <div onClick={(e) => { e.stopPropagation(); handleReadSelection(); }} className="context-menu-btn" title="Read Selection"><Play size={18} /></div>
          {selection.isHighlight ? (
            <div onClick={(e) => { e.stopPropagation(); handleUnhighlight(); }} className="context-menu-btn" title="Remove Highlight" style={{ color: '#e74c3c' }}><Highlighter size={18} /></div>
          ) : selection.range && (
            <div onClick={(e) => { e.stopPropagation(); handleHighlight(); }} className="context-menu-btn" title="Highlight"><Highlighter size={18} /></div>
          )}
        </div>
      )}

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

      <VoiceController isActive={voiceActive} setIsActive={setVoiceActive} onCommand={handleVoiceCommand} languages={allLanguages} />

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
                <button className="quiz-close-btn" onClick={() => { setShowQuiz(false); if(quizFinished) { setQuizQuestions([]); setQuizAnswers({}); setQuizFinished(false); } }}><CloseIcon size={24} /></button>
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
                      <button className="quiz-btn-secondary" onClick={() => { setShowQuiz(false); setQuizQuestions([]); setQuizAnswers({}); setQuizFinished(false); }}>Close</button>
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
      <div className="view-controls-pill">
        <button 
          className={`view-btn ${viewMode === 'single' ? 'active' : ''}`} 
          onClick={() => setViewMode('single')} 
          title="Single Page View"
        >
          <Square size={18} />
        </button>
        <button 
          className={`view-btn ${viewMode === 'double' ? 'active' : ''}`} 
          onClick={() => setViewMode('double')} 
          title="Two Page View"
        >
          <Columns2 size={18} />
        </button>
        <button 
          className={`view-btn ${viewMode === 'thumbnails' ? 'active' : ''}`} 
          onClick={() => setViewMode('thumbnails')} 
          title="Thumbnail View"
        >
          <LayoutGrid size={18} />
        </button>
        <div className="view-divider"></div>
        <button className="view-btn" onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))} title="Zoom Out">
          <ZoomOut size={18} />
        </button>
        <span className="zoom-label">{zoomLevel}%</span>
        <button className="view-btn" onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))} title="Zoom In">
          <ZoomIn size={18} />
        </button>
      </div>

      {viewMode === 'thumbnails' && (
        <div className="thumbnail-overlay fade-in" onClick={() => setViewMode('single')}>
          <div className="thumbnail-grid-container" onClick={(e) => e.stopPropagation()}>
            <div className="thumbnail-header">
              <h3>All Pages</h3>
              <button className="close-thumbnails" onClick={() => setViewMode('single')}><CloseIcon size={24} /></button>
            </div>
            <div className="thumbnail-grid">
              {pages.map((p, idx) => (
                <div key={idx} className="thumbnail-item" onClick={() => { setCurrentPage(idx + 1); setViewMode('single'); if(data?.is_pdf) scrollToPdfPage(idx+1); else scrollToTextPage(idx+1); }}>
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
    </div>
  );
};

export default ReaderPage;
