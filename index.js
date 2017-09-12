require('dotenv').config();
const fetch = require('node-fetch');
const moment = require('moment');
const timestamp = moment().format('DD.MM.YYYY HH:mm:ss');
const winston = require('winston');
const SpotifyWebApi = require('spotify-web-api-node');
const CronJob = require('cron').CronJob;

const DESCRIPTION =
  '🔥 Top 50 Hype Machine tracks on Spotify, updated every 24 hours! Maintained by a bot 🤖.';
const SPOTIFY_USER = process.env.SPOTIFY_USER;
const SPOTIFY_PLAYLIST = process.env.SPOTIFY_PLAYLIST;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

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

getNewTracks();
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

/**
 * Welcome to callback hell!
 * Brings everything together.
 */
function getNewTracks() {
  refreshToken(() => {
    updatePlaylistDescription();
    clearPlaylist(() => {
      getPopularTracks(data => {
        data.forEach((track, i) => {
          setTimeout(() => {
            searchTrack(
              track.artist,
              track.title,
              uri => (uri ? addTrack(uri) : null)
            );
          }, 1000 * i);
        });
      });
    });
  });
}

/**
 * Add track to playlist.
 * @param {string} artist - Artist of track.
 * @param {string} rirle - Title/name of track.
 * @callback - Sends out URI of track.
 */
function searchTrack(artist, title, callback, retry) {
  const fullTitle = `${artist} - ${title}`;
  const hello = spotifyApi.searchTracks(fullTitle).then(data => {
    const track = data.body.tracks.items[0];
    if (track) {
      callback(track.uri);
    } else {
      if (retry) {
        log.error(timestamp, 'Track not found: ' + fullTitle);
        callback(false);
      } else {
        const normalized = normalizeTrack(artist, title);
        searchTrack(normalized.artist, normalized.title, callback, true);
      }
    }
  }, err => (err ? log.error(timestamp, err) : null));
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
 * Add track to playlist.
 * @param {string} track - Track as Spotify URI.
 */
function addTrack(track) {
  spotifyApi
    .addTracksToPlaylist(SPOTIFY_USER, SPOTIFY_PLAYLIST, [track])
    .then(
      data => log.info(timestamp, 'Added track to playlist.'),
      err => (err ? log.error(timestamp, err) : null)
    );
}

/**
 * Refresh access token of Spotify.
 * @callback - Fired when token was set.
 */
function refreshToken(callback) {
  spotifyApi.refreshAccessToken().then(data => {
    spotifyApi.setAccessToken(data.body['access_token']);
    callback ? callback() : null;
  }, err => (err ? log.error(timestamp, err) : null));
}

/**
 * Get Hypem tracks
 * @callback - Sends out data.
 */
function getPopularTracks(callback) {
  fetch('https://api.hypem.com/v2/popular?mode=now&count=50')
    .then(res => res.json())
    .then(data => {
      log.info(timestamp, 'Fetched popular tracks.');
      callback(data);
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
  spotifyApi.getPlaylist(SPOTIFY_USER, SPOTIFY_PLAYLIST).then(data => {
    log.info(timestamp, 'Got all tracks!');
    const tracks = data.body.tracks.items.map(item => ({
      uri: item.track.uri,
    }));
    spotifyApi
      .removeTracksFromPlaylist(SPOTIFY_USER, SPOTIFY_PLAYLIST, tracks)
      .then(data => {
        log.info(timestamp, 'Playlist cleared!');
        callback();
      }, err => (err ? log.error(timestamp, err) : null));
  }, err => (err ? log.error(timestamp, err) : null));
}

/**
 * Update playlist description.
 */
function updatePlaylistDescription() {
  spotifyApi
    .changePlaylistDetails(SPOTIFY_USER, SPOTIFY_PLAYLIST, {
      description: `${DESCRIPTION} Last updated ${moment().format(
        'MMMM Do YYYY'
      )}`,
    })
    .then(data => log.info(timestamp, 'Playlist description updated!')),
    err => log.error(timestamp, 'Something went wrong!', err);
}
