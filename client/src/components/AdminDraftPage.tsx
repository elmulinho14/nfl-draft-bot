import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import '../App.css'; // Assuming App.css is in src/

// --- Interfaces ---
interface Player {
  id: string;
  name: string;
  position: string;
  school: string;
  age: number | string; // Keep age as number | string for easier handling
  height: string;
  weight: string;
  hand: string;
  arm: string;
  wing: string;
  fortyYdDash: string;
  tenYdSplit: string;
  vertJump: string;
  broadJump: string;
  threeCone: string;
  shuttle: string;
  bench: string;
}

// Define interface for the raw CSV row structure
interface CsvPlayerRow {
  'AVG Rank': string; // Add even if not displayed, for completeness
  'Position': string;
  'Name': string;
  'School': string;
  'Age on  Week 1': string; // Note the double space
  // Skip 'Player Notes or     Red Flags'
  'Height': string;
  'Weight': string;
  'Hand': string;
  'Arm': string;
  'Wing': string;
  '40 yd Dash': string;
  '10 yd Split': string;
  'Vert Jump': string;
  'Broad Jump': string;
  '3 Cone': string;
  'Shuttle': string;
  'Bench': string;
  [key: string]: string; // Allow for potential extra columns
}
interface Team {
  pick: number;
  name: string;
}

interface Pick {
  team: Team;
  player: Player | null;
}


// --- Constant Data ---
// Round 1 Teams (Placeholder - should be updated with actual logic if needed)
const round1Teams = [
  { pick: 1, name: 'Tennessee Titans' }, 
  { pick: 2, name: 'Cleveland Browns' },
  { pick: 3, name: 'New York Giants' },
  { pick: 4, name: 'New England Patriots' },
  { pick: 5, name: 'Jacksonville Jaguars' },
  { pick: 6, name: 'Las Vegas Raiders' },
  { pick: 7, name: 'New York Jets' },
  { pick: 8, name: 'Carolina Panthers' },
  { pick: 9, name: 'New Orleans Saints' },
  { pick: 10, name: 'Chicago Bears' },
  { pick: 11, name: 'San Francisco 49ers' },
  { pick: 12, name: 'Dallas Cowboys' },
  { pick: 13, name: 'Miami Dolphins' },
  { pick: 14, name: 'Indianapolis Colts' },
  { pick: 15, name: 'Atlanta Falcons' },
  { pick: 16, name: 'Arizona Cardinals' },
  { pick: 17, name: 'Cincinnati Bengals' },
  { pick: 18, name: 'Seattle Seahawks' },
  { pick: 19, name: 'Tampa Bay Buccaneers' },
  { pick: 20, name: 'Denver Broncos' },
  { pick: 21, name: 'Pittsburgh Steelers' },
  { pick: 22, name: 'Los Angeles Chargers' },
  { pick: 23, name: 'Green Bay Packers' },
  { pick: 24, name: 'Minnesota Vikings' },
  { pick: 25, name: 'Houston Texans' },
  { pick: 26, name: 'Los Angeles Rams' },
  { pick: 27, name: 'Baltimore Ravens' },
  { pick: 28, name: 'Detroit Lions' },
  { pick: 29, name: 'Washington Commanders' },
  { pick: 30, name: 'Buffalo Bills' },
  { pick: 31, name: 'Kansas City Chiefs' },
  { pick: 32, name: 'Philadelphia Eagles' },
];

