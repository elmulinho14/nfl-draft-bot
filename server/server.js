const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose(); // Import SQLite
const { v4: uuidv4 } = require('uuid'); // Import uuid
require('dotenv').config();
const path = require('path');

const app = express();
const PORT = process.env.NODE_ENV === 'production' ? 3000 : (process.env.PORT || 5000);

// --- SQLite Database Setup ---
const dbPath = path.join(__dirname, 'mockDrafts.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    // Create table with new structure if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS mock_draft_picks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id TEXT NOT NULL, -- UUID for grouping picks
      user_id TEXT,
      user_name TEXT,
      pick_number INTEGER NOT NULL,
      team_name TEXT NOT NULL,
      player_name TEXT,
      player_position TEXT,
      player_school TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP -- Timestamp for the submission group
    )`, (err) => {
      if (err) {
        console.error('Error creating mock_draft_picks table', err.message);
      }
    });
    // Create actual_draft_picks table
    db.run(`CREATE TABLE IF NOT EXISTS actual_draft_picks (
      pick_number INTEGER PRIMARY KEY,
      team_name TEXT NOT NULL,
      player_name TEXT,
      player_position TEXT,
      player_school TEXT,
      submitted_at DATETIME
    )`, (err) => {
      if (err) {
        console.error('Error creating actual_draft_picks table', err.message);
      }
    });
  }
});

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
  // In a real application, you'd typically save the profile to a database
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
    // Redirect to the draft page after successful login
    res.redirect('/draft'); 
  }
);

app.get('/api/user', (req, res) => {
  if (req.user) {
    res.json({
      user: req.user
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

app.get('/api/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// Middleware to check for admin user
const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user && req.user.username === 'alex952323') {
    return next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};

// Promisify db.run for async/await usage
const runAsync = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { // Use function to access this.lastID/changes if needed
      if (err) {
        reject(err);
      } else {
        resolve(this); // Resolve with the statement context
      }
    });
  });
};

// --- API Endpoint for Mock Draft Submission --- (Refactored for async/await)
app.post('/api/drafts', async (req, res) => { // Make handler async
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { picks } = req.body;
  const userId = req.user.id;
  const userName = req.user.username;
  const submissionId = uuidv4();
  const submissionTimestamp = new Date().toISOString();

  if (!picks || !Array.isArray(picks) || picks.length === 0) {
    return res.status(400).json({ error: 'Invalid draft data provided' });
  }

  try {
    // Start transaction
    await runAsync('BEGIN TRANSACTION', []);

    // Delete previous picks
    const deleteSql = `DELETE FROM mock_draft_picks WHERE user_id = ?`;
    await runAsync(deleteSql, [userId]);

    // Prepare insert statement (still synchronous)
    const insertSql = `INSERT INTO mock_draft_picks (
      submission_id, user_id, user_name, pick_number, 
      team_name, player_name, player_position, player_school, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const stmt = db.prepare(insertSql); 

    // Execute inserts sequentially using await
    let successfulInserts = 0;
    for (const pick of picks) {
      const pickNumber = pick.team?.pick;
      const teamName = pick.team?.name;
      const playerName = pick.player?.name || null;
      const playerPosition = pick.player?.position || null;
      const playerSchool = pick.player?.school || null;

      if (pickNumber === undefined || !teamName) {
        console.error(`[Draft Submit ${submissionId}] Invalid pick data found, rolling back:`, pick);
        await runAsync('ROLLBACK', []);
        return res.status(400).json({ error: 'Invalid pick data in submission.' });
      }

      // Promisify stmt.run
      await new Promise((resolve, reject) => {
          stmt.run(
            submissionId, userId, userName, pickNumber, 
            teamName, playerName, playerPosition, playerSchool, submissionTimestamp,
            (err) => {
              if (err) {
                console.error(`[Draft Submit ${submissionId}] Error inserting pick #${pickNumber}:`, err.message);
                reject(err);
              } else {
                successfulInserts++;
                resolve();
              }
            }
          );
      });
    } 

    // Finalize statement (still synchronous)
    await new Promise((resolve, reject) => {
        stmt.finalize((err) => {
            if(err) {
                console.error(`[Draft Submit ${submissionId}] Error finalizing statement:`, err.message);
                reject(err);
            } else {
                resolve();
            }
        });
    });

    // Commit transaction
    await runAsync('COMMIT', []);
    
    // Send success response
    if (!res.headersSent) {
        res.status(201).json({ message: 'Draft submitted successfully (overwritten previous)', submissionId: submissionId });
    }

  } catch (error) {
    console.error(`[Draft Submit] Transaction error:`, error.message);
    try {
        await runAsync('ROLLBACK', []);
    } catch (rollbackError) {
        console.error(`[Draft Submit] Error rolling back transaction:`, rollbackError.message);
    }
    // Send error response
    if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to save draft due to a server error.' });
    }
  }
});

