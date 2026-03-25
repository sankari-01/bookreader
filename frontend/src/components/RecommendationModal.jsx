import React, { useState, useEffect } from 'react';
import { X, BookOpen, Star, Globe } from 'lucide-react';

const RecommendationModal = ({ isOpen, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Story');
  const [activeLang, setActiveLang] = useState('English');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/recommendations')
        .then(res => res.json())
        .then(json => {
          setData(json);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch recommendations:", err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const categories = data ? Object.keys(data) : [];
  const languages = data && data[activeCategory] ? Object.keys(data[activeCategory]) : [];
  const books = data && data[activeCategory] && data[activeCategory][activeLang] ? data[activeCategory][activeLang] : [];

  return (
    <div className="quiz-modal-overlay">
      <div className="quiz-modal-content">
        <div className="quiz-header">
          <div className="quiz-title-group">
            <div className="quiz-icon-badge" style={{ background: '#e07a5f' }}>
              <BookOpen size={24} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Alice', serif", color: '#4a342e' }}>Magic Book Recommendations</h2>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#8b7355' }}>Curated classics and popular picks across genres</p>
            </div>
          </div>
          <button className="close-quiz-btn" onClick={onClose}><X size={24} /></button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <div className="magic-book-tiny"></div>
            <p>Consulting the archives...</p>
          </div>
        ) : (
          <div className="recommendation-body">
            <div className="category-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {categories.map(cat => (
                <button 
                  key={cat} 
                  className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '8px 15px',
                    borderRadius: '20px',
                    border: '1px solid #d4a373',
                    background: activeCategory === cat ? '#4a342e' : 'transparent',
                    color: activeCategory === cat ? '#fff' : '#4a342e',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="language-selector" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '10px', background: 'rgba(74, 52, 46, 0.05)', borderRadius: '10px' }}>
              <Globe size={18} color="#8b7355" />
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Select Language:</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {languages.map(lang => (
                  <button 
                    key={lang} 
                    onClick={() => setActiveLang(lang)}
                    style={{
                      background: activeLang === lang ? '#e07a5f' : 'transparent',
                      color: activeLang === lang ? '#fff' : '#8b7355',
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="recommendations-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              {books.map((book, i) => (
                <div key={i} className="recommendation-card" style={{ 
                  background: '#fff', 
                  borderRadius: '15px', 
                  padding: '20px', 
                  boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                  border: '1px solid #eee',
                  transition: 'transform 0.3s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: 0, color: '#4a342e', fontSize: '1.1rem' }}>{book.title}</h3>
                    <Star size={16} color="#d4a373" fill="#d4a373" />
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#e07a5f', fontWeight: 'bold' }}>By: {book.author}</div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', lineHeight: '1.4' }}>{book.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationModal;
