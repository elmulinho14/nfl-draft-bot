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

    const deleteSql = `DELETE FROM mock_draft_picks WHERE user_id = $1`;
    await client.query(deleteSql, [userId]);

    const insertSql = `INSERT INTO mock_draft_picks (
      submission_id, user_id, user_name, pick_number, 
      team_name, player_name, player_position, player_school, submitted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

    for (const pick of picks) {
      const pickNumber = pick.team?.pick;
      const teamName = pick.team?.name;
      const playerName = pick.player?.name || null;
      const playerPosition = pick.player?.position || null;
      const playerSchool = pick.player?.school || null;

      if (pickNumber === undefined || !teamName) {
        console.error(`[Draft Submit ${submissionId}] Invalid pick data found, rolling back:`, pick);
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid pick data in submission.' });
      }

      await client.query(insertSql, [
            submissionId, userId, userName, pickNumber, 
        teamName, playerName, playerPosition, playerSchool, submissionTimestamp
      ]);
    } 

    await client.query('COMMIT');
    
        res.status(201).json({ message: 'Draft submitted successfully (overwritten previous)', submissionId: submissionId });

  } catch (error) {
    console.error(`[Draft Submit ${submissionId}] Transaction error:`, error.message);
    await client.query('ROLLBACK');
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

    const upsertSql = `
      INSERT INTO actual_draft_picks (pick_number, team_name, player_name, player_position, player_school, submitted_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (pick_number) 
      DO UPDATE SET 
        team_name = EXCLUDED.team_name,
        player_name = EXCLUDED.player_name,
        player_position = EXCLUDED.player_position,
        player_school = EXCLUDED.player_school,
        submitted_at = EXCLUDED.submitted_at`;

    for (const pick of picks) {
        const pickNumber = pick.team?.pick;
        const teamName = pick.team?.name;
        const playerName = pick.player?.name || null;
        const playerPosition = pick.player?.position || null;
        const playerSchool = pick.player?.school || null;

        if (pickNumber === undefined || !teamName) {
        console.error(`[Admin Submit Actual] Invalid pick data found, rolling back:`, pick);
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid pick data in submission.' });
      }

      await client.query(upsertSql, [
        pickNumber, teamName, playerName, playerPosition, playerSchool, submissionTimestamp
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Actual draft submitted/updated successfully' });

  } catch (error) {
    console.error('[Admin Submit Actual] Transaction error:', error.message);
    await client.query('ROLLBACK');
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
// This requires the grading logic to be implemented
app.get('/api/leaderboard', async (req, res) => {
    try {
        console.log('[GET Leaderboard] Starting leaderboard generation');
        
        // Check if actual draft exists
        const actualDraft = await getActualDraftPicks();
        console.log(`[GET Leaderboard] Actual draft picks found: ${actualDraft.length}`);
        
        if (!actualDraft || actualDraft.length === 0) {
            return res.status(404).json({ message: "Actual draft data not available yet for grading." });
        }

        // Check for any mock drafts in the database (sanity check)
        const countResult = await pool.query('SELECT COUNT(*) as total FROM mock_draft_picks');
        console.log(`[GET Leaderboard] Total mock draft picks in database: ${countResult.rows[0].total}`);
        
        // Count distinct users
        const usersResult = await pool.query('SELECT COUNT(DISTINCT user_id) as users FROM mock_draft_picks');
        console.log(`[GET Leaderboard] Distinct users with mock drafts: ${usersResult.rows[0].users}`);
        
        // Get all mock drafts grouped by user
        console.log('[GET Leaderboard] Calling getAllMockDraftsGrouped()');
        const allMockDrafts = await getAllMockDraftsGrouped();
        console.log(`[GET Leaderboard] Mock drafts returned: ${Object.keys(allMockDrafts).length} users`);
        
        if (!allMockDrafts || Object.keys(allMockDrafts).length === 0) {
            return res.status(404).json({ message: "No mock drafts submitted yet." });
        }

        const leaderboard = [];
        for (const userId in allMockDrafts) {
            const userDraft = allMockDrafts[userId];
            const score = gradeSingleMockDraft(userDraft.picks, actualDraft);
            leaderboard.push({
                userId: userId,
                userName: userDraft.userName,
                score: score,
                submittedAt: userDraft.submittedAt
            });
        }

        leaderboard.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return new Date(a.submittedAt) - new Date(b.submittedAt);
        });

        res.json(leaderboard);

    } catch (error) {
        console.error('[Get Leaderboard] Error generating leaderboard:', error.message);
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
    console.error("Error fetching actual draft picks:", error);
    throw error;
  }
}

// Helper to get all mock drafts, grouped by user (most recent submission per user)
async function getAllMockDraftsGrouped() {
    console.log('[getAllMockDraftsGrouped] Starting to fetch mock drafts');
    
    // First, check if we have any mock drafts at all
    try {
        const checkQuery = 'SELECT COUNT(*) as count FROM mock_draft_picks';
        const checkResult = await pool.query(checkQuery);
        console.log(`[getAllMockDraftsGrouped] Total mock draft picks found: ${checkResult.rows[0].count}`);
        
        if (checkResult.rows[0].count === '0') {
            console.log('[getAllMockDraftsGrouped] No mock draft picks found in the database');
            return {};
        }
    } catch (error) {
        console.error('[getAllMockDraftsGrouped] Error checking for mock drafts:', error.message);
    }
    
    // Revised SQL to use submission_id for fetching the latest complete draft per user
    const sql = `
        WITH LatestSubmissionInfo AS (
            -- Find the latest submission timestamp for each user
            SELECT
                user_id,
                MAX(submitted_at) as latest_submission_time
            FROM mock_draft_picks
            GROUP BY user_id
        ),
        LatestSubmissionIDs AS (
            -- Find the submission_id associated with that latest timestamp
            -- Use DISTINCT ON in case of exact timestamp ties (picks one submission_id)
            SELECT DISTINCT ON (p.user_id) 
                p.user_id,
                p.submission_id,
                lsi.latest_submission_time
            FROM mock_draft_picks p
            JOIN LatestSubmissionInfo lsi ON p.user_id = lsi.user_id AND p.submitted_at = lsi.latest_submission_time
            ORDER BY p.user_id, p.submitted_at DESC -- Order to control which submission_id is picked by DISTINCT ON
        )
        -- Select all picks belonging to the latest submission_id for each user
        SELECT 
            p.user_id, 
            p.user_name, 
            p.pick_number, 
            p.team_name, 
            p.player_name, 
            p.player_position, 
            p.player_school,
            lsids.latest_submission_time as submitted_at -- Use the determined latest time
        FROM mock_draft_picks p
        JOIN LatestSubmissionIDs lsids ON p.submission_id = lsids.submission_id -- Join using the submission_id
        ORDER BY p.user_id, p.pick_number ASC;
    `;

    console.log('[getAllMockDraftsGrouped] Executing SQL query to fetch latest submissions');
    
    try {
        const { rows } = await pool.query(sql);
        console.log(`[getAllMockDraftsGrouped] Query returned ${rows.length} rows`);
        
        // Debug the first few rows if any exist
        if (rows.length > 0) {
            console.log('[getAllMockDraftsGrouped] First row sample:', JSON.stringify(rows[0]));
        } else {
            console.log('[getAllMockDraftsGrouped] No rows returned from query');
            
            // Troubleshooting: Let's check each CTE separately
            console.log('[getAllMockDraftsGrouped] Troubleshooting - checking LatestSubmissionInfo CTE');
            const infoResult = await pool.query(`
                SELECT user_id, latest_submission_time 
                FROM (
                    SELECT
                        user_id,
                        MAX(submitted_at) as latest_submission_time
                    FROM mock_draft_picks
                    GROUP BY user_id
                ) as LatestSubmissionInfo
            `);
            console.log(`[getAllMockDraftsGrouped] LatestSubmissionInfo results: ${infoResult.rows.length} users`);
            if (infoResult.rows.length > 0) {
                console.log('[getAllMockDraftsGrouped] First user info:', JSON.stringify(infoResult.rows[0]));
            }
            
            return {};
        }
        
        const groupedDrafts = {};

        rows.forEach(row => {
            if (!groupedDrafts[row.user_id]) {
                groupedDrafts[row.user_id] = {
                    userName: row.user_name,
                    submittedAt: row.submitted_at,
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
        
        console.log(`[getAllMockDraftsGrouped] Processed into ${Object.keys(groupedDrafts).length} user drafts`);
        
        // Log pick counts per user for debugging
        Object.keys(groupedDrafts).forEach(userId => {
            console.log(`[getAllMockDraftsGrouped] User ${userId} (${groupedDrafts[userId].userName}) has ${groupedDrafts[userId].picks.length} picks`);
        });
        
        return groupedDrafts;
    } catch (error) {
        console.error("[getAllMockDraftsGrouped] Error fetching all mock drafts:", error);
        // More detailed logging of the error
        console.error("[getAllMockDraftsGrouped] Error details:", {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            position: error.position,
            routine: error.routine
        });
        throw error;
    }
}

// --- Grading Logic ---

function gradeSingleMockDraft(mockPicks, actualPicks) {
    let score = 0;
    const actualPicksMap = actualPicks.reduce((map, pick) => {
        map[pick.pick_number] = pick;
        return map;
    }, {});

    mockPicks.forEach(mockPick => {
        const actualPick = actualPicksMap[mockPick.pick_number];
        if (actualPick) {
            if (mockPick.player_name && mockPick.player_name === actualPick.player_name) {
                score += 5;
            }
            else if (mockPick.player_name && actualPicks.some(ap => ap.player_name === mockPick.player_name)) {
                 score += 2;
            }
            else if (mockPick.player_position && mockPick.player_position === actualPick.player_position && mockPick.team_name === actualPick.team_name) {
                score += 1;
            }
        }
    });

    return score;
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