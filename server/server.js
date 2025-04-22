const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const cors = require('cors');
const { Pool } = require('pg'); // Import pg Pool
const { v4: uuidv4 } = require('uuid'); // Import uuid
require('dotenv').config();
const path = require('path');

const app = express();
const PORT = process.env.NODE_ENV === 'production' ? 3000 : (process.env.PORT || 5000);

// --- PostgreSQL Database Setup ---
// Use DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // You might need SSL configuration depending on your PostgreSQL hosting
  // ssl: {
  //   rejectUnauthorized: false // Example, adjust based on your needs
  // }
});

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Function to initialize the database schema
const initializeDb = async () => {
  try {
    // Create mock_draft_picks table with PostgreSQL syntax
    await pool.query(`CREATE TABLE IF NOT EXISTS mock_draft_picks (
      id SERIAL PRIMARY KEY, 
      submission_id TEXT NOT NULL, 
      user_id TEXT,
      user_name TEXT,
      pick_number INTEGER NOT NULL,
      team_name TEXT NOT NULL,
      player_name TEXT,
      player_position TEXT,
      player_school TEXT,
      submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP 
    )`);
    console.log('mock_draft_picks table checked/created.');

    // Create actual_draft_picks table with PostgreSQL syntax
    await pool.query(`CREATE TABLE IF NOT EXISTS actual_draft_picks (
      pick_number INTEGER PRIMARY KEY,
      team_name TEXT NOT NULL,
      player_name TEXT,
      player_position TEXT,
      player_school TEXT,
      submitted_at TIMESTAMPTZ 
    )`);
    console.log('actual_draft_picks table checked/created.');

    // Add index for faster user draft lookups
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mock_draft_user_id ON mock_draft_picks(user_id)`);
    console.log('Index on mock_draft_picks(user_id) checked/created.');

  } catch (err) {
    console.error('Error initializing database schema:', err.message);
    // Consider exiting if schema setup fails critically
    // process.exit(1); 
  }
};

// Initialize DB schema on startup
initializeDb();

// Middleware
app.use(cors({
  origin: 'https://nfl-draft-bot.replit.app',
  credentials: true
}));

app.use(express.json());
app.use(session({
  secret: 'discord-auth-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60000 * 60 * 24 // 1 day
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../client/build')));

// Discord Strategy
passport.use(new DiscordStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.REDIRECT_URI,
  scope: ['identify', 'email']
}, 
function(accessToken, refreshToken, profile, done) {
  // Store or retrieve user from DB here if needed
  // For now, just passing the profile through
  return done(null, profile);
}));

// Serialization
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Routes
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', 
  passport.authenticate('discord', { 
    failureRedirect: '/' 
  }), 
  (req, res) => {
    // Successful authentication, redirect to a logged-in page.
    // Redirect to the draft page after successful login
    res.redirect(process.env.CLIENT_REDIRECT || '/draft'); 
  }
);

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated() && req.user) {
    res.json({
      user: { 
        id: req.user.id, 
        username: req.user.username, 
        avatar: req.user.avatar,
        discriminator: req.user.discriminator
        // Add other relevant fields, avoid sending secrets/tokens
      }
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

app.get('/api/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        return next(err);
      }
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });
});

// Middleware to check for admin user
const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user && req.user.username === 'alex952323') {
    return next();
  } else {
    console.warn(`Admin access denied for user: ${req.user ? req.user.username : 'unauthenticated'}`);
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};

// --- API Endpoint for Mock Draft Submission --- (Refactored for pg and async/await)
app.post('/api/drafts', async (req, res) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { picks } = req.body;
  const userId = req.user.id;
  const userName = req.user.username;
  const submissionId = uuidv4();
  const submissionTimestamp = new Date();

  if (!picks || !Array.isArray(picks) || picks.length === 0) {
    return res.status(400).json({ error: 'Invalid draft data provided' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Explicitly delete ALL previous picks for this USERNAME instead of user_id
    const deleteSql = `DELETE FROM mock_draft_picks WHERE user_name = $1`;
    await client.query(deleteSql, [userName]);

    const insertSql = `INSERT INTO mock_draft_picks (
      submission_id, user_id, user_name, pick_number, 
      team_name, player_name, player_position, player_school, submitted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
    
    // Track insertion results
    let successCount = 0;

    for (const pick of picks) {
      const pickNumber = pick.team?.pick;
      const teamName = pick.team?.name;
      const playerName = pick.player?.name || null;
      const playerPosition = pick.player?.position || null;
      const playerSchool = pick.player?.school || null;

      if (pickNumber === undefined || !teamName) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid pick data in submission.' });
      }

      // Insert the new pick with the current submission_id
      await client.query(insertSql, [
        submissionId, userId, userName, pickNumber, 
        teamName, playerName, playerPosition, playerSchool, submissionTimestamp
      ]);
      successCount++;
    } 

    await client.query('COMMIT');
    
    res.status(201).json({ 
      message: 'Draft submitted successfully (overwritten previous)', 
      submissionId: submissionId,
      pickCount: successCount
    });

  } catch (error) {
    console.error('Failed to save draft:', error.message);
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError.message);
    }
    res.status(500).json({ error: 'Failed to save draft due to a server error.' });
  } finally {
    client.release();
  }
});

