import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, Upload, Search, Database, Map as MapIcon } from 'lucide-react';

// Import image assets for report illustrations
import fefaImage from './images/fefa responds.jpeg';
import lostKid from './images/lost kid.jpeg';
import foundKid from './images/found kid.jpeg';
import library from './images/library.png';

// StaticMap component to replace the Leaflet implementation
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

interface StaticMapProps {
  reports: Report[];
  selectedLocation: [number, number] | null;
  setSelectedLocation: (loc: [number, number]) => void;
  setShowPinForm: (show: boolean) => void;
}

const StaticMap: React.FC<StaticMapProps> = ({ 
  reports, 
  selectedLocation, 
  setSelectedLocation, 
  setShowPinForm 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  
  // Base coordinates for San Francisco area (same as in original code)
  const baseCoordinates = {
    lat: 37.7749,
    lng: -122.4194,
    minLat: 37.76,
    maxLat: 37.81,
    minLng: -122.49,
    maxLng: -122.39
  };
  
  // Update map dimensions on window resize
  useEffect(() => {
    const updateDimensions = () => {
      if (mapRef.current) {
        setMapDimensions({
          width: mapRef.current.offsetWidth,
          height: mapRef.current.offsetHeight
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);
  
  // Convert geographic coordinates to pixel position on the map
  const coordsToPixels = (lat: number, lng: number) => {
    const { minLat, maxLat, minLng, maxLng } = baseCoordinates;
    const x = ((lng - minLng) / (maxLng - minLng)) * mapDimensions.width;
    const y = ((maxLat - lat) / (maxLat - minLat)) * mapDimensions.height;
    return { x, y };
  };
  
  // Convert pixel position to geographic coordinates
  interface PixelsToCoords {
    (x: number, y: number): [number, number];
  }

  const pixelsToCoords: PixelsToCoords = (x, y) => {
    const { minLat, maxLat, minLng, maxLng } = baseCoordinates;
    const lat = maxLat - (y / mapDimensions.height) * (maxLat - minLat);
    const lng = minLng + (x / mapDimensions.width) * (maxLng - minLng);
    return [lat, lng];
  };
  
  // Handle map click events
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Ensure click is within map bounds
    if (x >= 0 && x <= mapDimensions.width && y >= 0 && y <= mapDimensions.height) {
      const [lat, lng] = pixelsToCoords(x, y);
      setSelectedLocation([lat, lng]);
      setShowPinForm(true);
    }
  };
  
  // Color mapping for different report types
  interface MarkerTypeColorMap {
    [key: string]: string;
  }

  type MarkerType = 'recent' | 'verified' | 'standard' | string;

  const getMarkerColor = (type: MarkerType): string => {
    const colorMap: MarkerTypeColorMap = {
      recent: '#ef4444',    // red
      verified: '#10b981',  // green
      standard: '#3b82f6',  // blue
    };
    return colorMap[type] || colorMap['standard'];
  };

  // Render pin tooltips
  const [activePin, setActivePin] = useState<number | null>(null);
  
  return (
    <div 
      ref={mapRef} 
      className="map-image"
      onClick={handleMapClick}
      style={{ position: 'relative', height: '500px' }}
    >
      {/* Map background with grid overlay */}
      <div className="map-grid"></div>
      
      {/* Display pins for each report */}
      {reports.map((report) => {
        const { x, y } = coordsToPixels(report.coordinates[0], report.coordinates[1]);
        if (x >= 0 && x <= mapDimensions.width && y >= 0 && y <= mapDimensions.height) {
          return (
            <div key={report.id}>
              <div 
                className={`map-pin ${report.type || 'standard'}`}
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  backgroundColor: getMarkerColor(report.type || 'standard')
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePin(activePin === report.id ? null : report.id);
                }}
              />
              
              {activePin === report.id && (
                <div 
                  className="pin-tooltip"
                  style={{
                    position: 'absolute',
                    left: `${x + 15}px`,
                    top: `${y - 20}px`,
                    backgroundColor: 'white',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    minWidth: '200px',
                    maxWidth: '300px'
                  }}
                >
                  <h4 className="font-medium text-base mb-1">{report.location}</h4>
                  <p className="text-sm text-gray-600 mb-2">{report.description}</p>
                  <div className="text-xs text-gray-500 flex flex-col gap-1">
                    <span>Reported by: {report.name}</span>
                    <span>Date: {report.date}</span>
                    <button 
                      className="text-blue-500 hover:underline text-xs text-left mt-1"
                      onClick={() => {
                        // Create Google Maps URL (same as original function)
                        const url = `https://www.google.com/maps/dir//${report.coordinates[0]},${report.coordinates[1]}/@${report.coordinates[0]},${report.coordinates[1]}`;
                        window.open(url, '_blank');
                      }}
                    >
                      Get Directions
                    </button>
                  </div>
                  <button 
                    className="absolute top-1 right-1 text-gray-500 hover:text-gray-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePin(null);
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
      
      {/* Display selected location pin if any */}
      {selectedLocation && (() => {
        const { x, y } = coordsToPixels(selectedLocation[0], selectedLocation[1]);
        if (x >= 0 && x <= mapDimensions.width && y >= 0 && y <= mapDimensions.height) {
          return (
            <div 
              className="map-pin recent"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                backgroundColor: '#ef4444',
                border: '2px solid white'
              }}
            />
          );
        }
        return null;
      })()}
      
      {/* Map instructions overlay */}
      <div className="map-instructions">
        Click anywhere on the map to add a new incident report
      </div>
    </div>
  );
};

// The main App component that integrates the static map
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
            
            {/* Static map display replacing Leaflet */}
            <div className="map-display">
              <StaticMap 
                reports={reports}
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
                setShowPinForm={setShowPinForm}
              />
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