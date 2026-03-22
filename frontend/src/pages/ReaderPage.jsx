import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import ToolPanel from '../components/ToolPanel';
import VoiceController from '../components/VoiceController';
import {
  ChevronLeft, ChevronRight, Book, Highlighter, Search,
  X as CloseIcon, User, Volume2, Globe, Command, Keyboard, Play, Languages,
  FileText, Info, MessageSquare, BookOpen, Mic, MicOff
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
  const [voiceActive, setVoiceActive] = useState(false);
  const [isReadMode, setIsReadMode] = useState(false);

  // Narration States
  const [isPlaying, setIsPlaying] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [narratingPage, setNarratingPage] = useState(1);
  const [audioUrl, setAudioUrl] = useState(null);
  const [narrationSpeed, setNarrationSpeed] = useState('1.0x'); 
  const [narrationGender, setNarrationGender] = useState('f');
  const [showShortcuts, setShowShortcuts] = useState(false);

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
        else if (key === 'r') { e.preventDefault(); handleToolClick('speak'); startNarration(); }
        else if (key === 'm') { e.preventDefault(); handleToolClick('meaning'); }
        else if (key === 't') { e.preventDefault(); handleReadTranslationClick(); }
        else if (key === 'f') { e.preventDefault(); setIsReadMode(!isReadMode); }
        else if (key === 'v') { e.preventDefault(); setVoiceActive(!voiceActive); }
        else if (key === 'x') { e.preventDefault(); setShowText(!showText); }
        else if (key === '/') { e.preventDefault(); setShowSearch(!showSearch); }
        else if (key === 'h') { e.preventDefault(); setShowShortcuts(prev => !prev); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNarrating, isPlaying, pages.length, currentPage, numPages, data, isReadMode, voiceActive, showText, showSearch]);

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  const restartNarration = () => {
    stopNarration();
    setTimeout(() => { startNarration(1); }, 100);
  };

  const startNarration = async (startPage = null) => {
    if (isNarrating) {
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
          body: new URLSearchParams({ text: nextText, filename, lang: currentLang, rate, gender: narrationGender })
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

    const totalPages = pages.length;
    const pageText = pages[pageNum - 1];

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
          body: new URLSearchParams({ text: pageText, filename, lang: currentLang, rate, gender: narrationGender })
        });
        result = await resp.json();
      }

      if (result.audio_url && isNarratingRef.current) {
        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.src = result.audio_url;
        setAudioUrl(result.audio_url);
        audioRef.current.onplay = () => { setIsPlaying(true); preFetchNextPage(pageNum + 1); };
        audioRef.current.onended = () => {
          if (isNarratingRef.current && narratingPageRef.current < pages.length) {
            const next = narratingPageRef.current + 1;
            setNarratingPage(next);
            narratingPageRef.current = next;
            playPage(next);
          } else { stopNarration(); }
        };
        await audioRef.current.play();
      }
    } catch (err) { console.error("Narration error:", err); stopNarration(); }
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
      if (selected && selected.length >= 1) {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelection({
            text: selected,
            x: rect.left + rect.width / 2,
            y: rect.top < 100 ? rect.bottom + 10 : rect.top,
            range: range.cloneRange()
          });
          setWord(selected);
        }
      } else {
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

  const handleReadSelection = async () => {
    if (!selection || !selection.text) return;
    if (isNarrating) stopNarration();
    try {
      const rateMap = { '0.5x': '-50%', '0.75x': '-25%', '1.0x': '+0%', '1.25x': '+25%', '1.5x': '+50%', '2.0x': '+100%' };
      const rate = rateMap[narrationSpeed] || '+0%';
      const resp = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams({ text: selection.text, filename, lang: currentLang, rate, gender: narrationGender })
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
    if (selection && selection.range) {
      try {
        const range = selection.range;
        const highlightId = 'hl-' + Date.now();
        const nodes = [];
        if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
          nodes.push(range.startContainer);
        } else {
          const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT, null, false);
          let currentNode = walker.nextNode();
          while (currentNode) {
            if (range.intersectsNode(currentNode)) nodes.push(currentNode);
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
              const content = nodeRange.extractContents();
              span.appendChild(content);
              nodeRange.insertNode(span);
            }
          } catch (err) { console.warn("Highlight node error:", err); }
        });
        window.getSelection().removeAllRanges();
        setSelection(null);
      } catch (e) { console.error("Highlighting failed:", e); setSelection(null); }
    }
  };

  const handleUnhighlight = () => {
    if (activeHighlight) {
      const highlightId = activeHighlight.getAttribute('data-highlight-id');
      if (highlightId) {
        const allParts = document.querySelectorAll(`.user-highlight[data-highlight-id="${highlightId}"]`);
        allParts.forEach(part => {
          const parent = part.parentNode;
          while (part.firstChild) parent.insertBefore(part.firstChild, part);
          parent.removeChild(part);
        });
      } else {
        const parent = activeHighlight.parentNode;
        while (activeHighlight.firstChild) parent.insertBefore(activeHighlight.firstChild, activeHighlight);
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
      if (!hasAutoSetLang && result.detected_lang && result.detected_lang !== currentLang && currentLang === 'en') {
        setHasAutoSetLang(true);
        setCurrentLang(result.detected_lang);
      }
      if (result.text) {
        const parsed = parsePages(result.text);
        setPages(parsed);
        setNumPages(parsed.length);
        if (result.is_pdf && result.count) setNumPages(result.count);
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

  if (loading) return (
    <div className="loading-overlay active">
      <div className="magic-book-container"><div className="magic-book"></div></div>
      <p style={{ color: 'white', marginTop: '20px' }}>Magic Gathering Content...</p>
    </div>
  );

  if (!data) return <div style={{ color: 'white', padding: '100px', textAlign: 'center' }}>Error loading book: {filename}</div>;

  const handleToolClick = (tabId) => { setActiveTab(tabId); setShowPanel(true); };

  const highlightText = (text, highlight) => {
    if (!highlight || !highlight.trim() || !text) return text;
    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const regex = new RegExp(`(${escaped})`, 'giu');
      const parts = text.split(regex);
      return (
        <span>
          {parts.map((part, i) =>
            part && part.toLowerCase() === highlight.toLowerCase() ?
              <mark key={i} className="search-highlight">{part}</mark> :
              part
          )}
        </span>
      );
    } catch (e) { return text; }
  };

  return (
    <div className={`reader-root ${isReadMode ? 'read-mode-active' : ''}`} onMouseUp={handleMouseUp}>
      <Header showBack={true} hideNav={true}>
        <div className="header-icon-container" title="Extracted Text (X)" onClick={() => setShowText(!showText)}>
          <div className="header-icon"><FileText size={18} color="#faedcd" /></div>
          <kbd className="shortcut-key-label">X</kbd>
          <span className="header-icon-label">Text</span>
        </div>
        <div className="header-icon-container" title="Summarize (S)" onClick={() => handleToolClick('summary')}>
          <div className="header-icon"><Info size={18} color="#faedcd" /></div>
          <kbd className="shortcut-key-label">S</kbd>
          <span className="header-icon-label">Summary</span>
        </div>
        <div className="header-icon-container" title="Ask AI (A)" onClick={() => handleToolClick('ask')}>
          <div className="header-icon"><MessageSquare size={18} color="#faedcd" /></div>
          <kbd className="shortcut-key-label">A</kbd>
          <span className="header-icon-label">Ask AI</span>
        </div>
        <div className="header-icon-container" title="Read Aloud (R)" onClick={() => { handleToolClick('speak'); startNarration(); }}>
          <div className="header-icon"><BookOpen size={18} color="#faedcd" /></div>
          <kbd className="shortcut-key-label">R</kbd>
          <span className="header-icon-label">Read</span>
        </div>
        <div className="header-icon-container" title="Meaning (M)" onClick={() => handleToolClick('meaning')}>
          <div className="header-icon"><Book size={18} color="#faedcd" /></div>
          <kbd className="shortcut-key-label">M</kbd>
          <span className="header-icon-label">Meaning</span>
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
        <div className={`header-icon-container ${voiceActive ? 'active-voice' : ''}`} title="Voice Control (V)" onClick={() => setVoiceActive(!voiceActive)}>
          <div className="header-icon">
            {voiceActive ? <Mic size={18} color="#e07a5f" /> : <MicOff size={18} color="#faedcd" />}
            {voiceActive && <div className="voice-icon-pulse"></div>}
          </div>
          <kbd className="shortcut-key-label">V</kbd>
          <span className="header-icon-label">Voice</span>
        </div>
        <div className={`header-icon-container ${isReadMode ? 'active-focus' : ''}`} title="Focus Mode (F)" onClick={() => setIsReadMode(!isReadMode)}>
          <div className="header-icon"><Highlighter size={18} color={isReadMode ? "#ffffff" : "#faedcd"} style={{ transform: 'rotate(45deg)' }} /></div>
          <kbd className="shortcut-key-label">F</kbd>
          <span className="header-icon-label">Focus</span>
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
        />

        <div style={{ flex: 1, display: 'flex', padding: '10px', gap: '10px', position: 'relative' }}>
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

          <div className={`original-file-viewer ${currentLang.toLowerCase() !== (data?.detected_lang || 'en').toLowerCase() ? 'translating' : ''}`} style={{ flex: 1, display: 'flex', background: 'transparent', borderRadius: '12px', position: 'relative' }}>
            <div className="viewer-content">
              {data.is_pdf ? (
                <div ref={viewerRef} onScroll={handlePdfScroll} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', scrollBehavior: 'smooth' }}>
                  {pdfError ? (
                    <div className="error-preview">Failed to load PDF locally.</div>
                  ) : (
                    <Document
                      file={`/uploads/${data.preview_filename}`}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={() => setPdfError(true)}
                      loading={<div style={{ padding: '20px' }}>Loading PDF...</div>}
                      className="pdf-document"
                    >
                      {Array.from(new Array(numPages || 0), (el, index) => {
                        const pageNum = index + 1;
                        const isVisible = (numPages <= 40) || (Math.abs(pageNum - currentPage) <= 5);
                        return (
                          <div key={`page_${pageNum}`} data-page-number={pageNum} style={{ position: 'relative', minHeight: isVisible ? 'auto' : '820px', width: '100%', display: 'flex', justifyContent: 'center', padding: '20px 0', background: 'transparent' }}>
                            {isVisible ? (
                              <>
                                <Page pageNumber={pageNum} width={Math.min(window.innerWidth * 0.8, 800)} renderAnnotationLayer={true} renderTextLayer={true} loading={<div style={{ height: '800px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)' }}>Loading...</div>} />
                                {showOverlay && pages[index] && (
                                  <div className="page-translation-overlay">
                                    <div className="page-translation-card">{highlightText(pages[index], searchTerm)}</div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div style={{ height: '800px', width: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '2px dashed rgba(0,0,0,0.1)' }}>
                                <div style={{ textAlign: 'center' }}><div className="magic-book-tiny"></div><p>Magic Gathering Content...</p></div>
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
                  <div ref={viewerRef} className={`react-pdf-page book-text-page ${narratingPage === currentPage ? 'narrating' : ''}`} onClick={() => startNarration(currentPage)} style={{ cursor: 'pointer' }}>
                    <div className="book-text-content">{highlightText(pages[currentPage - 1], searchTerm)}</div>
                  </div>
                  {showOverlay && pages[currentPage - 1] && (
                    <div className="page-translation-overlay"><div className="page-translation-card">{highlightText(pages[currentPage - 1], searchTerm)}</div></div>
                  )}
                  <div className="pdf-navigation" style={{ marginTop: '20px' }}>
                    <button className="nav-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(prev => prev - 1)}><ChevronLeft size={20} /> Previous</button>
                    <span className="page-info">Page {currentPage} of {numPages}</span>
                    <button className="nav-btn" disabled={currentPage >= numPages} onClick={() => setCurrentPage(prev => prev + 1)}>Next <ChevronRight size={20} /></button>
                  </div>
                </div>
              ) : data.is_office ? (
                <div style={{ position: 'relative' }}>
                  <div dangerouslySetInnerHTML={{ __html: data.office_html }} className="office-viewer" />
                  {showOverlay && data.text && (
                    <div className="page-translation-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}><div className="page-translation-card">{highlightText(data.text, searchTerm)}</div></div>
                  )}
                </div>
              ) : data.is_image ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={`/uploads/${data.filename}`} alt="Book Page" style={{ objectFit: 'contain' }} />
                  {showOverlay && data.text && (
                    <div className="page-translation-overlay"><div className="page-translation-card">{highlightText(data.text, searchTerm)}</div></div>
                  )}
                </div>
              ) : data.is_video ? ( <video src={`/uploads/${data.filename}`} controls /> ) : null}
            </div>
          </div>

          <div className="side-decoration-right">
            <div className="shortcuts-guide-premium">
              <div className="shortcuts-header"><Keyboard size={18} color="#e07a5f" /><span>Magic Keys</span></div>
              <div className="shortcuts-list">
                <div className="shortcut-item"><kbd>S</kbd> <span>Summary</span></div>
                <div className="shortcut-item"><kbd>A</kbd> <span>Ask AI</span></div>
                <div className="shortcut-item"><kbd>R</kbd> <span>Read Aloud</span></div>
                <div className="shortcut-item"><kbd>T</kbd> <span>Translate</span></div>
                <div className="shortcut-item"><kbd>M</kbd> <span>Meaning</span></div>
                <div className="shortcut-item"><kbd>F</kbd> <span>Focus Mode</span></div>
                <div className="shortcut-item"><kbd>V</kbd> <span>Voice Ctrl</span></div>
                <div className="shortcut-item"><kbd>X</kbd> <span>Full Text</span></div>
                <div className="shortcut-item"><kbd>/</kbd> <span>Search</span></div>
                <div className="shortcut-divider"></div>
                <div className="shortcut-item"><kbd>Space</kbd> <span>Play/Pause</span></div>
                <div className="shortcut-item"><kbd>←</kbd> <kbd>→</kbd> <span>Navigate</span></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {selection && (
        <div className="floating-context-menu" style={{ left: selection.x, top: selection.y, transform: 'translateX(-50%) translateY(-100%)', marginTop: '-10px', position: 'fixed', display: 'flex', gap: '8px', background: '#4a342e', padding: '8px 12px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 10001, border: '1px solid #d4a373' }} onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
          <div onClick={(e) => { e.stopPropagation(); handleToolClick('meaning'); setSelection(null); }} className="context-menu-btn" title="Find Meaning"><Book size={18} /><span>Meaning</span></div>
          <div onClick={(e) => { e.stopPropagation(); handleReadSelection(); }} className="context-menu-btn" title="Read Selection"><Play size={18} /><span>Read</span></div>
          {selection.isHighlight ? (
            <div onClick={(e) => { e.stopPropagation(); handleUnhighlight(); }} className="context-menu-btn" title="Remove Highlight" style={{ color: '#e74c3c' }}><Highlighter size={18} /><span>Unhighlight</span></div>
          ) : selection.range && (
            <div onClick={(e) => { e.stopPropagation(); handleHighlight(); }} className="context-menu-btn" title="Highlight Text"><Highlighter size={18} /><span>Highlight</span></div>
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
                  {highlightText(p, searchTerm)}
                </div>
              ))}
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
    </div>
  );
};

export default ReaderPage;
