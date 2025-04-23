import React, { useState, useEffect } from 'react';
import '../App.css'; // Reuse existing styles

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

// Define the structure of the data expected from /api/drafts
interface UserDraftPick {
    pick_number: number;
    team_name: string;
    player_name: string | null;
    player_position: string | null;
    player_school: string | null;
    submitted_at: string; // Or Date if parsed
}

const MyDraftPage: React.FC = () => {
    const [myPicks, setMyPicks] = useState<UserDraftPick[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        fetch('/api/drafts') // Backend endpoint for authenticated user's draft
            .then(res => {
                if (!res.ok) {
                    if (res.status === 401) {
                         throw new Error('Not authenticated. Please log in.');
                    }
                    throw new Error(`Failed to fetch draft data (Status: ${res.status})`);
                }
                return res.json();
            })
            .then((data: UserDraftPick[]) => {
                setMyPicks(data);
            })
            .catch(err => {
                console.error("Error fetching user's draft:", err);
                setError(err.message || 'An error occurred while fetching your draft.');
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []); // Empty dependency array means this runs once on mount

    if (isLoading) {
        return <div className="loading-container">Loading your draft...</div>;
    }

    if (error) {
        return <div className="error-container">Error: {error}</div>;
    }

    if (myPicks.length === 0) {
        return <div className="info-container">You haven't submitted a mock draft yet. Go to the Draft page to create one!</div>;
    }

    return (
        <div className="mydraft-container">
            <h1>My Submitted Mock Draft</h1>
            <ul className="full-draft-list view-only-draft-list"> {/* Add a modifier class if needed */}
                {myPicks.map((pick) => {
                    const colors = teamColors[pick.team_name] || ['#cccccc', '#aaaaaa']; // Simplified fallback
                    const gradient = `linear-gradient(to right, ${colors[0]}, ${colors[1]})`;
                    const logoSrc = teamLogos[pick.team_name]; // Get logo or undefined

                    return (
                        <li
                            key={pick.pick_number}
                            className="team-list-item" // Reuse the existing list item style
                            style={{ background: gradient }}
                        >
                            <span className="pick-number">#{pick.pick_number}</span>
                            {logoSrc && <img src={logoSrc} alt={`${pick.team_name} logo`} className="team-logo" />}
                            <span className="team-name-player">
                                {pick.team_name}
                                {pick.player_name && `: ${pick.player_name}${pick.player_position ? ` (${pick.player_position})` : ''}`}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default MyDraftPage; 