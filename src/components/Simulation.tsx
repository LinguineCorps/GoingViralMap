import { useState, useEffect, useRef, useCallback } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Emergency = {
  id: number;
  coordinates: [number, number];
  timestamp: number;
  status: 'pending' | 'assigned' | 'completed' | 'canceled';
  assignedResponder?: number;
  waitTime: number;
};

type FirstResponder = {
  id: number;
  coordinates: [number, number];
  busy: boolean;
  busyUntil: number;
};

type SimulationResult = {
  trial: number;
  type: 'Report' | 'Call';
  avgTimePerEmergency: number;
  totalTimeSpent: number;
  selfCompleted: number;
  canceled: number;
  totalCompleted: number;
};

const HOUSTON_CENTER: [number, number] = [29.7604, -95.3698];
const HOUSTON_BOUNDS = {
  latMin: 29.5,
  latMax: 30.1,
  lngMin: -95.8,
  lngMax: -94.9
};

// Constants from experiment
const BASE_CALLS = 75000;
const SIMULATION_HOURS = 48;
const OPERATORS_COUNT = 50;
const RESPONDERS_COUNT = 100;

// Time estimates (in simulation seconds)
const CALL_PROCESS_TIME = { min: 120, max: 300 }; // 2-5 minutes
const REPORT_PROCESS_TIME = { min: 30, max: 90 }; // 30-90 seconds
const HANGUP_THRESHOLD = 300; // 5 minutes wait before chance to hang up
const HANGUP_CHANCE = 0.1; // 10% chance per check after threshold

