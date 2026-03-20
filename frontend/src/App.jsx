import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import FilesPage from './pages/FilesPage';
import ReaderPage from './pages/ReaderPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/files" element={<FilesPage />} />
      <Route path="/read/:filename" element={<ReaderPage />} />
    </Routes>
  );
}

export default App;
