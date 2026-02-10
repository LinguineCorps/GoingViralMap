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
  gridCell?: string;
};

type FirstResponder = {
  id: number;
  coordinates: [number, number];
  busyUntil: number;
  gridCell: string;
};

type SimulationResult = {
  trial: number;
  type: 'Report' | 'Call';
  avgTimePerEmergency: number;
  avgProcessTime: number;
  totalTimeSpent: number;
  selfCompleted: number;
  canceled: number;
  totalCompleted: number;
};

type SpatialGrid = Map<string, number[]>;

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
const CALL_OPERATORS_COUNT = 500; // Operators answering phones
const RESPONDERS_COUNT = 17650; // First responders on the ground

// Spatial grid settings
const GRID_SIZE = 0.02; // ~2km cells for efficient lookups
const SELF_COMPLETE_CHECK_INTERVAL = 60; // Check every simulated minute

// Time estimates (in simulation seconds)
const CALL_PROCESS_TIME = { min: 120, max: 300 }; // 2-5 minutes for operator to handle call
const REPORT_PROCESS_TIME = { min: 30, max: 90 }; // 30-90 seconds for responder to read report
const HANGUP_THRESHOLD = 300; // 5 minutes wait before chance to hang up
const HANGUP_CHANCE = 0.1; // 10% chance per check after threshold

// Call simulation: responders stumble upon emergencies, very low chance
const CALL_SELF_COMPLETE = { 
  closeRange: 1,     // km - must be very close
  closeChance: 0.02  // 2% chance per minute - rare coincidence
};

// Report simulation: max range responders will travel to pick up an emergency
const REPORT_MAX_RANGE = 10; // km