// --- Admin Endpoint for Actual Draft Submission ---
app.post('/api/admin/submit-actual-draft', isAdmin, (req, res) => {
  const { picks } = req.body;
  const submissionTimestamp = new Date().toISOString();

  if (!picks || !Array.isArray(picks) || picks.length === 0) {
    return res.status(400).json({ error: 'Invalid actual draft data provided' });
  }

  // Use a transaction to replace old actual draft and insert new one
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    // Clear previous actual draft
    db.run('DELETE FROM actual_draft_picks', (err) => {
      if (err) {
        console.error('Error clearing actual_draft_picks:', err.message);
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'Failed to clear previous actual draft' });
      }

      const sql = `INSERT INTO actual_draft_picks (
        pick_number, team_name, player_name, player_position, player_school, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?)`;
      const stmt = db.prepare(sql);
      let errorOccurred = false;

      picks.forEach(pick => {
        if (errorOccurred) return;

        const pickNumber = pick.team?.pick;
        const teamName = pick.team?.name;
        const playerName = pick.player?.name || null;
        const playerPosition = pick.player?.position || null;
        const playerSchool = pick.player?.school || null;

        if (pickNumber === undefined || !teamName) {
            console.error('Invalid actual pick data found:', pick);
            errorOccurred = true;
            return;
        }

        stmt.run(
          pickNumber, teamName, playerName, playerPosition, playerSchool, submissionTimestamp,
          (err) => {
            if (err) {
              console.error('Error inserting actual pick:', err.message);
              errorOccurred = true;
            }
          }
        );
      });

      stmt.finalize((err) => {
        if (err) {
          console.error('Error finalizing actual draft statement:', err.message);
          errorOccurred = true;
        }
        if (errorOccurred) {
          db.run('ROLLBACK');
          console.error('Actual draft transaction rolled back.');
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to save actual draft picks.' });
          }
        } else {
          db.run('COMMIT');
          console.log(`Actual draft saved successfully at ${submissionTimestamp}`);
          // --- Trigger Grading --- (To be implemented next)
          gradeMockDrafts((gradingError, results) => {
            if (gradingError) {
              console.error("Grading failed:", gradingError);
              // Still return success for submission, but maybe warn about grading
              if (!res.headersSent) {
                 res.status(201).json({ message: 'Actual draft submitted, but grading failed.', results: [] });
              }
            } else {
              if (!res.headersSent) {
                 res.status(201).json({ message: 'Actual draft submitted and grading complete.', results: results });
              }
            }
          });
          // -----------------------
        }
      });
    });
  });
});

