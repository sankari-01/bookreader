import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { Trash2, BookOpen, Clock, FileText } from 'lucide-react';

const FilesPage = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = async () => {
    try {
      const resp = await fetch('/api/files');
      const data = await resp.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDelete = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      const response = await fetch(`/api/delete/${filename}`, { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        // Immediately remove from UI state
        setFiles(prevFiles => prevFiles.filter(f => f.filename !== filename));
      } else {
        window.alert(`Failed to delete ${filename}: ${data.error || 'Unknown error'}`);
        fetchFiles(); // Refetch if there was an error just in case
      }
    } catch (err) {
      console.error(err);
      window.alert("An error occurred while deleting the file.");
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      backgroundImage: 'url("/static/user_parchment.jpg")',
      backgroundSize: 'cover',
      backgroundAttachment: 'fixed',
      backgroundColor: '#f5efe1'
    }}>
      <Header showBack />
      <main className="container" style={{ 
        justifyContent: 'flex-start', 
        padding: '30px', 
        background: 'rgba(255, 255, 255, 0.4)', 
        backdropFilter: 'blur(10px)',
        borderRadius: '24px', 
        margin: '40px auto', 
        maxWidth: '1200px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Your Library</h2>
          <Link to="/upload">
            <button className="home-cta-btn" style={{ margin: 0 }}>Upload New</button>
          </Link>
        </div>

        {loading ? <p>Loading your library...</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Upload Date</th>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Pages</th>
                  <th>Last Opened</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'left', fontWeight: 'bold' }}>
                      <Link to={`/read/${file.filename}`} style={{ color: '#4a342e', display: 'flex', alignItems: 'center' }}>
                        <FileText size={18} style={{ marginRight: '8px' }} color="#b5651d" />
                        {file.filename}
                      </Link>
                    </td>
                    <td>{file.date}</td>
                    <td>{file.day}</td>
                    <td>{file.time}</td>
                    <td>{file.pages}</td>
                    <td style={{ fontSize: '0.8rem', color: '#6d4c41' }}>{file.last_opened}</td>
                    <td style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                      <Link to={`/read/${file.filename}`}>
                        <button style={{ padding: '6px 12px', background: '#d4a373', margin: 0 }}>
                          <BookOpen size={16} />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDelete(file.filename)}
                        style={{ padding: '6px 12px', background: '#e74c3c', margin: 0 }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {files.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: '40px' }}>Your library is empty. Upload a book to get started!</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default FilesPage;
