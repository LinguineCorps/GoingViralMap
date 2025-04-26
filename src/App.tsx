// App.tsx - Main application component for the Going Viral 2025 Project
// This application allows users to view and report incidents on a map during emergencies

import React, { useState } from 'react';
import { Map, X, Database, Camera, Upload, Search, AlertTriangle } from 'lucide-react';
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
};

// Sample data of incident reports for demonstration
const dummyReports: Report[] = [
  {
    id: 1,
    name: "Sarah Johnson",
    date: "2025-04-24",
    location: "Downtown Park",
    description: "FEFA is responding to downtown park so this place will probably be cleaned soon",
    imageUrl: fefaImage,
    coordinates: [37.7749, -122.4194] // San Francisco area coordinates
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
  // State management
  const [activeTab, setActiveTab] = useState<'map' | 'reports'>('map'); // Track active tab (map or reports view)
  const [searchTerm, setSearchTerm] = useState<string>(''); // Store user search input
  const [showPinForm, setShowPinForm] = useState<boolean>(false); // Control visibility of the report form

  // Report state variables for the incident reporting form
  const [reportName, setReportName] = useState<string>('');
  const [reportLocation, setReportLocation] = useState<string>('');
  const [reportDescription, setReportDescription] = useState<string>('');
  const [reportImage, setReportImage] = useState<File | null>(null);
  
  // Filter reports based on user search term
  // Searches through location, description and reporter name
  const filteredReports = dummyReports.filter(report => 
    report.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Add this function inside your App component
const handleSubmitReport = () => {
  // Create a new report object
  const newReport: Omit<Report, 'id' | 'date' | 'imageUrl' | 'coordinates'> = {
    name: reportName,
    location: reportLocation,
    description: reportDescription,
  };

  // Log the report (for now - would send to server in real app)
  console.log('Submitting new report:', newReport);
  
  // Optional: Add to local state (would be fetched from server in real app)
  // const updatedReports = [...dummyReports, {
  //   ...newReport,
  //   id: dummyReports.length + 1,
  //   date: new Date().toISOString().split('T')[0],
  //   imageUrl: reportImage ? URL.createObjectURL(reportImage) : {},
  //   coordinates: [37.7749, -122.4194], // Default coordinates
  // }];
  
  // Clear the form
  setReportName('');
  setReportLocation('');
  setReportDescription('');
  setReportImage(null);
  
  // Close the form
  setShowPinForm(false);
  
  // Show success message (optional)
  alert(
    "Report Submitted:\n" +
    "Name: " + reportName + "\n" + 
    "Location: " + reportLocation + "\n" + 
    "Description: " + reportDescription + "\n" + 
    "Image: " + (reportImage ? reportImage.name : "None")
  );
};

  return (
    <div className="app-container">
      {/* Application header section */}
      <header className="header">
        <h1>Going Viral 2025 Project</h1>
        <p>Notify the community and first responders with this low data usage app.</p>
      </header>

      {/* Navigation tabs to switch between map and reports views */}
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
            
            {/* Incident reporting form - shown when user clicks "Report Incident" */}
            {showPinForm && (
              <div className="add-pin-form">
                <div className="form-header">
                  <h3>Report New Incident</h3>
                  <button className="close-button" onClick={() => setShowPinForm(false)}>
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
                  <div className="form-actions">
                    <button className="submit-button" onClick={() => handleSubmitReport()}>Submit Report</button>
                    <button className="cancel-button" onClick={() => setShowPinForm(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Map visualization - currently using a placeholder instead of a real map component */}
            <div className="map-display">
              {/* This would be replaced with an actual map library implementation */}
              <div className="map-placeholder">
                <div className="map-image">
                  <div className="map-grid"></div>
                  {/* Render pins for each report with different styles based on report type */}
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
                      <img src={report.imageUrl} alt={`Report by ${report.name}`} />
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
                        <button className="view-details-button">View Details</button>
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