import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Home, Book, Upload } from 'lucide-react';

const Header = ({ subtitle, originalLang, showBack = false, hideNav = false, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const showHomeIcon = path !== '/';
  const showLibraryIcon = path !== '/files' && path !== '/';
  const showUploadIcon = path === '/files';

  return (
    <header style={{ height: '80px', display: 'flex', alignItems: 'center', padding: '0 20px' }}>
      <div className="header-left" style={{ flex: 1.5 }}>
        {showBack && (
          <button className="back-btn-premium" onClick={() => navigate('/files')} style={{ padding: '8px 15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Book size={18} />
            <span>Library</span>
          </button>
        )}
      </div>

      <div className="header-center" style={{ flex: 2, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Book className="animated-book-icon" size={36} color="#e07a5f" />
          <div className="header-title-animated">AI BOOK READER</div>
        </div>
      </div>

      <div className="header-tools" style={{ flex: 1.5 }}>
        {!hideNav && (
          <>
            {showHomeIcon && (
              <Link to="/" className="header-icon-container" title="Home">
                <div className="header-icon"><Home size={18} /></div>
                <span className="header-icon-label">Home</span>
              </Link>
            )}
            {showLibraryIcon && (
              <Link to="/files" className="header-icon-container" title="Library">
                <div className="header-icon"><Book size={18} /></div>
                <span className="header-icon-label">Library</span>
              </Link>
            )}
            {showUploadIcon && (
              <Link to="/upload" className="header-icon-container" title="Upload">
                <div className="header-icon"><Upload size={18} /></div>
                <span className="header-icon-label">Upload</span>
              </Link>
            )}
          </>
        )}
        {children}
      </div>
    </header>
  );
};

export default Header;
