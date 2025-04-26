// App.tsx
import React, { useState } from 'react';
import { Map, X, Database, Camera, Upload, Search, AlertTriangle } from 'lucide-react';
import './App.css';

// import images here, format is import nameOfImage from "path/to/image.jpg"
import fefaImage from './images/fefa responds.jpeg';
import lostKid from './images/lost kid.jpeg';
import foundKid from './images/found kid.jpeg';
import library from './images/library.png';

type Report = {
  id: number;
  name: string;
  date: string;
  location: string;
  description: string;
  imageUrl: any;
  coordinates: [number, number];
};

const dummyReports: Report[] = [
  {
    id: 1,
    name: "Sarah Johnson",
    date: "2025-04-24",
    location: "Downtown Park",
    description: "FEFA is responding to downtown park so this place will probably be cleaned soon",
    imageUrl: fefaImage,
    coordinates: [37.7749, -122.4194]
  },
  {
    id: 2,
    name: "Michael Wu",
    date: "2025-04-23",
    location: "Huge Statue at Town Square",
    description: "Found some dudes kid over here, looks injured and name is Benny Creasell",
    imageUrl: foundKid,
    coordinates: [37.7739, -122.4312]
  },
  {
    id: 3,
    name: "Taylor Rodriguez",
    date: "2025-04-22",
    location: "Central Library",
    description: "Library is leaking gas cause of the tornado that hit, emergency services are too overwhelmed to come respond, dont come near here",
    imageUrl: library,
    coordinates: [37.7833, -122.4167]
  },
  {
    id: 4,
    name: "Alex Washington",
    date: "2025-04-21",
    location: "Riverside Trail, Beautiful Mansion (Super Expensive)",
    description: "My roof is torn off!!!! ",
    imageUrl: {},
    coordinates: [37.7694, -122.4862]
  },
  {
    id: 5,
    name: "Jordan Patel",
    date: "2025-04-20",
    location: "North Side Neighborhood",
    description: "My kid IS LOST, his name is Benny Creasell, I can't find him after the huge landslide please help my poorly named son",
    imageUrl: lostKid,
    coordinates: [37.8044, -122.4411]
  }
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'map' | 'reports'>('map');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showPinForm, setShowPinForm] = useState<boolean>(false);
  
  const filteredReports = dummyReports.filter(report => 
    report.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app-container">
      <header className="header">
        <h1>Going Viral 2025 Project</h1>
        <p>Notify the community and first responders with this low data usage app.</p>
      </header>

      <nav className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          <Map size={18} />
          Map View
        </button>
        <button 
          className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <Database size={18} />
          Recent Reports
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'map' && (
          <div className="map-container">
            <div className="map-controls">
              <button className="add-pin-button" onClick={() => setShowPinForm(!showPinForm)}>
                <AlertTriangle size={16} />
                {showPinForm ? 'Cancel' : 'Report Incident'}
              </button>
              <div className="map-legend">
                <span className="legend-item">
                  <span className="pin recent"></span> Recent (24h)
                </span>
                <span className="legend-item">
                  <span className="pin standard"></span> Standard
                </span>
                <span className="legend-item">
                  <span className="pin verified"></span> Verified
                </span>
              </div>
            </div>
            
            {showPinForm && (
              <div className="add-pin-form">
                <div className="form-header">
                  <h3>Report New Incident</h3>
                  <button className="close-button" onClick={() => setShowPinForm(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div className="form-fields">
                  <div className="form-group">
                    <label>Name</label>
                    <input type="text" placeholder="Your name" />
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <input type="text" placeholder="Incident location" />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea placeholder="Describe what you observed"></textarea>
                  </div>
                  <div className="form-group">
                    <label>Upload Image</label>
                    <div className="upload-area">
                      <Upload size={24} />
                      <span>Click or drag files</span>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button className="submit-button">Submit Report</button>
                    <button className="cancel-button" onClick={() => setShowPinForm(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="map-display">
              {/* Map placeholder - would be replaced with actual map component */}
              <div className="map-placeholder">
                <div className="map-image">
                  <div className="map-grid"></div>
                  {dummyReports.map((report) => (
                    <div 
                      key={report.id}
                      className={`map-pin ${report.id === 1 ? 'recent' : report.id === 5 ? 'verified' : 'standard'}`}
                      style={{ 
                        top: `${(100 - (report.coordinates[0] - 37.75) * 100)}%`, 
                        left: `${(100 + (report.coordinates[1] + 122.45) * 100)}%` 
                      }}
                    ></div>
                  ))}
                </div>
                <div className="map-instructions">
                  <p>Click on the map to select location or use "Report Incident" button</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="reports-container">
            <div className="reports-header">
              <h2>Recent Reports</h2>
              <div className="search-container">
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Search reports..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="reports-list">
              {filteredReports.length > 0 ? (
                filteredReports.map((report) => (
                  <div key={report.id} className="report-card">
                    <div className="report-image">
                      <img src={report.imageUrl} alt={`Report by ${report.name}`} />
                    </div>
                    <div className="report-details">
                      <div className="report-header">
                        <h3>{report.location}</h3>
                        <span className="report-date">{report.date}</span>
                      </div>
                      <p className="report-description">{report.description}</p>
                      <div className="report-footer">
                        <span className="reporter-name">Reported by: {report.name}</span>
                        <button className="view-details-button">View Details</button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-results">
                  <p>No reports found matching your search</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>&copy; 2025 Incident Tracker. All rights reserved.</p>
        <div className="footer-links">
          <a href="#">About</a>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    </div>
  );
};

export default App;