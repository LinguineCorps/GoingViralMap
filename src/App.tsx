// App.tsx - Main application component for the Going Viral 2025 Project
// This application allows users to view and report incidents on a map during emergencies

import React, { useState, useEffect } from 'react';
import { Map as MapIcon, X, Database, Camera, Upload, Search, AlertTriangle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import './App.css';

// Import image assets for report illustrations
import fefaImage from './images/fefa responds.jpeg';
import lostKid from './images/lost kid.jpeg';
import foundKid from './images/found kid.jpeg';
import library from './images/library.png';

// Define TypeScript interface for Report objects
type Report = {
  id: number;         // Unique identifier for each report
  name: string;       // Name of the person who reported the incident
  date: string;       // Date when the incident was reported
  location: string;   // Location description of the incident
  description: string;// Detailed description of the incident
  imageUrl: any;      // Image associated with the report
  coordinates: [number, number]; // Geographical coordinates [latitude, longitude]
  type?: 'recent' | 'standard' | 'verified'; // Type of report for display styling
};

// Sample data of incident reports for demonstration
const initialReports: Report[] = [
  {
    id: 1,
    name: "Sarah Johnson",
    date: "2025-04-24",
    location: "Downtown Park",
    description: "FEFA is responding to downtown park so this place will probably be cleaned soon",
    imageUrl: fefaImage,
    coordinates: [37.7749, -122.4194], // San Francisco area coordinates
    type: 'recent'
  },
  {
    id: 2,
    name: "Michael Wu",
    date: "2025-04-23",
    location: "Huge Statue at Town Square",
    description: "Found some dudes kid over here, looks injured and name is Benny Creasell",
    imageUrl: foundKid,
    coordinates: [37.7739, -122.4312],
    type: 'standard'
  },
  {
    id: 3,
    name: "Taylor Rodriguez",
    date: "2025-04-22",
    location: "Central Library",
    description: "Library is leaking gas cause of the tornado that hit, emergency services are too overwhelmed to come respond, dont come near here",
    imageUrl: library,
    coordinates: [37.7833, -122.4167],
    type: 'standard'
  },
  {
    id: 4,
    name: "Alex Washington",
    date: "2025-04-21",
    location: "Riverside Trail, Beautiful Mansion (Super Expensive)",
    description: "My roof is torn off!!!! ",
    imageUrl: {},
    coordinates: [37.7694, -122.4862],
    type: 'standard'
  },
  {
    id: 5,
    name: "Jordan Patel",
    date: "2025-04-20",
    location: "North Side Neighborhood",
    description: "My kid IS LOST, his name is Benny Creasell, I can't find him after the huge landslide please help my poorly named son",
    imageUrl: lostKid,
    coordinates: [37.8044, -122.4411],
    type: 'verified'
  }
];

// Component for handling map click events and adding new markers
const MapInteraction: React.FC<{
  setSelectedLocation: React.Dispatch<React.SetStateAction<[number, number] | null>>,
  setShowPinForm: React.Dispatch<React.SetStateAction<boolean>>
}> = ({ setSelectedLocation, setShowPinForm }) => {
  const map = useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      setSelectedLocation([lat, lng]);
      setShowPinForm(true);
    }
  });
  return null;
};

