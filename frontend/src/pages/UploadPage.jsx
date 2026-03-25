import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { Upload } from 'lucide-react';

const UploadPage = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await resp.json();
      if (data.success) {
        navigate('/files');
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header showBack />
      <main className="container" style={{ maxWidth: '600px', margin: 'auto' }}>
        <h2 style={{ color: '#4a342e', marginBottom: '10px' }}>Upload Your Book</h2>
        <p style={{ color: '#6d4c41', marginBottom: '30px' }}>Supports PDF, Word, PPT, Text, and Images (OCR)</p>

        <form onSubmit={handleUpload} style={{ marginTop: '30px' }}>
          <div style={{
            border: '2px dashed #d4a373',
            padding: '40px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.5)',
            cursor: 'pointer'
          }} onClick={() => document.getElementById('fileInput').click()}>
            <Upload size={48} color="#4a342e" style={{ margin: '0 auto 20px' }} />
            <p>{file ? file.name : "Click to select or drag and drop"}</p>
            <input
              id="fileInput"
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>

          <button
            type="submit"
            className="home-cta-btn"
            style={{ width: '100%', marginTop: '30px' }}
            disabled={!file || loading}
          >
            {loading ? "Uploading..." : "Start Processing"}
          </button>
        </form>

        {loading && (
          <div className="loading-overlay active">
            <div className="magic-book-container">
              <div className="magic-book"></div>
            </div>
            <p style={{ color: 'white', marginTop: '20px' }}>The AI is preparing your book...</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default UploadPage;
