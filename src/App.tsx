import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, Upload, Search, Database, Map as MapIcon } from 'lucide-react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Import image assets for report illustrations
import fefaImage from './images/fefa responds.jpeg';
import lostKid from './images/lost kid.jpeg';
import foundKid from './images/found kid.jpeg';
import library from './images/library.png';

// Leaflet map will be initialized inside the App component using a ref and useEffect

// Report type definition
type Report = {
  id: number;
  name: string;
  date: string;
  location: string;
  description: string;
  coordinates: [number, number];
  type?: string;
  imageUrl?: string | object;
};

// The main App component
const App = () => {
  // State management (same as original)
  const [activeTab, setActiveTab] = useState('map');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPinForm, setShowPinForm] = useState(false);
  
  // Sample data of incident reports with images added back
  const initialReports: Report[] = [
    {
      id: 1,
      name: "Sarah Johnson",
      date: "2025-04-24",
      location: "Downtown Park",
      description: "FEFA is responding to downtown park so this place will probably be cleaned soon",
      coordinates: [37.7749, -122.4194],
      type: 'recent',
      imageUrl: fefaImage
    },
    {
      id: 2,
      name: "Michael Wu",
      date: "2025-04-23",
      location: "Huge Statue at Town Square",
      description: "Found some dudes kid over here, looks injured and name is Benny Creasell",
      coordinates: [37.7739, -122.4312],
      type: 'standard',
      imageUrl: foundKid
    },
    {
      id: 3,
      name: "Taylor Rodriguez",
      date: "2025-04-22",
      location: "Central Library",
      description: "Library is leaking gas cause of the tornado that hit, emergency services are too overwhelmed to come respond, dont come near here",
      coordinates: [37.7833, -122.4167],
      type: 'standard',
      imageUrl: library
    },
    {
      id: 4,
      name: "Alex Washington",
      date: "2025-04-21",
      location: "Riverside Trail, Beautiful Mansion (Super Expensive)",
      description: "My roof is torn off!!!! ",
      coordinates: [37.7694, -122.4862],
      type: 'standard',
      imageUrl: {}
    },
    {
      id: 5,
      name: "Jordan Patel",
      date: "2025-04-20",
      location: "North Side Neighborhood",
      description: "My kid IS LOST, his name is Benny Creasell, I can't find him after the huge landslide please help my poorly named son",
      coordinates: [37.8044, -122.4411],
      type: 'verified',
      imageUrl: lostKid
    }
  ];
  
  const [reports, setReports] = useState(initialReports);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);

  // Leaflet map ref and initialization
  const mapRef = useRef<L.Map | null>(null);

  // Initialize Leaflet map once the component mounts
  useEffect(() => {
    if (mapRef.current) return;
    try {
      mapRef.current = L.map('map').setView([51.505, -0.09], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);

      // Click handler to select location from the map
      mapRef.current.on('click', (e: L.LeafletMouseEvent) => {
        setSelectedLocation([e.latlng.lat, e.latlng.lng]);
      });
    } catch (err) {
      console.error('Leaflet initialization failed:', err);
    }
  }, []);

  // Report state variables for the form
  const [reportName, setReportName] = useState('');
  const [reportLocation, setReportLocation] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportImage, setReportImage] = useState<File | null>(null);
  
  // Filter reports based on search term
  const filteredReports = reports.filter(report => 
    report.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle form submission for new reports
  const handleSubmitReport = () => {
    if (!reportName || !reportLocation || !reportDescription || !selectedLocation) {
      alert("Please fill in all required fields");
      return;
    }

    // Create a new report object
    const newReport = {
      id: Date.now(), // Use timestamp to ensure unique IDs
      name: reportName,
      location: reportLocation,
      description: reportDescription,
      date: new Date().toISOString().split('T')[0],
      imageUrl: reportImage ? URL.createObjectURL(reportImage) : {},
      coordinates: selectedLocation,
      type: 'recent'
    };
    
    // Add new report to the beginning of the array
    setReports(prevReports => [newReport, ...prevReports]);
    
    // Clear the form
    setReportName('');
    setReportLocation('');
    setReportDescription('');
    setReportImage(null);
    setSelectedLocation(null);
    
    // Close the form
    setShowPinForm(false);
  };

  return (
    <div className="app-container">
      {/* Application header section */}
      <header className="header">
        <h1>Going Viral 2025 Crisis Map</h1>
        <p>Notify the community and first responders with this low data usage app.</p>
         <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
     integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
     crossOrigin=""/>
     <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
     integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
     crossOrigin=""></script> 
      </header>

      {/* Navigation tabs */}
      <nav className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          <MapIcon size={18} />
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
        {/* Map View */}
        {activeTab === 'map' && (
          <div className="map-container">
            {/* Map controls */}
            <div className="map-controls">
              <button className="add-pin-button" onClick={() => setShowPinForm(!showPinForm)}>
                <AlertTriangle size={16} />
                {showPinForm ? 'Cancel' : 'Report Incident'}
              </button>
              {/* Map legend */}
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
            
            {/* Incident reporting form */}
            {showPinForm && (
              <div className="add-pin-form">
                <div className="form-header">
                  <h3>Report New Incident</h3>
                  <button className="close-button" onClick={() => {
                    setShowPinForm(false);
                    setSelectedLocation(null);
                  }}>
                    <X size={18} />
                  </button>
                </div>
                <div className="form-fields">
                  {/* Form input fields */}
                  <div className="form-group">
                    <label>Name</label>
                    <input 
                      type="text" 
                      placeholder="Your name" 
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <input 
                      type="text" 
                      placeholder="Incident location" 
                      value={reportLocation}
                      onChange={(e) => setReportLocation(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea 
                      placeholder="Describe what you observed"
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                    ></textarea>
                  </div>
                  <div className="form-group">
                    <label>Upload Image</label>
                    <div className="upload-area">
                      <label htmlFor="file-upload" className="upload-label">
                        {reportImage ? (
                          <img 
                            src={URL.createObjectURL(reportImage)} 
                            alt="Preview" 
                            className="preview-image" 
                          />
                        ) : null}
                        <Upload size={24} />
                        <span>Click or drag files</span>
                      </label>
                      <input 
                        id="file-upload" 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setReportImage(file);
                        }}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Selected Location</label>
                    <div className="location-preview">
                      {selectedLocation ? (
                        <p>Lat: {selectedLocation[0].toFixed(4)}, Lng: {selectedLocation[1].toFixed(4)}</p>
                      ) : (
                        <p>Click on the map to select a location</p>
                      )}
                    </div>
                  </div>
                  <div className="form-actions">
                    <button 
                      className="submit-button" 
                      onClick={handleSubmitReport}
                      disabled={!reportName || !reportLocation || !reportDescription || !selectedLocation}
                    >
                      Submit Report
                    </button>
                    <button 
                      className="cancel-button" 
                      onClick={() => {
                        setShowPinForm(false);
                        setSelectedLocation(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Map display - Leaflet will be implemented here */}
            <div className="map-display">
              {/* TODO: Implement Leaflet map component */}
               <div id="map" style={{width: "600px", height: "400px", position: "relative", outlineStyle: "none"}}>
                <p>Leaflet map will be implemented here</p>
                <p>Reports to display: {reports.length}</p>
                {selectedLocation && (
                  <p>Selected: {selectedLocation[0].toFixed(4)}, {selectedLocation[1].toFixed(4)}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reports View */}
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
                      {/* Updated check for report image to handle both string and imported image references */}
                      {report.imageUrl && (
                        typeof report.imageUrl === 'string' ? 
                          report.imageUrl.length > 0 && <img src={report.imageUrl} alt={`Report by ${report.name}`} /> :
                          Object.keys(report.imageUrl).length > 0 && <img src={report.imageUrl as unknown as string} alt={`Report by ${report.name}`} />
                      )}
                    </div>
                    <div className="report-details">
                      <div className="report-header">
                        <h3>{report.location}</h3>
                        <span className="report-date">{report.date}</span>
                      </div>
                      <p className="report-description">{report.description}</p>
                      <div className="report-footer">
                        <span className="reporter-name">Reported by: {report.name}</span>
                        <span className="report-coordinates">Coordinates: <strong>{report.coordinates[0].toFixed(4)}, {report.coordinates[1].toFixed(4)}</strong></span>
                        <span className="report-maps-link">
                          <a 
                            href={`https://www.google.com/maps/dir//${report.coordinates[0]},${report.coordinates[1]}/@${report.coordinates[0]},${report.coordinates[1]}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            View on Google Maps
                          </a>
                        </span>
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

      {/* Application footer */}
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