const App: React.FC = () => {
  // State management
  const [activeTab, setActiveTab] = useState<'map' | 'reports'>('map'); // Track active tab (map or reports view)
  const [searchTerm, setSearchTerm] = useState<string>(''); // Store user search input
  const [showPinForm, setShowPinForm] = useState<boolean>(false); // Control visibility of the report form
  const [reports, setReports] = useState<Report[]>(initialReports); // Store reports data
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null); // Store selected map coordinates

  // Report state variables for the incident reporting form
  const [reportName, setReportName] = useState<string>('');
  const [reportLocation, setReportLocation] = useState<string>('');
  const [reportDescription, setReportDescription] = useState<string>('');
  const [reportImage, setReportImage] = useState<File | null>(null);
  
  // Filter reports based on user search term
  // Searches through location, description and reporter name
  const filteredReports = reports.filter(report => 
    report.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper function to get Google Maps directions URL
  const getGoogleMapsURL = (coordinates: [number, number]): string => {
    return `https://www.google.com/maps/dir//${coordinates[0]},${coordinates[1]}/@${coordinates[0]},${coordinates[1]}`;
  };

  // Create custom marker icons for different report types
  const createMarkerIcon = (type: 'recent' | 'standard' | 'verified') => {
    let markerColor = 'blue';
    
    switch(type) {
      case 'recent':
        markerColor = 'red';
        break;
      case 'verified':
        markerColor = 'green';
        break;
      default:
        markerColor = 'blue';
    }
    
    return L.divIcon({
      className: `custom-marker ${type}`,
      html: `<div style="background-color: ${markerColor}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white;"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  };

  // Handle form submission for new reports
  const handleSubmitReport = () => {
    if (!reportName || !reportLocation || !reportDescription || !selectedLocation) {
      alert("Please fill in all required fields");
      return;
    }

    // Create a new report object with all required fields
    const newReport: Report = {
      id: reports.length + 1,
      name: reportName,
      location: reportLocation,
      description: reportDescription,
      date: new Date().toISOString().split('T')[0],
      imageUrl: reportImage ? URL.createObjectURL(reportImage) : {},
      coordinates: selectedLocation,
      type: 'recent' // Default to recent for new reports
    };
    
    // Add new report to the beginning of the array
    setReports(prevReports => [newReport, ...prevReports.map((report, idx) => ({ ...report, id: idx + 2 }))]);
    
    // Clear the form
    setReportName('');
    setReportLocation('');
    setReportDescription('');
    setReportImage(null);
    setSelectedLocation(null);
    
    // Close the form
    setShowPinForm(false);
  };

  // Create a pin preview for the selected location
  const PinPreview = () => {
    if (!selectedLocation) return null;
    
    return (
      <Marker
        position={selectedLocation}
        icon={createMarkerIcon('recent')}
      >
        <Popup>
          <div>
            <h4>New Report Location</h4>
            <p>Coordinates: {selectedLocation[0].toFixed(4)}, {selectedLocation[1].toFixed(4)}</p>
          </div>
        </Popup>
      </Marker>
    );
  };

  return (
    <div className="app-container">
      {/* Application header section */}
      <header className="header">
        <h1>Going Viral 2025 Crisis Map</h1>
        <p>Notify the community and first responders with this low data usage app.</p>
      </header>

      {/* Navigation tabs to switch between map and reports views */}
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
        {/* Map View - Shows geographical representation of incidents */}
        {activeTab === 'map' && (
          <div className="map-container">
            {/* Map control panel with incident reporting button and legend */}
            <div className="map-controls">
              <button className="add-pin-button" onClick={() => setShowPinForm(!showPinForm)}>
                <AlertTriangle size={16} />
                {showPinForm ? 'Cancel' : 'Report Incident'}
              </button>
              {/* Map legend explaining the different pin types */}
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
            
            {/* Incident reporting form - shown when user clicks "Report Incident" or clicks on the map */}
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
                  {/* Form input fields for incident details */}
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
            
            {/* Real map implementation using react-leaflet */}
            <div className="map-display">
              <MapContainer 
                center={[37.7749, -122.4194]} // San Francisco center
                zoom={13} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Map markers for each report */}
                {reports.map((report) => (
                  <Marker
                    key={report.id}
                    position={report.coordinates}
                    icon={createMarkerIcon(report.type || 'standard')}
                  >
                    <Popup>
                      <div className="popup-content">
                        <h3>{report.location}</h3>
                        <p>{report.description}</p>
                        <div className="popup-footer">
                          <span>Reported by: {report.name}</span>
                          <span>Date: {report.date}</span>
                          <a 
                            href={getGoogleMapsURL(report.coordinates)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            Get Directions
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                
                {/* Show preview pin for selected location */}
                <PinPreview />
                
                {/* Map click event handler */}
                <MapInteraction 
                  setSelectedLocation={setSelectedLocation}
                  setShowPinForm={setShowPinForm}
                />
              </MapContainer>
            </div>
          </div>
        )}

        {/* Reports View - Lists all incident reports with search functionality */}
        {activeTab === 'reports' && (
          <div className="reports-container">
            <div className="reports-header">
              <h2>Recent Reports</h2>
              {/* Search input for filtering reports */}
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
            
            {/* List of filtered reports */}
            <div className="reports-list">
              {filteredReports.length > 0 ? (
                filteredReports.map((report) => (
                  <div key={report.id} className="report-card">
                    {/* Report image */}
                    <div className="report-image">
                      {report.imageUrl && Object.keys(report.imageUrl).length > 0 && (
                        <img src={report.imageUrl} alt={`Report by ${report.name}`} />
                      )}
                    </div>
                    {/* Report content and details */}
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
                            href={getGoogleMapsURL(report.coordinates)} 
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
                // Displayed when no reports match the search criteria
                <div className="no-results">
                  <p>No reports found matching your search</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Application footer with copyright and links */}
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