// --- Admin Endpoint for Actual Draft Submission --- (Refactored for pg)
app.post('/api/admin/submit-actual-draft', isAdmin, async (req, res) => {
  const { picks } = req.body;
  const submissionTimestamp = new Date();

  if (!picks || !Array.isArray(picks) || picks.length === 0) {
    return res.status(400).json({ error: 'Invalid actual draft data provided' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const pick of picks) {
      // Correctly access nested properties
      const pickNumber = pick.team?.pick;
      const teamName = pick.team?.name;
      const playerName = pick.player?.name || null;
      const playerPosition = pick.player?.position || null;
      const playerSchool = pick.player?.school || null;

      if (pickNumber === undefined || !teamName) {
        console.error('Invalid pick data found, rolling back:', JSON.stringify(pick));
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid pick data in submission.' });
      }

      try {
        // First delete any existing pick with this number to ensure clean data
        await client.query('DELETE FROM actual_draft_picks WHERE pick_number = $1', [pickNumber]);
        
        // Insert the new pick
        const insertSql = `
          INSERT INTO actual_draft_picks 
          (pick_number, team_name, player_name, player_position, player_school, submitted_at)
          VALUES ($1, $2, $3, $4, $5, $6)`;
          
        await client.query(insertSql, [
          pickNumber, teamName, playerName, playerPosition, playerSchool, submissionTimestamp
        ]);
      } catch (insertError) {
        console.error(`Error inserting pick #${pickNumber}:`, insertError.message);
        throw insertError; // Re-throw to trigger the catch block
      }
    }

    await client.query('COMMIT');
    
    // **** Generate leaderboard after successful submission ****
    try {
      // Get the actual draft picks we just saved
      const actualDraft = await getActualDraftPicks();
      
      if (actualDraft.length === 0) {
        return res.status(201).json({ 
          message: 'Actual draft submitted, but there were no picks to grade with.', 
          results: [] 
        });
      }
      
      // Get all mock drafts
      const allMockDrafts = await getAllMockDraftsGrouped();
      
      if (Object.keys(allMockDrafts).length === 0) {
        return res.status(201).json({ 
          message: 'Actual draft submitted, but no mock drafts found to grade.', 
          results: [] 
        });
      }
      
      // Grade each mock draft and generate the leaderboard
      const leaderboard = [];
      
      for (const userId in allMockDrafts) {
        const userDraft = allMockDrafts[userId];
        
        // Calculate score using our grading function
        const score = gradeSingleMockDraft(userDraft.picks, actualDraft);
        
        // Find first player miss and first team miss for tiebreakers
        let firstMissPickIndex = 33; // Higher than max pick
        let firstMissTeamIndex = 33; // Higher than max pick
        
        const actualPickMap = actualDraft.reduce((map, pick) => {
          map[pick.pick_number] = pick;
          return map;
        }, {});
        
        userDraft.picks.forEach(mockPick => {
          const pickNum = mockPick.pick_number;
          const actualPick = actualPickMap[pickNum];
          
          if (actualPick) {
            // Check for player mismatch
            if (firstMissPickIndex === 33 && 
                (!mockPick.player_name || mockPick.player_name !== actualPick.player_name)) {
              firstMissPickIndex = pickNum;
            }
            
            // Check for team mismatch
            if (firstMissTeamIndex === 33 && mockPick.team_name !== actualPick.team_name) {
              firstMissTeamIndex = pickNum;
            }
          }
        });
        
        leaderboard.push({
          submissionId: userDraft.submissionId || userId, // Fallback to userId if no submissionId
          userId: userId,
          userName: userDraft.userName,
          correctPicks: score,
          firstMissPickIndex: firstMissPickIndex,
          firstMissTeamIndex: firstMissTeamIndex, 
          submittedAt: userDraft.submittedAt,
          pickComparisonFailed: false // Set to true if there was an issue comparing
        });
      }
      
      // Sort leaderboard by correctPicks (descending), then by tiebreaker fields
      leaderboard.sort((a, b) => {
        // Primary sort: correct picks (descending)
        if (a.correctPicks !== b.correctPicks) {
          return b.correctPicks - a.correctPicks;
        }
        
        // Tiebreaker 1: First miss pick index (descending - higher is better)
        if (a.firstMissPickIndex !== b.firstMissPickIndex) {
          return b.firstMissPickIndex - a.firstMissPickIndex;
        }
        
        // Tiebreaker 2: First miss team index (descending - higher is better)
        if (a.firstMissTeamIndex !== b.firstMissTeamIndex) {
          return b.firstMissTeamIndex - a.firstMissTeamIndex;
        }
        
        // Tiebreaker 3: Submission time (ascending - earlier is better)
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      });
      
      // Return both the success message and the grading results
      return res.status(201).json({ 
        message: 'Actual draft submitted and grading complete.', 
        results: leaderboard 
      });
      
    } catch (gradingError) {
      console.error('Error during grading process:', gradingError.message);
      // Still return success for submission, but note the grading failure
      return res.status(201).json({ 
        message: 'Actual draft submitted, but an error occurred during grading.', 
        error: gradingError.message,
        results: []
      });
    }

  } catch (error) {
    console.error('Transaction error:', error.message);
    
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError.message);
    }
    
    res.status(500).json({ error: 'Failed to save actual draft due to a server error.' });
  } finally {
    client.release();
  }
});