// Team Logo Mapping
const teamLogos: { [key: string]: string } = {
  'Arizona Cardinals': 'https://upload.wikimedia.org/wikipedia/en/thumb/7/72/Arizona_Cardinals_logo.svg/179px-Arizona_Cardinals_logo.svg.png',
  'Atlanta Falcons': 'https://upload.wikimedia.org/wikipedia/en/thumb/c/c5/Atlanta_Falcons_logo.svg/192px-Atlanta_Falcons_logo.svg.png',
  'Baltimore Ravens': 'https://upload.wikimedia.org/wikipedia/en/thumb/1/16/Baltimore_Ravens_logo.svg/193px-Baltimore_Ravens_logo.svg.png',
  'Buffalo Bills': 'https://upload.wikimedia.org/wikipedia/en/thumb/7/77/Buffalo_Bills_logo.svg/189px-Buffalo_Bills_logo.svg.png',
  'Carolina Panthers': 'https://upload.wikimedia.org/wikipedia/en/thumb/1/1c/Carolina_Panthers_logo.svg/100px-Carolina_Panthers_logo.svg.png',
  'Chicago Bears': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Chicago_Bears_logo.svg/100px-Chicago_Bears_logo.svg.png',
  'Cincinnati Bengals': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Cincinnati_Bengals_logo.svg/100px-Cincinnati_Bengals_logo.svg.png',
  'Cleveland Browns': 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d9/Cleveland_Browns_logo.svg/100px-Cleveland_Browns_logo.svg.png',
  'Dallas Cowboys': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Dallas_Cowboys.svg/100px-Dallas_Cowboys.svg.png',
  'Denver Broncos': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/44/Denver_Broncos_logo.svg/100px-Denver_Broncos_logo.svg.png',
  'Detroit Lions': 'https://upload.wikimedia.org/wikipedia/en/thumb/7/71/Detroit_Lions_logo.svg/100px-Detroit_Lions_logo.svg.png',
  'Green Bay Packers': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Green_Bay_Packers_logo.svg/100px-Green_Bay_Packers_logo.svg.png',
  'Houston Texans': 'https://upload.wikimedia.org/wikipedia/en/thumb/2/28/Houston_Texans_logo.svg/100px-Houston_Texans_logo.svg.png',
  'Indianapolis Colts': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Indianapolis_Colts_logo.svg/100px-Indianapolis_Colts_logo.svg.png',
  'Jacksonville Jaguars': 'https://upload.wikimedia.org/wikipedia/en/thumb/7/74/Jacksonville_Jaguars_logo.svg/100px-Jacksonville_Jaguars_logo.svg.png',
  'Kansas City Chiefs': 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e1/Kansas_City_Chiefs_logo.svg/100px-Kansas_City_Chiefs_logo.svg.png',
  'Las Vegas Raiders': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/48/Las_Vegas_Raiders_logo.svg/100px-Las_Vegas_Raiders_logo.svg.png',
  'Los Angeles Chargers': 'https://upload.wikimedia.org/wikipedia/en/thumb/7/72/NFL_Chargers_logo.svg/100px-NFL_Chargers_logo.svg.png',
  'Los Angeles Rams': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8a/Los_Angeles_Rams_logo.svg/100px-Los_Angeles_Rams_logo.svg.png',
  'Miami Dolphins': 'https://upload.wikimedia.org/wikipedia/en/thumb/3/37/Miami_Dolphins_logo.svg/100px-Miami_Dolphins_logo.svg.png',
  'Minnesota Vikings': 'https://upload.wikimedia.org/wikipedia/en/thumb/4/48/Minnesota_Vikings_logo.svg/98px-Minnesota_Vikings_logo.svg.png',
  'New England Patriots': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/New_England_Patriots_logo.svg/100px-New_England_Patriots_logo.svg.png',
  'New Orleans Saints': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/New_Orleans_Saints_logo.svg/98px-New_Orleans_Saints_logo.svg.png',
  'New York Giants': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/New_York_Giants_logo.svg/100px-New_York_Giants_logo.svg.png',
  'New York Jets': 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/New_York_Jets_logo.svg/100px-New_York_Jets_logo.svg.png',
  'Philadelphia Eagles': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8e/Philadelphia_Eagles_logo.svg/100px-Philadelphia_Eagles_logo.svg.png',
  'Pittsburgh Steelers': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Pittsburgh_Steelers_logo.svg/100px-Pittsburgh_Steelers_logo.svg.png',
  'San Francisco 49ers': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/San_Francisco_49ers_logo.svg/100px-San_Francisco_49ers_logo.svg.png',
  'Seattle Seahawks': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8e/Seattle_Seahawks_logo.svg/100px-Seattle_Seahawks_logo.svg.png',
  'Tampa Bay Buccaneers': 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Tampa_Bay_Buccaneers_logo.svg/100px-Tampa_Bay_Buccaneers_logo.svg.png',
  'Tennessee Titans': 'https://github.com/nflverse/nflfastR-data/raw/master/titans.png', 
  'Washington Commanders': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Washington_commanders.svg/100px-Washington_commanders.svg.png'
};

