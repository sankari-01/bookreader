import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';

const HomePage = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />
      <main className="container" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <section className="hero-section" style={{ marginBottom: '40px' }}>
          <h1>Experience Your Books with AI</h1>
        </section>

        <div style={{ display: 'flex', gap: '20px', flexDirection: 'column', width: '300px' }}>
          <Link to="/upload">
            <button className="home-cta-btn" style={{ width: '100%', margin: 0 }}>Upload Your Book</button>
          </Link>
          <Link to="/files">
            <button className="home-cta-btn" style={{ width: '100%', margin: 0 }}>Open Library</button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