// --- API Endpoint to Get User's Mock Draft ---
app.get('/api/drafts', async (req, res) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const userId = req.user.id;

  try {
    const sql = `SELECT pick_number, team_name, player_name, player_position, player_school, submitted_at 
                 FROM mock_draft_picks 
                 WHERE user_id = $1 
                 ORDER BY pick_number ASC`;
    const { rows } = await pool.query(sql, [userId]);
    
    res.json(rows); 

  } catch (error) {
    console.error(`[Get User Draft ${userId}] Error fetching draft:`, error.message);
    res.status(500).json({ error: 'Failed to fetch user mock draft.' });
  }
});

// --- API Endpoint to Get Actual Draft ---
app.get('/api/actual-draft', async (req, res) => {
  try {
    const sql = `SELECT pick_number, team_name, player_name, player_position, player_school, submitted_at 
                 FROM actual_draft_picks 
                 ORDER BY pick_number ASC`;
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (error) {
    console.error('[Get Actual Draft] Error fetching actual draft:', error.message);
    res.status(500).json({ error: 'Failed to fetch actual draft.' });
  }
});

// --- API Endpoint to Get Leaderboard (All Mock Drafts + Scores) ---
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Get actual draft picks
    const actualDraft = await getActualDraftPicks();
    
    if (!actualDraft || actualDraft.length === 0) {
      return res.status(404).json({ message: "Actual draft data not available yet for grading." });
    }

    // Get all mock drafts grouped by user
    const allMockDrafts = await getAllMockDraftsGrouped();
    
    if (!allMockDrafts || Object.keys(allMockDrafts).length === 0) {
      return res.status(404).json({ message: "No mock drafts submitted yet." });
    }

    // Create leaderboard entries
    const leaderboard = [];
    for (const userId in allMockDrafts) {
      const userDraft = allMockDrafts[userId];
      
      const result = gradeSingleMockDraft(userDraft.picks, actualDraft);
      
      leaderboard.push({
        submissionId: userDraft.submissionId || userId,
        userName: userDraft.userName,
        correctPicks: result.correctPicks,
        firstMissPickIndex: result.firstMissPickIndex,
        firstMissTeamIndex: result.firstMissTeamIndex,
        submittedAt: userDraft.submittedAt,
        pickComparisonFailed: false
      });
    }

    // Sort leaderboard:
    // 1. By correct picks (descending)
    // 2. By first miss pick index (descending - higher is better)
    // 3. By first miss team index (descending - higher is better)
    // 4. By submission time (ascending - earlier is better)
    leaderboard.sort((a, b) => {
      // Primary sort: correct picks (descending)
      if (a.correctPicks !== b.correctPicks) {
        return b.correctPicks - a.correctPicks;
      }
      
      // Tiebreaker 1: First miss pick index (descending - higher is better)
      if (a.firstMissPickIndex !== b.firstMissPickIndex) {
        return b.firstMissPickIndex - a.firstMissPickIndex;
      }
      
      // Tiebreaker 2: First miss team index (descending - higher is better)
      if (a.firstMissTeamIndex !== b.firstMissTeamIndex) {
        return b.firstMissTeamIndex - a.firstMissTeamIndex;
      }
      
      // Tiebreaker 3: Submission time (ascending - earlier is better)
      return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    });

    res.json(leaderboard);

  } catch (error) {
    console.error('Error generating leaderboard:', error.message);
    res.status(500).json({ error: 'Failed to generate leaderboard.' });
  }
});

