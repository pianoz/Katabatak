require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/games',      require('./routes/games'));
app.use('/api/characters', require('./routes/characters'));
app.use('/api/skills',     require('./routes/skills'));

const pages = {
  '/login':   'login.html',
  '/landing': 'landing.html',
  '/dm':      'dm-dashboard.html',
  '/player':  'player-dashboard.html',
};

for (const [route, file] of Object.entries(pages)) {
  app.get(route, (_req, res) =>
    res.sendFile(path.join(__dirname, 'public', file))
  );
}

app.get('/', (_req, res) => res.redirect('/login'));

app.listen(PORT, () => console.log(`Katabatak running on http://localhost:${PORT}`));
