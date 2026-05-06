const router = require('express').Router();
const crypto = require('crypto');
const db = require('../db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

// List all games the current user belongs to
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT g.*, gm.role FROM games g
       JOIN game_memberships gm ON g.id = gm.game_id
       WHERE gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a game (creator becomes DM)
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const invite_code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO games (name, description, invite_code) VALUES ($1, $2, $3) RETURNING *',
      [name, description || null, invite_code]
    );
    await client.query(
      'INSERT INTO game_memberships (user_id, game_id, role) VALUES ($1, $2, $3)',
      [req.user.id, rows[0].id, 'dm']
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Get a single game (must be a member)
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT g.*, gm.role FROM games g
       JOIN game_memberships gm ON g.id = gm.game_id
       WHERE g.id = $1 AND gm.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Game not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Join a game via invite code
router.post('/join', async (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ error: 'Invite code required' });
  try {
    const { rows: games } = await db.query('SELECT * FROM games WHERE invite_code = $1', [invite_code]);
    if (!games.length) return res.status(404).json({ error: 'Invalid invite code' });
    await db.query(
      'INSERT INTO game_memberships (user_id, game_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.user.id, games[0].id, 'player']
    );
    res.json(games[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// List members of a game (must be a member)
router.get('/:id/members', async (req, res) => {
  try {
    const membership = await db.query(
      'SELECT 1 FROM game_memberships WHERE game_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!membership.rows.length) return res.status(403).json({ error: 'Not a member' });
    const { rows } = await db.query(
      `SELECT u.id, u.username, gm.role FROM users u
       JOIN game_memberships gm ON u.id = gm.user_id
       WHERE gm.game_id = $1`,
      [req.params.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