// Team Color Mapping (Primary, Secondary)
const teamColors: { [key: string]: [string, string] } = {
  'Tennessee Titans': ['#002244', '#4B92DB'],
  'Cleveland Browns': ['#FF3C00', '#311D00'],
  'New York Giants': ['#0B2265', '#A71930'],
  'New England Patriots': ['#002244', '#C60C30'],
  'Jacksonville Jaguars': ['#006778', '#000000'],
  'Las Vegas Raiders': ['#000000', '#A5ACAF'],
  'New York Jets': ['#003F2D', '#000000'], // Using provided colors, might need adjustment
  'Carolina Panthers': ['#0085CA', '#000000'],
  'New Orleans Saints': ['#D3BC8D', '#000000'],
  'Chicago Bears': ['#0B162A', '#C83803'],
  'San Francisco 49ers': ['#AA0000', '#B3995D'],
  'Dallas Cowboys': ['#002244', '#B0B7BC'],
  'Miami Dolphins': ['#008E97', '#F58220'],
  'Indianapolis Colts': ['#002C5F', '#a5acaf'],
  'Atlanta Falcons': ['#A71930', '#000000'],
  'Arizona Cardinals': ['#97233F', '#000000'],
  'Cincinnati Bengals': ['#FB4F14', '#000000'],
  'Seattle Seahawks': ['#002244', '#69be28'],
  'Tampa Bay Buccaneers': ['#A71930', '#322F2B'],
  'Denver Broncos': ['#002244', '#FB4F14'],
  'Pittsburgh Steelers': ['#000000', '#FFB612'],
  'Los Angeles Chargers': ['#007BC7', '#ffc20e'],
  'Green Bay Packers': ['#203731', '#FFB612'],
  'Minnesota Vikings': ['#4F2683', '#FFC62F'],
  'Houston Texans': ['#03202F', '#A71930'],
  'Los Angeles Rams': ['#003594', '#FFD100'],
  'Baltimore Ravens': ['#241773', '#9E7C0C'],
  'Detroit Lions': ['#0076B6', '#B0B7BC'],
  'Washington Commanders': ['#5A1414', '#FFB612'],
  'Buffalo Bills': ['#00338D', '#C60C30'],
  'Kansas City Chiefs': ['#E31837', '#FFB612'],
  'Philadelphia Eagles': ['#004C54', '#A5ACAF']
};

// Position Color Mapping
const positionColors: { [key: string]: string } = {
  'QB': '#DC143C', // Crimson
  'RB': '#006400', // DarkGreen
  'WR': '#FF8C00', // DarkOrange
  'TE': '#9932CC', // DarkOrchid
  'OT': '#8B4513', // SaddleBrown
  'OG': '#8B4513', // SaddleBrown (Same as OT for OL)
  'OC': '#8B4513', // SaddleBrown (Same as OT for OL)
  'OL': '#8B4513', // SaddleBrown (Generic OL)
  'EDGE': '#4682B4', // SteelBlue
  'DL': '#556B2F', // DarkOliveGreen
  'DE': '#556B2F', // DarkOliveGreen (Same as DL)
  'DT': '#556B2F', // DarkOliveGreen (Same as DL)
  'LB': '#800080', // Purple
  'CB': '#1E90FF', // DodgerBlue
  'S': '#FFD700', // Gold
  'Default': '#708090' // SlateGray - Fallback
};

// All NFL Teams (for changing pick)
const ALL_NFL_TEAMS = [
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills', 
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns', 
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers', 
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs', 
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins', 
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants', 
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers', 
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders'
].sort(); // Sort alphabetically for the dropdown

// Define interface for Grading Result
interface GradingResult {
  submissionId: string;
  userName: string;
  submittedAt: string;
  correctPicks: number;
  firstMissPickIndex: number;
  firstMissTeamIndex: number;
  pickComparisonFailed: boolean; 
}