const Simulation = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(100);
  const [simTime, setSimTime] = useState(0);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [currentTrial, setCurrentTrial] = useState(0);
  const [lastSelfCompleteCheck, setLastSelfCompleteCheck] = useState(0);

  // Simulation state
  const [callEmergencies, setCallEmergencies] = useState<Emergency[]>([]);
  const [reportEmergencies, setReportEmergencies] = useState<Emergency[]>([]);
  const [callResponders, setCallResponders] = useState<FirstResponder[]>([]);
  const [reportResponders, setReportResponders] = useState<FirstResponder[]>([]);
  const [callStats, setCallStats] = useState({ completed: 0, canceled: 0, selfCompleted: 0, totalTime: 0, totalProcessTime: 0 });
  const [reportStats, setReportStats] = useState({ completed: 0, canceled: 0, selfCompleted: 0, totalTime: 0, totalProcessTime: 0 });
  const [callQueue, setCallQueue] = useState<Emergency[]>([]);
  const [callOperatorsBusy, setCallOperatorsBusy] = useState<number[]>(Array(CALL_OPERATORS_COUNT).fill(0));

  // Spatial grids for efficient lookups
  const callResponderGridRef = useRef<SpatialGrid>(new Map());
  const reportResponderGridRef = useRef<SpatialGrid>(new Map());

  // Emergency rate for current trial (calculated once per trial)
  const emergencyRateRef = useRef<number>(0);
  
  // Track simulation time with a ref for accurate emergency generation
  const simTimeRef = useRef<number>(0);
  
  // Track if an interval tick is currently being processed
  const isProcessingRef = useRef<boolean>(false);
  
  // Track speed for setTimeout callbacks
  const speedRef = useRef<number>(100);
  
  // Track completed emergency IDs to prevent duplicate stats
  const completedCallIdsRef = useRef<Set<number>>(new Set());
  const completedReportIdsRef = useRef<Set<number>>(new Set());
  
  // Update speedRef when speed changes
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Map refs
  const callMapRef = useRef<L.Map | null>(null);
  const reportMapRef = useRef<L.Map | null>(null);
  const callMarkersRef = useRef<L.CircleMarker[]>([]);
  const reportMarkersRef = useRef<L.CircleMarker[]>([]);
  const callResponderMarkersRef = useRef<L.CircleMarker[]>([]);
  const reportResponderMarkersRef = useRef<L.CircleMarker[]>([]);

  // Get grid cell for coordinates
  const getGridCell = useCallback((coords: [number, number]): string => {
    const latCell = Math.floor(coords[0] / GRID_SIZE);
    const lngCell = Math.floor(coords[1] / GRID_SIZE);
    return `${latCell},${lngCell}`;
  }, []);

  // Get adjacent grid cells (for proximity search)
  const getAdjacentCells = useCallback((cell: string, radius: number = 3): string[] => {
    const [lat, lng] = cell.split(',').map(Number);
    const cells: string[] = [];
    for (let dLat = -radius; dLat <= radius; dLat++) {
      for (let dLng = -radius; dLng <= radius; dLng++) {
        cells.push(`${lat + dLat},${lng + dLng}`);
      }
    }
    return cells;
  }, []);

  // Build spatial grid from responders
  const buildSpatialGrid = useCallback((responders: FirstResponder[]): SpatialGrid => {
    const grid: SpatialGrid = new Map();
    responders.forEach(r => {
      const cell = r.gridCell;
      if (!grid.has(cell)) {
        grid.set(cell, []);
      }
      grid.get(cell)!.push(r.id);
    });
    return grid;
  }, []);

  // Generate random coordinates within Houston bounds
  const getRandomCoordinates = useCallback((): [number, number] => {
    const lat = HOUSTON_BOUNDS.latMin + Math.random() * (HOUSTON_BOUNDS.latMax - HOUSTON_BOUNDS.latMin);
    const lng = HOUSTON_BOUNDS.lngMin + Math.random() * (HOUSTON_BOUNDS.lngMax - HOUSTON_BOUNDS.lngMin);
    return [lat, lng];
  }, []);

  // Calculate distance between two points (Haversine formula)
  const getDistance = useCallback((coord1: [number, number], coord2: [number, number]): number => {
    const R = 6371;
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Find nearby available responders for self-completion
  const findNearbyResponders = useCallback((
    emergency: Emergency,
    responders: FirstResponder[],
    grid: SpatialGrid,
    maxDistance: number,
    currentTime: number
  ): FirstResponder[] => {
    const emergencyCell = getGridCell(emergency.coordinates);
    const radiusCells = Math.ceil(maxDistance / (GRID_SIZE * 111)); // Convert km to grid cells
    const adjacentCells = getAdjacentCells(emergencyCell, radiusCells);
    
    const nearbyIds = new Set<number>();
    adjacentCells.forEach(cell => {
      const ids = grid.get(cell);
      if (ids) {
        ids.forEach(id => nearbyIds.add(id));
      }
    });

    return responders.filter(r => 
      nearbyIds.has(r.id) && 
      r.busyUntil <= currentTime && 
      getDistance(emergency.coordinates, r.coordinates) <= maxDistance
    );
  }, [getGridCell, getAdjacentCells, getDistance]);

  // Initialize responders with grid cells
  const initializeResponders = useCallback(() => {
    const responders: FirstResponder[] = [];
    for (let i = 0; i < RESPONDERS_COUNT; i++) {
      const coords = getRandomCoordinates();
      responders.push({
        id: i,
        coordinates: coords,
        busyUntil: 0,
        gridCell: getGridCell(coords)
      });
    }
    return responders;
  }, [getRandomCoordinates, getGridCell]);

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

  // Update emergency markers on maps (optimized)
  useEffect(() => {
    if (!callMapRef.current || !reportMapRef.current) return;

    // Clear existing emergency markers
    callMarkersRef.current.forEach(m => m.remove());
    reportMarkersRef.current.forEach(m => m.remove());
    callMarkersRef.current = [];
    reportMarkersRef.current = [];

    // Only render recent/active emergencies (limit for performance)
    const maxMarkersToShow = 500;
    
    const recentCallEmergencies = callEmergencies
      .filter(e => e.status === 'pending' || e.status === 'assigned' || 
                   (e.status === 'completed' && simTime - e.timestamp < 300))
      .slice(-maxMarkersToShow);

    const recentReportEmergencies = reportEmergencies
      .filter(e => e.status === 'pending' || e.status === 'assigned' || 
                   (e.status === 'completed' && simTime - e.timestamp < 300))
      .slice(-maxMarkersToShow);

    recentCallEmergencies.forEach(e => {
      const color = e.status === 'completed' ? 'green' : e.status === 'assigned' ? 'orange' : 'red';
      const marker = L.circleMarker(e.coordinates, {
        radius: 5,
        fillColor: color,
        color: 'white',
        weight: 2,
        fillOpacity: 0.8
      }).addTo(callMapRef.current!);
      callMarkersRef.current.push(marker);
    });

    recentReportEmergencies.forEach(e => {
      const color = e.status === 'completed' ? 'green' : e.status === 'assigned' ? 'orange' : 'red';
      const marker = L.circleMarker(e.coordinates, {
        radius: 5,
        fillColor: color,
        color: 'white',
        weight: 2,
        fillOpacity: 0.8
      }).addTo(reportMapRef.current!);
      reportMarkersRef.current.push(marker);
    });
  }, [callEmergencies, reportEmergencies, simTime]);

  // Update responder markers (sampled for performance)
  useEffect(() => {
    if (!callMapRef.current || !reportMapRef.current) return;
    if (callResponders.length === 0) return;

    // Clear existing responder markers
    callResponderMarkersRef.current.forEach(m => m.remove());
    reportResponderMarkersRef.current.forEach(m => m.remove());
    callResponderMarkersRef.current = [];
    reportResponderMarkersRef.current = [];

    // Sample responders for display (show ~500 of 17,650)
    const sampleSize = Math.min(500, callResponders.length);
    const sampleStep = Math.floor(callResponders.length / sampleSize);

    for (let i = 0; i < callResponders.length; i += sampleStep) {
      const r = callResponders[i];
      const color = r.busyUntil > simTime ? 'purple' : 'blue';
      const marker = L.circleMarker(r.coordinates, {
        radius: 3,
        fillColor: color,
        color: 'white',
        weight: 1,
        fillOpacity: 0.6
      }).addTo(callMapRef.current!);
      callResponderMarkersRef.current.push(marker);
    }

    for (let i = 0; i < reportResponders.length; i += sampleStep) {
      const r = reportResponders[i];
      const color = r.busyUntil > simTime ? 'purple' : 'blue';
      const marker = L.circleMarker(r.coordinates, {
        radius: 3,
        fillColor: color,
        color: 'white',
        weight: 1,
        fillOpacity: 0.6
      }).addTo(reportMapRef.current!);
      reportResponderMarkersRef.current.push(marker);
    }

    // Build spatial grids
    callResponderGridRef.current = buildSpatialGrid(callResponders);
    reportResponderGridRef.current = buildSpatialGrid(reportResponders);
  }, [callResponders, reportResponders, buildSpatialGrid, simTime]);

  // Start simulation
  const startSimulation = () => {
    setCurrentTrial(prev => prev + 1);
    setSimTime(0);
    setLastSelfCompleteCheck(0);
    setCallEmergencies([]);
    setReportEmergencies([]);
    const newResponders = initializeResponders();
    setCallResponders(newResponders);
    setReportResponders(JSON.parse(JSON.stringify(newResponders))); // Deep copy
    setCallStats({ completed: 0, canceled: 0, selfCompleted: 0, totalTime: 0, totalProcessTime: 0 });
    setReportStats({ completed: 0, canceled: 0, selfCompleted: 0, totalTime: 0, totalProcessTime: 0 });
    setCallQueue([]);
    setCallOperatorsBusy(Array(CALL_OPERATORS_COUNT).fill(0));
    
    // Calculate emergency rate once per trial (per the paper: 75,000 + random 5,000-15,000 over 48 hours)
    const additionalCalls = Math.floor(Math.random() * 10000) + 5000;
    const totalCalls = BASE_CALLS + additionalCalls;
    // Rate per simulation second
    emergencyRateRef.current = totalCalls / (SIMULATION_HOURS * 3600);
    simTimeRef.current = 0;
    completedCallIdsRef.current = new Set();
    completedReportIdsRef.current = new Set();
    
    setIsRunning(true);
    setIsPaused(false);
  };

  // Main simulation loop - generate emergencies
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const interval = setInterval(() => {
      // Prevent overlapping interval executions
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      
      // Use ref to track time and prevent duplicate processing
      const newTime = simTimeRef.current + 1;
      simTimeRef.current = newTime;
      
      // Update React state for UI
      setSimTime(newTime);
      
      // Check if simulation is complete
      if (newTime >= SIMULATION_HOURS * 3600) {
        setIsRunning(false);
        isProcessingRef.current = false;
        return;
      }

      // Generate new emergencies using the fixed rate for this trial
      if (Math.random() < emergencyRateRef.current) {
        const coords = getRandomCoordinates();
        const emergencyId = newTime * 1000 + Math.floor(Math.random() * 1000);
        
        const newEmergency: Emergency = {
          id: emergencyId,
          coordinates: coords,
          timestamp: newTime,
          status: 'pending',
          waitTime: 0,
          gridCell: getGridCell(coords)
        };
        
        // Add to call simulation (goes through operators)
        setCallEmergencies(prev => [...prev, newEmergency]);
        setCallQueue(prev => [...prev, newEmergency]);
        
        // Add to report simulation (directly visible on map)
        setReportEmergencies(prev => [...prev, { ...newEmergency, id: emergencyId + 0.5 }]);
      }
      
      isProcessingRef.current = false;
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, speed, getRandomCoordinates, getGridCell]);

  // Capture final results when simulation ends
  useEffect(() => {
    if (simTime >= SIMULATION_HOURS * 3600 && currentTrial > 0 && !isRunning) {
      // Check if we already have results for this trial
      const hasResults = results.some(r => r.trial === currentTrial);
      if (hasResults) return;

      const callResult: SimulationResult = {
        trial: currentTrial,
        type: 'Call',
        avgTimePerEmergency: callStats.completed > 0 ? callStats.totalTime / callStats.completed : 0,
        avgProcessTime: callStats.completed > 0 ? callStats.totalProcessTime / callStats.completed : 0,
        totalTimeSpent: callStats.totalTime,
        selfCompleted: callStats.selfCompleted,
        canceled: callStats.canceled,
        totalCompleted: callStats.completed
      };
      
      const reportResult: SimulationResult = {
        trial: currentTrial,
        type: 'Report',
        avgTimePerEmergency: reportStats.completed > 0 ? reportStats.totalTime / reportStats.completed : 0,
        avgProcessTime: reportStats.completed > 0 ? reportStats.totalProcessTime / reportStats.completed : 0,
        totalTimeSpent: reportStats.totalTime,
        selfCompleted: reportStats.selfCompleted,
        canceled: reportStats.canceled,
        totalCompleted: reportStats.completed
      };
      
      setResults(prev => [...prev, reportResult, callResult]);
    }
  }, [simTime, currentTrial, isRunning, callStats, reportStats, results]);

  // Process queues and handle completions
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const processInterval = setInterval(() => {
      // === CALL SIMULATION ===
      // Operators process calls (FIFO) and dispatch to nearest responder
      setCallQueue(prev => {
        const newQueue = [...prev];
        const freeOperatorIndices = callOperatorsBusy
          .map((busyUntil, idx) => ({ idx, busyUntil }))
          .filter(op => op.busyUntil <= simTime)
          .map(op => op.idx);
        
        let processedCount = 0;
        const maxToProcess = Math.min(newQueue.length, freeOperatorIndices.length);
        
        while (processedCount < maxToProcess) {
          const emergency = newQueue.shift()!;
          const operatorIdx = freeOperatorIndices[processedCount];
          const processTime = CALL_PROCESS_TIME.min + Math.random() * (CALL_PROCESS_TIME.max - CALL_PROCESS_TIME.min);
          
          // Mark operator as busy
          setCallOperatorsBusy(ops => {
            const newOps = [...ops];
            newOps[operatorIdx] = simTime + processTime;
            return newOps;
          });

          const emergencyId = emergency.id;
          const emergencyTimestamp = emergency.timestamp;
          const completionTime = simTime + processTime;

          // Mark as assigned
          setCallEmergencies(emgs => emgs.map(e =>
            e.id === emergencyId ? { ...e, status: 'assigned' as const } : e
          ));

          // Complete after processing time - use speedRef for current speed
          const currentSpeed = speedRef.current;
          setTimeout(() => {
            // Guard against duplicate completion using ref
            if (completedCallIdsRef.current.has(emergencyId)) return;
            completedCallIdsRef.current.add(emergencyId);
            
            setCallStats(s => ({
              ...s,
              completed: s.completed + 1,
              totalTime: s.totalTime + (completionTime - emergencyTimestamp),
              totalProcessTime: s.totalProcessTime + processTime
            }));
            setCallEmergencies(emgs => emgs.map(e =>
              e.id === emergencyId ? { ...e, status: 'completed' as const } : e
            ));
          }, processTime * 1000 / currentSpeed);

          processedCount++;
        }

        // Check for hangups in remaining queue
        return newQueue.map(e => {
          const waitTime = simTime - e.timestamp;
          if (waitTime > HANGUP_THRESHOLD && Math.random() < HANGUP_CHANCE / 60) { // Per-second check
            setCallStats(s => ({ ...s, canceled: s.canceled + 1 }));
            setCallEmergencies(emgs => emgs.map(em =>
              em.id === e.id ? { ...em, status: 'canceled' as const } : em
            ));
            return null;
          }
          return e;
        }).filter(Boolean) as Emergency[];
      });

      // === REPORT SIMULATION ===
      // Free responders pick closest pending emergency and process it
      const pendingReports = reportEmergencies.filter(e => e.status === 'pending');
      const freeResponders = reportResponders.filter(r => r.busyUntil <= simTime);
      
      const assignedThisTick = new Set<number>();
      
      freeResponders.forEach(responder => {
        let closestEmergency: Emergency | null = null;
        let closestDistance = Infinity;
        
        for (const emergency of pendingReports) {
          if (assignedThisTick.has(emergency.id)) continue;
          const dist = getDistance(responder.coordinates, emergency.coordinates);
          if (dist < closestDistance && dist <= REPORT_MAX_RANGE) {
            closestDistance = dist;
            closestEmergency = emergency;
          }
        }

        if (closestEmergency) {
          const emergencyId = closestEmergency.id;
          const emergencyTimestamp = closestEmergency.timestamp;
          const processTime = REPORT_PROCESS_TIME.min + Math.random() * (REPORT_PROCESS_TIME.max - REPORT_PROCESS_TIME.min);
          const completionTime = simTime + processTime;
          
          assignedThisTick.add(emergencyId);
          
          // Mark responder as busy
          setReportResponders(rs => rs.map(r =>
            r.id === responder.id ? { ...r, busyUntil: completionTime } : r
          ));
          
          // Mark emergency as assigned
          setReportEmergencies(emgs => emgs.map(e =>
            e.id === emergencyId ? { ...e, status: 'assigned' as const, assignedResponder: responder.id } : e
          ));

          // Complete after processing - use speedRef for current speed
          const currentSpeed = speedRef.current;
          setTimeout(() => {
            // Guard against duplicate completion using ref
            if (completedReportIdsRef.current.has(emergencyId)) return;
            completedReportIdsRef.current.add(emergencyId);
            
            setReportStats(s => ({
              ...s,
              selfCompleted: s.selfCompleted + 1,
              completed: s.completed + 1,
              totalTime: s.totalTime + (completionTime - emergencyTimestamp),
              totalProcessTime: s.totalProcessTime + processTime
            }));
            setReportEmergencies(emgs => emgs.map(e =>
              e.id === emergencyId ? { ...e, status: 'completed' as const } : e
            ));
          }, processTime * 1000 / currentSpeed);
        }
      });

      // === CALL SIMULATION - Self-completion (once per minute) ===
      if (simTime - lastSelfCompleteCheck >= SELF_COMPLETE_CHECK_INTERVAL) {
        setLastSelfCompleteCheck(simTime);
        
        // Only check pending emergencies (not ones already assigned to operators)
        const pendingCallEmergencies = callEmergencies.filter(e => e.status === 'pending');
        
        pendingCallEmergencies.forEach(emergency => {
          // Skip if already completed
          if (completedCallIdsRef.current.has(emergency.id)) return;
          
          const nearbyResponders = findNearbyResponders(
            emergency,
            callResponders,
            callResponderGridRef.current,
            CALL_SELF_COMPLETE.closeRange,
            simTime
          );

          for (const _responder of nearbyResponders) {
            if (Math.random() < CALL_SELF_COMPLETE.closeChance) {
              const emergencyId = emergency.id;
              
              // Guard against duplicate completion
              if (completedCallIdsRef.current.has(emergencyId)) break;
              completedCallIdsRef.current.add(emergencyId);
              
              const emergencyTimestamp = emergency.timestamp;

              setCallEmergencies(emgs => emgs.map(e =>
                e.id === emergencyId ? { ...e, status: 'completed' as const } : e
              ));

              setCallQueue(q => q.filter(e => e.id !== emergencyId));

              setCallStats(s => ({
                ...s,
                selfCompleted: s.selfCompleted + 1,
                completed: s.completed + 1,
                totalTime: s.totalTime + (simTime - emergencyTimestamp)
              }));

              break;
            }
          }
        });
      }

    }, 1000 / speed);

    return () => clearInterval(processInterval);
  }, [isRunning, isPaused, speed, simTime, lastSelfCompleteCheck, callOperatorsBusy, 
      callEmergencies, reportEmergencies, callResponders, reportResponders, 
      findNearbyResponders, getDistance]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatSeconds = (seconds: number) => {
    return `${Math.round(seconds)}s`;
  };

  const getFreeOperators = () => callOperatorsBusy.filter(t => t <= simTime).length;
  const getBusyResponders = (responders: FirstResponder[]) => responders.filter(r => r.busyUntil > simTime).length;

  return (
    <div className="simulation-container">
      <div className="simulation-controls">
        <h2>Hurricane Harvey Simulation</h2>
        <p>Comparing Emergency Calls vs Emergency Reports</p>
        
        <div className="simulation-info" style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
          <p><strong>Call System:</strong> {CALL_OPERATORS_COUNT.toLocaleString()} operators process calls → dispatch to {RESPONDERS_COUNT.toLocaleString()} responders</p>
          <p><strong>Report System:</strong> {RESPONDERS_COUNT.toLocaleString()} responders read reports directly from map</p>
        </div>
        
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
            <span>Total Emergencies: {callEmergencies.length}</span>
            <span>Queue: {callQueue.length}</span>
            <span>Free Operators: {getFreeOperators()}/{CALL_OPERATORS_COUNT}</span>
          </div>
          <div className="stats-bar">
            <span>Completed: {callStats.completed}</span>
            <span>Canceled: {callStats.canceled}</span>
            <span>Self-Completed: {callStats.selfCompleted}</span>
          </div>
          <div style={{ display: 'flex', gap: '15px', padding: '8px 15px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '12px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'red' }}></span> Pending
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'orange' }}></span> Assigned
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'green' }}></span> Completed
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'blue' }}></span> Responder
            </span>
          </div>
          <div id="call-map" style={{ width: '100%', height: '300px' }}></div>
        </div>

        <div className="map-section">
          <h3>Emergency Report Simulation</h3>
          <div className="stats-bar">
            <span>Total Emergencies: {reportEmergencies.length}</span>
            <span>Pending: {reportEmergencies.filter(e => e.status === 'pending').length}</span>
            <span>Free Responders: {RESPONDERS_COUNT - getBusyResponders(reportResponders)}/{RESPONDERS_COUNT.toLocaleString()}</span>
          </div>
          <div className="stats-bar">
            <span>Completed: {reportStats.completed}</span>
            <span>(All Self-Completed)</span>
          </div>
          <div style={{ display: 'flex', gap: '15px', padding: '8px 15px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '12px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'red' }}></span> Pending
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'orange' }}></span> Assigned
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'green' }}></span> Completed
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'blue' }}></span> Free Responder
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'purple' }}></span> Busy Responder
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
              <th>Avg Process Time</th>
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
                <td>{formatSeconds(result.avgTimePerEmergency)}</td>
                <td>{formatSeconds(result.avgProcessTime)}</td>
                <td>{formatTime(result.totalTimeSpent)}</td>
                <td>{result.selfCompleted.toLocaleString()}</td>
                <td>{result.canceled.toLocaleString()}</td>
                <td>{result.totalCompleted.toLocaleString()}</td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center' }}>No results yet. Start a simulation!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Simulation;
