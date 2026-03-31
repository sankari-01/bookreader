import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Home, Book, Upload, BookOpen, GripVertical, X, Search } from 'lucide-react';
import RecommendationModal from './RecommendationModal';

const Header = ({ subtitle, originalLang, showBack = false, hideNav = false, children, moreTools, leftContent }) => {
  const [isToolsOpen, setIsToolsOpen] = React.useState(false);
  const [showRecs, setShowRecs] = React.useState(false);
  const [toolSearch, setToolSearch] = React.useState('');
  const menuRef = React.useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const isLibraryPage = path === '/files';
  const showHomeIcon = path !== '/';
  const showLibraryIcon = !isLibraryPage && path !== '/';
  const showUploadIcon = isLibraryPage;

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header style={{ 
      height: '80px', 
      display: 'flex', 
      alignItems: 'center', 
      padding: '0 20px', 
      position: 'sticky', 
      top: 0, 
      zIndex: 1000,
      background: 'rgba(74, 52, 46, 0.95)', /* Dark parchment/wood theme */
      backdropFilter: 'blur(10px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      borderBottom: '1px solid rgba(212, 163, 115, 0.2)'
    }}>
      <div className="header-left" style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: '15px' }}>
        {isLibraryPage ? (
          <div className="header-icon-container" title="Home" onClick={() => navigate('/')}>
            <div className="header-icon">
              <Home size={18} />
            </div>
            <span className="header-icon-label">Home</span>
          </div>
        ) : showBack ? (
          <div className="header-icon-container" title="Library" onClick={() => navigate('/files')}>
            <div className="header-icon">
              <Book size={18} />
            </div>
            <span className="header-icon-label">Library</span>
          </div>
        ) : null}
        {leftContent}
      </div>

      <div className="header-center" style={{ flex: 2, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Book className="animated-book-icon" size={36} color="#e07a5f" />
          <div className="header-title-animated">AI BOOK READER</div>
        </div>
      </div>

      <div className="header-tools" style={{ flex: 1.5, justifyContent: 'flex-end', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isLibraryPage ? (
          <div className="header-icon-container" title="Upload" onClick={() => navigate('/upload')}>
            <div className="header-icon">
              <Upload size={18} />
            </div>
            <span className="header-icon-label">Upload</span>
          </div>
        ) : (
          <>
            {children}
            <div className="tools-menu-wrapper" ref={menuRef}>
              <div 
                className={`header-icon-container tools-toggle-btn ${isToolsOpen ? 'active' : ''}`} 
                title="Tools" 
                onClick={() => setIsToolsOpen(!isToolsOpen)}
              >
                <div className="header-icon">
                  {isToolsOpen ? <X size={18} /> : <GripVertical size={18} />}
                </div>
                <span className="header-icon-label">Tools</span>
              </div>

              {isToolsOpen && (
                <div className="vertical-tools-dropdown">
                  <div className="tool-search-container">
                    <div className="tool-search-input-wrapper">
                      <Search size={14} className="tool-search-icon" />
                      <input 
                        type="text" 
                        className="tool-search-input" 
                        placeholder="Search tools..." 
                        value={toolSearch}
                        onChange={(e) => setToolSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>

                  {!hideNav && (
                    <>
                      {showHomeIcon && "home".includes(toolSearch.toLowerCase()) && (
                        <Link to="/" className="tool-item-vertical" onClick={() => setIsToolsOpen(false)}>
                          <div className="icon-box"><Home size={18} /></div>
                          <span className="label">Home</span>
                        </Link>
                      )}
                      {showLibraryIcon && "library".includes(toolSearch.toLowerCase()) && (
                        <Link to="/files" className="tool-item-vertical" onClick={() => setIsToolsOpen(false)}>
                          <div className="icon-box"><Book size={18} /></div>
                          <span className="label">Library</span>
                        </Link>
                      )}
                      {showUploadIcon && "upload".includes(toolSearch.toLowerCase()) && (
                        <Link to="/upload" className="tool-item-vertical" onClick={() => setIsToolsOpen(false)}>
                          <div className="icon-box"><Upload size={18} /></div>
                          <span className="label">Upload</span>
                        </Link>
                      )}
                      {"recommendations".includes(toolSearch.toLowerCase()) && (
                        <button className="tool-item-vertical" onClick={() => { setShowRecs(true); setIsToolsOpen(false); }}>
                          <div className="icon-box"><BookOpen size={18} /></div>
                          <span className="label">Recommendations</span>
                        </button>
                      )}
                    </>
                  )}
                  {/* Render dynamic moreTools (reader extensions) within the vertical menu */}
                  {moreTools && (
                    <div className="dynamic-tools-section" style={{ borderTop: '1px solid rgba(212, 163, 115, 0.2)', paddingTop: '8px', marginTop: '4px' }}>
                      {React.Children.map(moreTools, child => {
                        if (!React.isValidElement(child)) return null;
                        const toolTitle = child.props.title || '';
                        if (!toolTitle.toLowerCase().includes(toolSearch.toLowerCase())) return null;
                        return (
                          <div className="vertical-child-wrapper" onClick={() => setIsToolsOpen(false)}>
                            {child}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <RecommendationModal isOpen={showRecs} onClose={() => setShowRecs(false)} />
    </header>
  );
};

export default Header;