const AdminDraftPage: React.FC = () => {
  const [currentPickIndex, setCurrentPickIndex] = useState<number>(0);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [draftComplete, setDraftComplete] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allPositions, setAllPositions] = useState<string[]>([]);
  const [selectedPositionFilter, setSelectedPositionFilter] = useState<string>('All');
  const [playerNameFilter, setPlayerNameFilter] = useState<string>('');

  // Refs for scrolling
  const activePickRef = useRef<HTMLLIElement | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);

  // State for grading results
  const [gradingResults, setGradingResults] = useState<GradingResult[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false); // Loading state for submit

  // Effect to load teams and players
  useEffect(() => {
    // Initialize picks once teams are available
    setPicks(round1Teams.map(team => ({ team, player: null })));

    // Fetch and parse player data
    Papa.parse<CsvPlayerRow>('/players.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      delimiter: '	',
      complete: (results) => {
        const playersData: Player[] = results.data.map((row, index) => {
          const ageString = row['Age on  Week 1'];
          const ageNumber = parseFloat(ageString);
          const displayAge = !isNaN(ageNumber) ? Math.floor(ageNumber) : 'N/A';

          return {
            id: `p${index + 1}`,
            name: row['Name'] || 'N/A',
            position: row['Position'] || 'N/A',
            school: row['School'] || 'N/A',
            age: displayAge,
            height: row['Height'] || 'N/A',
            weight: row['Weight'] || 'N/A',
            hand: row['Hand'] || 'N/A',
            arm: row['Arm'] || 'N/A',
            wing: row['Wing'] || 'N/A',
            fortyYdDash: row['40 yd Dash'] || 'N/A',
            tenYdSplit: row['10 yd Split'] || 'N/A',
            vertJump: row['Vert Jump'] || 'N/A',
            broadJump: row['Broad Jump'] || 'N/A',
            threeCone: row['3 Cone'] || 'N/A',
            shuttle: row['Shuttle'] || 'N/A',
            bench: row['Bench'] || 'N/A',
          };
        });

        // Extract unique positions after loading
        const positionSet = new Set(playersData.map(p => p.position).filter(p => p && p !== 'N/A'));
        const uniquePositions = ['All', ...Array.from(positionSet)]; // Convert Set to Array
        setAllPositions(uniquePositions.sort()); // Add 'All' and sort

        setAvailablePlayers(playersData);
        setIsLoading(false);
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        setIsLoading(false);
      }
    });
  }, []); // Empty dependency array ensures this runs once on mount

  useEffect(() => {
    if (currentPickIndex >= round1Teams.length) {
      setDraftComplete(true);
    }
  }, [currentPickIndex]);

  // Effect to scroll the active pick OR submit button into view
  useEffect(() => {
    if (draftComplete && submitButtonRef.current) {
      // If draft is complete, scroll to the submit button
      submitButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!draftComplete && activePickRef.current) {
      // Otherwise, scroll to the active pick
      activePickRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center' // Try 'nearest' or 'start' if 'center' doesn't feel right
      });
    }
    // Depend on both index and draft completion status
  }, [currentPickIndex, draftComplete]);

  const handlePickPlayer = (player: Player) => {
    if (draftComplete) return;

    const updatedPicks = [...picks];
    updatedPicks[currentPickIndex].player = player;
    setPicks(updatedPicks);

    setAvailablePlayers(prev => prev.filter(p => p.id !== player.id));

    setCurrentPickIndex(prev => prev + 1);
  };

  // Function to handle changing the team for the current pick
  const handleTeamChange = (event: React.ChangeEvent<HTMLSelectElement>, index: number) => {
    const newTeamName = event.target.value;
    // Create a new picks array to avoid direct state mutation
    const updatedPicks = picks.map((pick, i) => {
      if (i === index) {
        // Update the team name for the specific pick
        // Keep the original pick number
        return { ...pick, team: { ...pick.team, name: newTeamName } };
      }
      return pick;
    });
    setPicks(updatedPicks);
  };

  // Function to undo the last pick
  const handleUndoPick = () => {
    if (currentPickIndex === 0) return; // Cannot undo if no picks made

    const lastPickIndex = currentPickIndex - 1;
    const pickToUndo = picks[lastPickIndex];

    if (!pickToUndo || !pickToUndo.player) return; // Nothing to undo for this pick index

    // Restore the player to the available list
    const playerToRestore = pickToUndo.player;
    setAvailablePlayers(prev => 
      [...prev, playerToRestore].sort((a, b) => {
        const nameA = a?.name?.toLowerCase() || '';
        const nameB = b?.name?.toLowerCase() || '';
        return nameA.localeCompare(nameB);
      })
    );

    // Clear the player from the pick in the picks array
    const updatedPicks = [...picks];
    updatedPicks[lastPickIndex].player = null;
    setPicks(updatedPicks);

    // Move the current pick index back
    setCurrentPickIndex(lastPickIndex);

    // Ensure draft is not marked complete
    if (draftComplete) {
      setDraftComplete(false);
    }
    console.log(`Admin Undo complete for pick ${lastPickIndex + 1}`);
  };

  // Function to handle ACTUAL draft submission
  const handleSubmitActualDraft = async () => {
    if (!draftComplete) {
      console.error('Admin Draft not complete yet!');
      return;
    }
    console.log("Submitting ACTUAL draft:", picks);
    setIsSubmitting(true); // Set loading state
    setGradingResults(null); // Clear previous results

    try {
      // Call the ADMIN endpoint
      const response = await fetch('/api/admin/submit-actual-draft', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ picks: picks }),
      });

      const result = await response.json(); // Contains message and results

      if (!response.ok) {
        console.error('Failed to submit actual draft:', result.error || response.statusText);
        alert(`Error submitting actual draft: ${result.error || 'Server error'}`);
        setGradingResults(null); // Ensure results are cleared on error
      } else {
        console.log('Actual draft submitted, grading results:', result);
        alert(result.message || 'Actual draft submitted successfully!');
        setGradingResults(result.results || []); // Set the grading results from response
      }
    } catch (error) {
      console.error('Network or other error submitting actual draft:', error);
      alert('Failed to submit actual draft due to a network or client error.');
      setGradingResults(null);
    } finally {
      setIsSubmitting(false); // Clear loading state
    }
  };

  // Filter available players based on the selected position AND name filter
  const filteredPlayers = availablePlayers.filter(player => {
    const positionMatch = selectedPositionFilter === 'All' || player.position === selectedPositionFilter;
    const nameMatch = player.name.toLowerCase().includes(playerNameFilter.toLowerCase());
    return positionMatch && nameMatch;
  });

  const currentTeam = !draftComplete ? round1Teams[currentPickIndex] : null;
  const picksSoFar = picks.slice(0, currentPickIndex);
  const remainingTeams = round1Teams.slice(currentPickIndex + 1);

  return (
    <>
      <div className="draft-container">
        {/* Updated Team Panel */}
        <div className="team-panel">
          <h2>Draft Board</h2>

          <ul className="full-draft-list">
            {picks.map((pick, index) => {
              const colors = teamColors[pick.team.name] || ['#cccccc', '#aaaaaa']; // Fallback colors
              const gradient = `linear-gradient(to right, ${colors[0]}, ${colors[1]})`;
              const isCurrentPick = !draftComplete && index === currentPickIndex;

              return (
                <li 
                  key={pick.team.pick} 
                  // Conditionally attach the ref to the active pick
                  ref={isCurrentPick ? activePickRef : null}
                  className={`team-list-item ${isCurrentPick ? 'on-the-clock' : ''}`}
                  style={{ background: gradient }}
                >
                  {/* Correct Order: Pick # -> Logo -> Team Name -> Player */}
                  <span className="pick-number">#{pick.team.pick}</span>
                  <img src={teamLogos[pick.team.name]} alt={`${pick.team.name} logo`} className="team-logo" />
                  
                  {/* Conditionally render dropdown or static text */}
                  {isCurrentPick ? (
                    <select 
                      value={pick.team.name}
                      onChange={(e) => handleTeamChange(e, index)}
                      className="team-change-dropdown"
                    >
                      {ALL_NFL_TEAMS.map(teamName => (
                        <option key={teamName} value={teamName}>{teamName}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="team-name-player">
                      {pick.team.name}
                      {pick.player && `: ${pick.player.name} (${pick.player.position})`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          
          {/* Show draft complete message OR submit button */}
          {draftComplete && (
            <button 
              ref={submitButtonRef} // Attach ref to the button
              className="submit-draft-button admin-submit" // Add specific class maybe
              onClick={handleSubmitActualDraft} // Use the ADMIN submit handler
              disabled={isSubmitting} // Disable while submitting
            >
              {isSubmitting ? 'Submitting & Grading...' : 'Submit ACTUAL Draft & Grade'}
            </button>
          )}

        </div>

        {/* Player Panel */}
        <div className="player-panel">
          <div className="player-panel-header"> 
            {/* Add Search Input */}
            <input 
              type="text"
              placeholder="Search by name..."
              value={playerNameFilter}
              onChange={(e) => setPlayerNameFilter(e.target.value)}
              className="player-name-search"
            />
            <h2>Available Players</h2>
            {/* Add Undo Button if applicable */} 
            {currentPickIndex > 0 && !draftComplete && (
              <button onClick={handleUndoPick} className="undo-button">
                 <i className="fas fa-undo"></i> Undo
              </button>
            )}
            <select
              value={selectedPositionFilter}
              onChange={(e) => setSelectedPositionFilter(e.target.value)}
              className="position-filter-dropdown"
            >
              {allPositions.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <p>Loading players...</p>
          ) : (
            filteredPlayers.length > 0 ? (
              <ul className="player-list">
                {filteredPlayers.map(player => {
                  const bgColor = positionColors[player.position] || positionColors['Default'];
                  return (
                    <li 
                      key={player.id} 
                      className="player-card" 
                      style={{ backgroundColor: bgColor }} // Apply background color
                    >
                      {/* Main container for info (basic + table) */}
                      <div className="player-card-info">
                        {/* Basic Info */}
                        <div className="player-basic-info">
                          <strong>{player.name}</strong> ({player.position})<br />
                          School: {player.school}<br />
                          Age: {player.age}
                        </div>
                        {/* Table for detailed stats - Wrapped for mobile scrolling */}
                        <div className="player-details-table-wrapper">
                          <table className="player-details-table">
                            <thead>
                              <tr>
                                <th>Height</th><th>Weight</th><th>Hand</th><th>Arm</th><th>Wing</th>
                                <th>40yd</th><th>10yd</th><th>Vert</th><th>Broad</th>
                                <th>3C</th><th>Shuttle</th><th>Bench</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>{player.height}</td><td>{player.weight}</td><td>{player.hand}</td><td>{player.arm}</td><td>{player.wing}</td>
                                <td>{player.fortyYdDash}</td><td>{player.tenYdSplit}</td><td>{player.vertJump}</td><td>{player.broadJump}</td>
                                <td>{player.threeCone}</td><td>{player.shuttle}</td><td>{player.bench}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {/* Pick Button */}
                      <button onClick={() => handlePickPlayer(player)} className="pick-button">
                        Pick
                      </button>
                    </li>
                  ); 
                })} 
              </ul>
            ) : (
              <p>No players available for the selected position.</p> // Adjusted message
            )
          )}
        </div>
      </div>
      {/* Grading Results Section */} 
      {gradingResults && (
        <div className="grading-results-container">
          <h2>Grading Results</h2>
          {gradingResults.length > 0 ? (
            <table className="grading-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>User</th>
                  <th>Correct Picks</th>
                  <th>Tie Break 1 (1st Player Miss)</th>
                  <th>Tie Break 2 (1st Team Miss)</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {gradingResults.map((result, index) => (
                  <tr key={result.submissionId}>
                    <td>{index + 1}</td>
                    <td>{result.userName}</td>
                    <td>{result.correctPicks}</td>
                    <td>{result.firstMissPickIndex > 32 ? 'All Correct' : `Pick ${result.firstMissPickIndex}`}</td>
                    <td>{result.firstMissTeamIndex > 32 ? 'All Correct' : `Pick ${result.firstMissTeamIndex}`}</td>
                    <td>{new Date(result.submittedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No mock drafts found to grade.</p>
          )}
        </div>
      )}
    </>
  );
};

export default AdminDraftPage; 