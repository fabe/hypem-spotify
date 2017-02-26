const fetch = require('node-fetch');
const winston = require('winston');
const Datastore = require('nedb');
const SpotifyWebApi = require('spotify-web-api-node');
const CronJob = require('cron').CronJob;

const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8080;

app.use(express.static(__dirname + '/public'));
server.listen(port);

const SPOTIFY_USER = '1222363326';
const SPOTIFY_PLAYLIST = '4FnLbvEcgZaPYOEXdwX96x';
const SPOTIFY_CLIENT_ID = 'dc6f6365e71c44e0b8e4613897b63755';
const SPOTIFY_CLIENT_SECRET = '9560e6dc3aa941b7a3f39b8326668c97';
const SPOTIFY_REFRESH_TOKEN = 'AQAAnWMgD5cY2nRnT5A8RGnOCXp8GRU7bYb0PgANXpWQtup3KCN3lGsEH7ZrfsjrRMmGmNEgBtv8wN89GRxtc36YdUI2EFbDJV5LmraVQ9PEtVtcTMd0xrRKXnlEKM_kz6A';

// Winston
const log = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({ colorize: true })
  ]
});
winston.level = 'debug';

// Database
const db = new Datastore({ filename: `${__dirname}/db/tracks` });
db.loadDatabase(err => err ? log.error(err) : null);
db.ensureIndex({ fieldName: 'itemid', unique: true }, err => err ? log.error(err) : null);

// Go time
// getPopularTracks(data => saveToDatabase(minifyData(data)));

// Set up Spotify API.
const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
  redirectUri: 'https://example.com/callback'
});
spotifyApi.setRefreshToken(SPOTIFY_REFRESH_TOKEN);

getNewTracks();
new CronJob('0 0 * * *', function() {
  log.info('Starting to fetch new hot tracks!');
  getNewTracks();
}, null, true, 'GMT');

/**
 * Welcome to callback hell!
 * Brings everything together.
 */
function getNewTracks() {
  refreshToken(() => {
    getPopularTracks(data => {
      data.forEach((track, i) => {
        setTimeout(() => {
          db.find({ itemid: track.itemid }, (err, results) => {
            if (results.length == 0) {
              searchTrack(track.artist, track.title, uri => uri ? addTrack(uri) : null);
            }
          });
        }, 100 * i);
      });
      //saveToDatabase(minifyData(data));
    });
  });
}

/**
 * Add track to playlist.
 * @param {string} artist - Artist of track.
 * @param {string} rirle - Title/name of track.
 * @callback - Sends out URI of track.
 */
function searchTrack(artist, title, callback) {
  const fullTitle = `${artist} - ${title}`;
  const hello = spotifyApi.searchTracks(fullTitle)
    .then(data => {
      const track = data.body.tracks.items[0];
      if (track) {
        callback(track.uri);
      } else {
        log.error('Track not found: ' + fullTitle)
        callback(false);
      }
    }, err => err ? log.error(err) : null);
}

/**
 * Add track to playlist.
 * @param {string} track - Track as Spotify URI.
 */
function addTrack(track) {
  spotifyApi.setRefreshToken(SPOTIFY_REFRESH_TOKEN);
  refreshToken(() => {
    spotifyApi.addTracksToPlaylist(SPOTIFY_USER, SPOTIFY_PLAYLIST, [track])
      .then(data => log.info('Added track to playlist.'), err => err ? log.error(err) : null);
  });
}

/**
 * Refresh access token of Spotify.
 * @callback - Fired when token was set.
 */
function refreshToken(callback) {
  spotifyApi.refreshAccessToken()
    .then(data => {
      spotifyApi.setAccessToken(data.body['access_token']);
      callback ? callback() : null;
    }, err => err ? log.error(err) : null);
}

/**
 * Get Hypem tracks
 * @callback - Sends out data.
 */
function getPopularTracks(callback) {
  fetch('https://api.hypem.com/v2/popular?mode=now&count=50')
    .then(res => res.json())
    .then(data => {
      log.info('Fetched popular tracks.');
      callback(data);
    });
};

/**
 * Get Hypem tracks
 * @param {array} data - Data to save.
 * @callback - Fired once completed.
 */
function saveToDatabase(data, callback) {
  data.forEach(item => {
    db.find({ itemid: item.itemid }, (err, results) => {
      if (results.length == 0) {
        db.insert(item, err => {
          err
            ? log.error(err)
            : null;
          callback ? callback() : null;
        });
      } else {
        callback ? callback(false) : null;
      }
    })
  });
};

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