// --- Helper Functions for Database Interaction ---

async function getActualDraftPicks() {
  const sql = `SELECT pick_number, team_name, player_name, player_position, player_school 
               FROM actual_draft_picks 
               ORDER BY pick_number ASC`;
  try {
    const { rows } = await pool.query(sql);
    return rows;
  } catch (error) {
    console.error("Error fetching actual draft picks:", error.message);
    throw error;
  }
}

async function getAllMockDraftsGrouped() {
  // Simplified SQL using a more robust approach to get latest submissions
  const sql = `
      WITH UserLatestSubmission AS (
          -- First, get the latest submission_id for each user based on submitted_at timestamp
          SELECT DISTINCT ON (user_id) 
              user_id, 
              submission_id,
              submitted_at
          FROM mock_draft_picks
          ORDER BY user_id, submitted_at DESC
      )
      -- Then get all picks for those submission_ids
      SELECT 
          mp.user_id,
          mp.user_name,
          mp.submission_id,
          mp.pick_number,
          mp.team_name,
          mp.player_name,
          mp.player_position,
          mp.player_school,
          uls.submitted_at
      FROM mock_draft_picks mp
      JOIN UserLatestSubmission uls 
          ON mp.user_id = uls.user_id 
          AND mp.submission_id = uls.submission_id
      ORDER BY mp.user_id, mp.pick_number
  `;
  
  try {
    const { rows } = await pool.query(sql);
    
    if (rows.length === 0) {
      return {};
    }
    
    // Group by user_id
    const groupedDrafts = {};

    rows.forEach(row => {
      if (!groupedDrafts[row.user_id]) {
        groupedDrafts[row.user_id] = {
          userName: row.user_name,
          submittedAt: row.submitted_at,
          submissionId: row.submission_id,
          picks: []
        };
      }
      
      groupedDrafts[row.user_id].picks.push({
        pick_number: row.pick_number,
        team_name: row.team_name,
        player_name: row.player_name,
        player_position: row.player_position,
        player_school: row.player_school
      });
    });
    
    return groupedDrafts;
  } catch (error) {
    console.error("Error fetching mock drafts:", error.message);
    throw error;
  }
}