const Simulation = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(100); // 100x speed by default
  const [simTime, setSimTime] = useState(0); // Simulation time in seconds
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [currentTrial, setCurrentTrial] = useState(0);

  // Simulation state
  const [callEmergencies, setCallEmergencies] = useState<Emergency[]>([]);
  const [reportEmergencies, setReportEmergencies] = useState<Emergency[]>([]);
  const [callResponders, setCallResponders] = useState<FirstResponder[]>([]);
  const [reportResponders, setReportResponders] = useState<FirstResponder[]>([]);
  const [callStats, setCallStats] = useState({ completed: 0, canceled: 0, selfCompleted: 0, totalTime: 0 });
  const [reportStats, setReportStats] = useState({ completed: 0, canceled: 0, selfCompleted: 0, totalTime: 0 });
  const [callQueue, setCallQueue] = useState<Emergency[]>([]);
  const [reportQueue, setReportQueue] = useState<Emergency[]>([]);
  const [callOperatorsBusy, setCallOperatorsBusy] = useState<number[]>(Array(OPERATORS_COUNT).fill(0));
  const [reportOperatorsBusy, setReportOperatorsBusy] = useState<number[]>(Array(OPERATORS_COUNT).fill(0));

  // Map refs
  const callMapRef = useRef<L.Map | null>(null);
  const reportMapRef = useRef<L.Map | null>(null);
  const callMarkersRef = useRef<L.Marker[]>([]);
  const reportMarkersRef = useRef<L.Marker[]>([]);
  const callResponderMarkersRef = useRef<L.Marker[]>([]);
  const reportResponderMarkersRef = useRef<L.Marker[]>([]);

  // Calculate hourly call rate with randomness
  const getHourlyCallRate = useCallback(() => {
    const additionalCalls = Math.floor(Math.random() * 10000) + 5000; // 5000-15000
    const totalCalls = BASE_CALLS + additionalCalls;
    const baseRate = totalCalls / SIMULATION_HOURS;
    const variance = additionalCalls / SIMULATION_HOURS;
    return baseRate + (Math.random() * variance * 2 - variance);
  }, []);

  // Generate random coordinates within Houston bounds
  const getRandomCoordinates = useCallback((): [number, number] => {
    const lat = HOUSTON_BOUNDS.latMin + Math.random() * (HOUSTON_BOUNDS.latMax - HOUSTON_BOUNDS.latMin);
    const lng = HOUSTON_BOUNDS.lngMin + Math.random() * (HOUSTON_BOUNDS.lngMax - HOUSTON_BOUNDS.lngMin);
    return [lat, lng];
  }, []);

  // Calculate distance between two points
  const getDistance = (coord1: [number, number], coord2: [number, number]): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Initialize responders
  const initializeResponders = useCallback(() => {
    const responders: FirstResponder[] = [];
    for (let i = 0; i < RESPONDERS_COUNT; i++) {
      responders.push({
        id: i,
        coordinates: getRandomCoordinates(),
        busy: false,
        busyUntil: 0
      });
    }
    return responders;
  }, [getRandomCoordinates]);

  // Initialize maps
  useEffect(() => {
    if (!callMapRef.current) {
      callMapRef.current = L.map('call-map').setView(HOUSTON_CENTER, 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(callMapRef.current);
    }

    if (!reportMapRef.current) {
      reportMapRef.current = L.map('report-map').setView(HOUSTON_CENTER, 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(reportMapRef.current);
    }

    return () => {
      if (callMapRef.current) {
        callMapRef.current.remove();
        callMapRef.current = null;
      }
      if (reportMapRef.current) {
        reportMapRef.current.remove();
        reportMapRef.current = null;
      }
    };
  }, []);

  // Update markers on maps
  useEffect(() => {
    if (!callMapRef.current || !reportMapRef.current) return;

    // Clear existing markers
    callMarkersRef.current.forEach(m => m.remove());
    reportMarkersRef.current.forEach(m => m.remove());
    callResponderMarkersRef.current.forEach(m => m.remove());
    reportResponderMarkersRef.current.forEach(m => m.remove());

    callMarkersRef.current = [];
    reportMarkersRef.current = [];
    callResponderMarkersRef.current = [];
    reportResponderMarkersRef.current = [];

    // Add emergency markers
    const emergencyIcon = L.divIcon({
      className: 'emergency-marker',
      html: '<div style="background:red;width:10px;height:10px;border-radius:50%;border:2px solid white;"></div>',
      iconSize: [14, 14]
    });

    const completedIcon = L.divIcon({
      className: 'completed-marker',
      html: '<div style="background:green;width:10px;height:10px;border-radius:50%;border:2px solid white;"></div>',
      iconSize: [14, 14]
    });

    const responderIcon = L.divIcon({
      className: 'responder-marker',
      html: '<div style="background:blue;width:8px;height:8px;border-radius:50%;border:2px solid white;"></div>',
      iconSize: [12, 12]
    });

    callEmergencies.forEach(e => {
      const icon = e.status === 'completed' ? completedIcon : emergencyIcon;
      const marker = L.marker(e.coordinates, { icon }).addTo(callMapRef.current!);
      callMarkersRef.current.push(marker);
    });

    reportEmergencies.forEach(e => {
      const icon = e.status === 'completed' ? completedIcon : emergencyIcon;
      const marker = L.marker(e.coordinates, { icon }).addTo(reportMapRef.current!);
      reportMarkersRef.current.push(marker);
    });

    callResponders.forEach(r => {
      const marker = L.marker(r.coordinates, { icon: responderIcon }).addTo(callMapRef.current!);
      callResponderMarkersRef.current.push(marker);
    });

    reportResponders.forEach(r => {
      const marker = L.marker(r.coordinates, { icon: responderIcon }).addTo(reportMapRef.current!);
      reportResponderMarkersRef.current.push(marker);
    });
  }, [callEmergencies, reportEmergencies, callResponders, reportResponders]);

  // Start simulation
  const startSimulation = () => {
    setCurrentTrial(prev => prev + 1);
    setSimTime(0);
    setCallEmergencies([]);
    setReportEmergencies([]);
    setCallResponders(initializeResponders());
    setReportResponders(initializeResponders());
    setCallStats({ completed: 0, canceled: 0, selfCompleted: 0, totalTime: 0 });
    setReportStats({ completed: 0, canceled: 0, selfCompleted: 0, totalTime: 0 });
    setCallQueue([]);
    setReportQueue([]);
    setCallOperatorsBusy(Array(OPERATORS_COUNT).fill(0));
    setReportOperatorsBusy(Array(OPERATORS_COUNT).fill(0));
    setIsRunning(true);
    setIsPaused(false);
  };

  // Simulation loop
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const interval = setInterval(() => {
      setSimTime(prev => {
        const newTime = prev + 1;
        
        // Check if simulation is complete (48 hours = 172800 seconds)
        if (newTime >= SIMULATION_HOURS * 3600) {
          setIsRunning(false);
          
          // Record results
          const callResult: SimulationResult = {
            trial: currentTrial,
            type: 'Call',
            avgTimePerEmergency: callStats.totalTime / Math.max(callStats.completed, 1),
            totalTimeSpent: callStats.totalTime,
            selfCompleted: callStats.selfCompleted,
            canceled: callStats.canceled,
            totalCompleted: callStats.completed
          };
          
          const reportResult: SimulationResult = {
            trial: currentTrial,
            type: 'Report',
            avgTimePerEmergency: reportStats.totalTime / Math.max(reportStats.completed, 1),
            totalTimeSpent: reportStats.totalTime,
            selfCompleted: reportStats.selfCompleted,
            canceled: reportStats.canceled,
            totalCompleted: reportStats.completed
          };
          
          setResults(prev => [...prev, reportResult, callResult]);
          return newTime;
        }

        // Generate new emergencies based on hourly rate
        const callRate = getHourlyCallRate() / 3600; // Per second rate
        if (Math.random() < callRate) {
          const newEmergency: Emergency = {
            id: Date.now() + Math.random(),
            coordinates: getRandomCoordinates(),
            timestamp: newTime,
            status: 'pending',
            waitTime: 0
          };
          setCallEmergencies(prev => [...prev, newEmergency]);
          setReportEmergencies(prev => [...prev, { ...newEmergency, id: newEmergency.id + 0.5 }]);
          setCallQueue(prev => [...prev, newEmergency]);
          setReportQueue(prev => [...prev, { ...newEmergency, id: newEmergency.id + 0.5 }]);
        }

        return newTime;
      });
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, speed, currentTrial, callStats, reportStats, getHourlyCallRate, getRandomCoordinates]);

  // Process queues and check for self-completion
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const processInterval = setInterval(() => {
      // Process call queue (FIFO)
      setCallQueue(prev => {
        const newQueue = [...prev];
        let freeOperators = callOperatorsBusy.filter(t => t <= simTime).length;
        
        while (newQueue.length > 0 && freeOperators > 0) {
          const emergency = newQueue.shift()!;
          const processTime = CALL_PROCESS_TIME.min + Math.random() * (CALL_PROCESS_TIME.max - CALL_PROCESS_TIME.min);
          
          setCallOperatorsBusy(ops => {
            const newOps = [...ops];
            const freeIdx = newOps.findIndex(t => t <= simTime);
            if (freeIdx !== -1) {
              newOps[freeIdx] = simTime + processTime;
            }
            return newOps;
          });

          setCallEmergencies(emgs => emgs.map(e => 
            e.id === emergency.id ? { ...e, status: 'assigned' as const } : e
          ));

          setTimeout(() => {
            setCallStats(s => ({
              ...s,
              completed: s.completed + 1,
              totalTime: s.totalTime + (simTime - emergency.timestamp)
            }));
            setCallEmergencies(emgs => emgs.map(e => 
              e.id === emergency.id ? { ...e, status: 'completed' as const } : e
            ));
          }, processTime * 1000 / speed);

          freeOperators--;
        }

        // Check for hangups
        return newQueue.map(e => {
          const waitTime = simTime - e.timestamp;
          if (waitTime > HANGUP_THRESHOLD && Math.random() < HANGUP_CHANCE) {
            setCallStats(s => ({ ...s, canceled: s.canceled + 1 }));
            setCallEmergencies(emgs => emgs.map(em => 
              em.id === e.id ? { ...em, status: 'canceled' as const } : em
            ));
            return null;
          }
          return e;
        }).filter(Boolean) as Emergency[];
      });

      // Process report queue (random selection)
      setReportQueue(prev => {
        if (prev.length === 0) return prev;
        const newQueue = [...prev];
        let freeOperators = reportOperatorsBusy.filter(t => t <= simTime).length;

        while (newQueue.length > 0 && freeOperators > 0) {
          const randomIdx = Math.floor(Math.random() * newQueue.length);
          const emergency = newQueue.splice(randomIdx, 1)[0];
          const processTime = REPORT_PROCESS_TIME.min + Math.random() * (REPORT_PROCESS_TIME.max - REPORT_PROCESS_TIME.min);

          setReportOperatorsBusy(ops => {
            const newOps = [...ops];
            const freeIdx = newOps.findIndex(t => t <= simTime);
            if (freeIdx !== -1) {
              newOps[freeIdx] = simTime + processTime;
            }
            return newOps;
          });

          setReportEmergencies(emgs => emgs.map(e => 
            e.id === emergency.id ? { ...e, status: 'assigned' as const } : e
          ));

          setTimeout(() => {
            setReportStats(s => ({
              ...s,
              completed: s.completed + 1,
              totalTime: s.totalTime + (simTime - emergency.timestamp)
            }));
            setReportEmergencies(emgs => emgs.map(e => 
              e.id === emergency.id ? { ...e, status: 'completed' as const } : e
            ));
          }, processTime * 1000 / speed);

          freeOperators--;
        }

        return newQueue;
      });

      // Self-completion check for report simulation (higher chance)
      reportEmergencies.filter(e => e.status === 'pending').forEach(emergency => {
        reportResponders.forEach(responder => {
          if (!responder.busy) {
            const distance = getDistance(emergency.coordinates, responder.coordinates);
            // Higher chance for report simulation (responders can see the map)
            const selfCompleteChance = distance < 5 ? 0.05 : distance < 10 ? 0.02 : 0;
            if (Math.random() < selfCompleteChance) {
              setReportStats(s => ({
                ...s,
                selfCompleted: s.selfCompleted + 1,
                completed: s.completed + 1,
                totalTime: s.totalTime + (simTime - emergency.timestamp)
              }));
              setReportEmergencies(emgs => emgs.map(e => 
                e.id === emergency.id ? { ...e, status: 'completed' as const } : e
              ));
              setReportQueue(q => q.filter(e => e.id !== emergency.id));
            }
          }
        });
      });

      // Self-completion check for call simulation (lower chance)
      callEmergencies.filter(e => e.status === 'pending').forEach(emergency => {
        callResponders.forEach(responder => {
          if (!responder.busy) {
            const distance = getDistance(emergency.coordinates, responder.coordinates);
            // Lower chance for call simulation
            const selfCompleteChance = distance < 2 ? 0.01 : 0;
            if (Math.random() < selfCompleteChance) {
              setCallStats(s => ({
                ...s,
                selfCompleted: s.selfCompleted + 1,
                completed: s.completed + 1,
                totalTime: s.totalTime + (simTime - emergency.timestamp)
              }));
              setCallEmergencies(emgs => emgs.map(e => 
                e.id === emergency.id ? { ...e, status: 'completed' as const } : e
              ));
              setCallQueue(q => q.filter(e => e.id !== emergency.id));
            }
          }
        });
      });
    }, 1000 / speed);

    return () => clearInterval(processInterval);
  }, [isRunning, isPaused, speed, simTime, callOperatorsBusy, reportOperatorsBusy, callEmergencies, reportEmergencies, callResponders, reportResponders]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="simulation-container">
      <div className="simulation-controls">
        <h2>Hurricane Harvey Simulation</h2>
        <p>Comparing Emergency Calls vs Emergency Reports</p>
        
        <div className="control-row">
          <button 
            className="sim-button" 
            onClick={startSimulation} 
            disabled={isRunning}
          >
            Start New Trial
          </button>
          <button 
            className="sim-button" 
            onClick={() => setIsPaused(!isPaused)} 
            disabled={!isRunning}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>

        <div className="speed-control">
          <label>Simulation Speed: {speed}x</label>
          <input 
            type="range" 
            min="1" 
            max="1000" 
            value={speed} 
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </div>

        <div className="sim-status">
          <p>Simulation Time: {formatTime(simTime)} / {SIMULATION_HOURS}h</p>
          <p>Trial: {currentTrial}</p>
        </div>
      </div>

      <div className="maps-container">
        <div className="map-section">
          <h3>Emergency Call Simulation</h3>
          <div className="stats-bar">
            <span>Queue: {callQueue.length}</span>
            <span>Completed: {callStats.completed}</span>
            <span>Canceled: {callStats.canceled}</span>
            <span>Self-Completed: {callStats.selfCompleted}</span>
          </div>
          <div style={{ display: 'flex', gap: '20px', padding: '8px 15px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'red', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}></span> Pending Emergency
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'green', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}></span> Completed Emergency
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'blue', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}></span> First Responder
            </span>
          </div>
          <div id="call-map" style={{ width: '100%', height: '300px' }}></div>
        </div>

        <div className="map-section">
          <h3>Emergency Report Simulation</h3>
          <div className="stats-bar">
            <span>Queue: {reportQueue.length}</span>
            <span>Completed: {reportStats.completed}</span>
            <span>Canceled: {reportStats.canceled}</span>
            <span>Self-Completed: {reportStats.selfCompleted}</span>
          </div>
          <div style={{ display: 'flex', gap: '20px', padding: '8px 15px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'red', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}></span> Pending Emergency
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'green', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}></span> Completed Emergency
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'blue', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}></span> First Responder
            </span>
          </div>
          <div id="report-map" style={{ width: '100%', height: '300px' }}></div>
        </div>
      </div>

      <div className="results-section">
        <h3>Results</h3>
        <table className="results-table">
          <thead>
            <tr>
              <th>Trial #</th>
              <th>Simulation Type</th>
              <th>Avg Time/Emergency</th>
              <th>Total Time Spent</th>
              <th>Self Completed</th>
              <th>Canceled</th>
              <th>Total Completed</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, idx) => (
              <tr key={idx} className={result.type.toLowerCase()}>
                <td>{result.trial}</td>
                <td>{result.type}</td>
                <td>{formatTime(result.avgTimePerEmergency)}</td>
                <td>{formatTime(result.totalTimeSpent)}</td>
                <td>{result.selfCompleted}</td>
                <td>{result.canceled}</td>
                <td>{result.totalCompleted}</td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center' }}>No results yet. Start a simulation!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Simulation;