// --- Grading Function --- 
function gradeMockDrafts(callback) {
  console.log("Starting grading process...");

  let actualDraftPicks = {}; // Store as map: { pickNumber: { teamName, playerName, ... } }
  let allMockDrafts = {}; // Store as map: { submissionId: { userName, submittedAt, picks: { pickNumber: { ... } } } }

  // 1. Fetch Actual Draft
  db.all('SELECT * FROM actual_draft_picks ORDER BY pick_number', [], (err, actualRows) => {
    if (err) {
      console.error('Error fetching actual draft:', err.message);
      return callback(err);
    }
    if (actualRows.length === 0) {
        console.warn("No actual draft found to grade against.");
        return callback(null, []); // No actual draft, return empty results
    }
    actualRows.forEach(row => {
        actualDraftPicks[row.pick_number] = row; 
    });

    // 2. Fetch All Mock Draft Picks
    db.all('SELECT * FROM mock_draft_picks ORDER BY submission_id, pick_number', [], (err, mockRows) => {
      if (err) {
        console.error('Error fetching mock drafts:', err.message);
        return callback(err);
      }

      // Group mock picks by submission_id
      mockRows.forEach(row => {
        if (!allMockDrafts[row.submission_id]) {
          allMockDrafts[row.submission_id] = {
            submissionId: row.submission_id,
            userId: row.user_id,
            userName: row.user_name,
            submittedAt: row.submitted_at,
            picks: {}
          };
        }
        allMockDrafts[row.submission_id].picks[row.pick_number] = row;
      });

      // 3. Perform Grading for each submission
      const results = Object.values(allMockDrafts).map(mockSubmission => {
        let correctPicksCount = 0;
        let firstMissPickIndex = Infinity; 
        let firstMissTeamIndex = Infinity;
        let pickComparisonFailed = false;

        for (let pickNum = 1; pickNum <= 32; pickNum++) { // Assuming 32 picks
            const actualPick = actualDraftPicks[pickNum];
            const mockPick = mockSubmission.picks[pickNum];

            if (!actualPick) {
                console.warn(`Actual pick missing for pick number ${pickNum}. Cannot grade fully.`);
                pickComparisonFailed = true;
                // Treat as a miss for tie-breaking maybe?
                if (firstMissPickIndex === Infinity) firstMissPickIndex = pickNum;
                if (firstMissTeamIndex === Infinity) firstMissTeamIndex = pickNum;
                continue; // Or break, depending on desired handling
            }
            
            // Team Check (for tie-breaker 2)
            if (firstMissTeamIndex === Infinity && (!mockPick || mockPick.team_name !== actualPick.team_name)) {
                firstMissTeamIndex = pickNum;
            }

            // Player Check (for score and tie-breaker 1)
            // Check if mock pick exists and player names match
            if (mockPick && actualPick.player_name && mockPick.player_name === actualPick.player_name) {
                correctPicksCount++;
            } else {
                // Record the first pick number where the player was wrong
                if (firstMissPickIndex === Infinity) {
                    firstMissPickIndex = pickNum;
                }
            }
        }
        
        // If all picks were correct, set index high for sorting
        if (firstMissPickIndex === Infinity) firstMissPickIndex = 33; // Higher than max pick number
        if (firstMissTeamIndex === Infinity) firstMissTeamIndex = 33;

        return {
          submissionId: mockSubmission.submissionId,
          userName: mockSubmission.userName,
          submittedAt: mockSubmission.submittedAt,
          correctPicks: correctPicksCount,
          firstMissPickIndex: firstMissPickIndex, // Lower is worse
          firstMissTeamIndex: firstMissTeamIndex, // Lower is worse
          pickComparisonFailed: pickComparisonFailed // Flag if actual draft was incomplete
        };
      });

      // 4. Sort Results based on rules
      results.sort((a, b) => {
        // Rule 1: Correct Picks (Descending)
        if (a.correctPicks !== b.correctPicks) {
          return b.correctPicks - a.correctPicks;
        }
        // Rule 2: First Player Miss (Descending Index - higher index is better)
        if (a.firstMissPickIndex !== b.firstMissPickIndex) {
          return b.firstMissPickIndex - a.firstMissPickIndex;
        }
        // Rule 3: First Team Miss (Descending Index - higher index is better)
        if (a.firstMissTeamIndex !== b.firstMissTeamIndex) {
          return b.firstMissTeamIndex - a.firstMissTeamIndex;
        }
        // Rule 4: Submission Time (Ascending)
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      });

      console.log("Grading complete.");
      callback(null, results);
    });
  });
}

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'} mode)`);
}); 