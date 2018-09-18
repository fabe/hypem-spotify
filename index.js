require('dotenv').config();
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const CronJob = require('cron').CronJob;
const moment = require('moment');
const timestamp = moment().format('DD.MM.YYYY HH:mm:ss');
const winston = require('winston');
const SpotifyWebApi = require('spotify-web-api-node');
const unique = require('array-unique');
const http = require('http');
const { PORT = 3002 } = process.env;

const DESCRIPTION =
  '🔥 Top 50 Hype Machine tracks that are available on Spotify, updated every 24 hours! Maintained by a bot. Open Source: https://github.com/fabe/hypem-spotify.';
const SPOTIFY_USER = process.env.SPOTIFY_USER;
const SPOTIFY_PLAYLIST = process.env.SPOTIFY_PLAYLIST;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

require('http')
  .createServer((req, res) => {
    if (req.url !== '/') {
      return;
    }

    getNewTracks();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end('🤖 HypeM Bot is doing its job!\n');
  })
  .listen(PORT);

new CronJob(
  '0 0 * * *',
  function() {
    log.info(timestamp, 'Starting to fetch new hot tracks!');
    getNewTracks();
  },
  null,
  true,
  'GMT'
);

// Winston
const log = new winston.Logger({
  transports: [new winston.transports.Console({ colorize: true })],
});
winston.level = 'debug';

// Set up Spotify API.
const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
  redirectUri: 'https://example.com/callback',
});

spotifyApi.setRefreshToken(SPOTIFY_REFRESH_TOKEN);

/**
 * Welcome to callback hell!
 * Jesus christ I'm not proud of this 🙄
 * Brings everything together.
 */
function getNewTracks() {
  refreshToken(() => {
    updatePlaylistDescription();
    clearPlaylist(() => {
      getTracksManually().then(tracks => {
        addTracks(tracks.filter(t => typeof t === 'string'));
      });
    });
  });
}

/**
 * Gets tracks from the HypeM api and searches them manually.
 * @promise {array} - Returns the track list as Spotify URIs.
 */
function getTracksManually() {
  return getPopularTracks().then(data => {
    let promises = [];
    data.forEach((track, i) => {
      promises.push(searchTrack(track.artist, track.title));
    });
    return Promise.all(promises);
  });
}

/**
 * Add track to playlist.
 * @param {string} artist - Artist of track.
 * @param {string} rirle - Title/name of track.
 * @callback - Sends out URI of track.
 */
function searchTrack(artist, title, callback, retry) {
  const fullTitle = `track:${title} artist:${artist}`;
  return spotifyApi.searchTracks(fullTitle).then(
    data => {
      const track = data.body.tracks.items[0];

      if (track) {
        return track.uri;
      } else {
        return false;
      }

      // if (track) {
      //   callback(track.uri);
      // } else {
      //   if (retry) {
      //     log.error(timestamp, 'Track not found: ' + fullTitle);
      //     callback(false);
      //   } else {
      //     const normalized = normalizeTrack(artist, title);
      //     searchTrack(normalized.artist, normalized.title, callback, true);
      //   }
      // }
    },
    err => (err ? log.error(timestamp, err) : null)
  );
}

/**
 * Normalizes a track that otherwise cannot be found.
 * @param {string} artist - Artist of track.
 * @param {string} title - Title/name of track.
 * @return {object} - Normalized artist & track.
 */
function normalizeTrack(artist, title) {
  const chars = ['(', '{', '[', ' & ', 'w/', ' ~ ', 'feat'];
  artist = removeAfterChar(artist, chars);
  title = removeAfterChar(title, chars);

  return { artist, title };
}

/**
 * Removes everything after a given char/string.
 * @param {string} string - Input.
 * @param {array} chars - List of unwanted chars/strings.
 * @return {string} - Minified string.
 */
function removeAfterChar(string, chars) {
  chars.forEach(char => {
    let n = string.indexOf(char);
    string = string.substring(0, n != -1 ? n : string.length);
  });

  return string.trim();
}

/**
 * Add tracks to playlist.
 * @param {array} tracks - Tracks as Spotify URIs.
 */
function addTracks(tracks) {
  spotifyApi
    .addTracksToPlaylist(SPOTIFY_USER, SPOTIFY_PLAYLIST, tracks)
    .then(data => data, err => log.error(timestamp, err.body));
}

/**
 * Refresh access token of Spotify.
 * @callback - Fired when token was set.
 */
function refreshToken(callback) {
  spotifyApi.refreshAccessToken().then(
    data => {
      spotifyApi.setAccessToken(data.body['access_token']);
      callback ? callback() : null;
    },
    err => {
      log.error(timestamp, err);
    }
  );
}

/**
 * Get Hypem tracks
 * @callback - Sends out data.
 */
function getPopularTracks() {
  return fetch('https://api.hypem.com/v2/popular?mode=now&count=50')
    .then(res => res.json())
    .then(data => {
      log.info(timestamp, 'Fetched popular tracks.');
      return data;
    });
}

/**
 * Minify data.
 * @param {array} data - Data to minify.
 */
function minifyData(data) {
  let minifiedData = data.map(item => ({
    itemid: item.itemid,
    added: new Date(),
  }));
  return minifiedData;
}

/**
 * Clear playlist.
 * @callback - Fired once completed.
 */
function clearPlaylist(callback) {
  spotifyApi.getPlaylist(SPOTIFY_USER, SPOTIFY_PLAYLIST).then(
    data => {
      // log.info(timestamp, 'Got all tracks!');
      const tracks = data.body.tracks.items.map(item => ({
        uri: item.track.uri,
      }));
      spotifyApi
        .removeTracksFromPlaylist(SPOTIFY_USER, SPOTIFY_PLAYLIST, tracks)
        .then(
          data => {
            log.info(timestamp, 'Playlist cleared!');
            callback();
          },
          err => (err ? log.error(timestamp, err) : null)
        );
    },
    err => (err ? log.error(timestamp, err) : null)
  );
}

/**
 * Update playlist description.
 */
function updatePlaylistDescription() {
  spotifyApi
    .changePlaylistDetails(SPOTIFY_USER, SPOTIFY_PLAYLIST, {
      description: `${DESCRIPTION} Last updated on ${moment().format(
        'MMMM Do YYYY'
      )}.`,
    })
    .then(data => log.info(timestamp, 'Playlist description updated!')),
    err => log.error(timestamp, 'Something went wrong!', err);
}