// --- Grading Logic ---

function gradeSingleMockDraft(mockPicks, actualPicks) {
  if (!mockPicks || !Array.isArray(mockPicks) || mockPicks.length === 0) {
    return { correctPicks: 0, firstMissPickIndex: 0, firstMissTeamIndex: 0 };
  }
  
  if (!actualPicks || !Array.isArray(actualPicks) || actualPicks.length === 0) {
    return { correctPicks: 0, firstMissPickIndex: 0, firstMissTeamIndex: 0 };
  }
  
  // Create a map for quick look-up of actual picks by pick_number
  const actualPicksMap = actualPicks.reduce((map, pick) => {
    if (pick.pick_number !== undefined && pick.pick_number !== null) {
      map[pick.pick_number] = pick;
    }
    return map;
  }, {});

  // Score is now ONLY the count of exact matches (correct player at correct position)
  let correctPicks = 0;
  
  // Track the first miss for tiebreakers
  let firstMissPickIndex = Infinity; // For players (will be set to first pick where player is wrong)
  let firstMissTeamIndex = Infinity; // For teams (will be set to first pick where team is wrong)
  
  // Sort mock picks by pick_number to ensure sequential processing
  const sortedMockPicks = [...mockPicks].sort((a, b) => 
    (a.pick_number || 0) - (b.pick_number || 0)
  );
  
  // Process each pick to calculate score and tiebreakers
  sortedMockPicks.forEach(mockPick => {
    if (!mockPick || typeof mockPick !== 'object' || mockPick.pick_number === undefined) {
      return;
    }
    
    const pickNum = mockPick.pick_number;
    const actualPick = actualPicksMap[pickNum];
    
    if (actualPick) {
      // Player match check (for score and first tiebreaker)
      const isPlayerMatch = mockPick.player_name && 
                            actualPick.player_name && 
                            mockPick.player_name === actualPick.player_name;
      
      // Team match check (for second tiebreaker)
      const isTeamMatch = mockPick.team_name === actualPick.team_name;
      
      // Update the score for exact player matches
      if (isPlayerMatch) {
        correctPicks++;
      } 
      // Record first player miss for tiebreaker 1
      else if (firstMissPickIndex === Infinity) {
        firstMissPickIndex = pickNum;
      }
      
      // Record first team miss for tiebreaker 2
      if (!isTeamMatch && firstMissTeamIndex === Infinity) {
        firstMissTeamIndex = pickNum;
      }
    }
  });
  
  // If there were no misses, set indices to max value
  if (firstMissPickIndex === Infinity) {
    firstMissPickIndex = 999; // Higher than max pick number
  }
  
  if (firstMissTeamIndex === Infinity) {
    firstMissTeamIndex = 999; // Higher than max pick number
  }

  return {
    correctPicks,
    firstMissPickIndex,
    firstMissTeamIndex
  };
}

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Correctly assign the server instance from app.listen
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'} mode)`);
});

// Re-implement shutdown using the server instance
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => { 
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('PostgreSQL pool has ended');
      process.exit(0);
    });
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => { 
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('PostgreSQL pool has ended');
      process.exit(0);
    });
  });
}); 