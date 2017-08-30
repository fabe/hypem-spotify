require('dotenv').config();
const fetch = require('node-fetch');
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
    log.info('Starting to fetch new hot tracks!');
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
          searchTrack(
            track.artist,
            track.title,
            uri => (uri ? addTrack(uri) : null)
          );
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
function searchTrack(artist, title, callback) {
  const fullTitle = `${artist} - ${title}`;
  const hello = spotifyApi.searchTracks(fullTitle).then(data => {
    const track = data.body.tracks.items[0];
    if (track) {
      callback(track.uri);
    } else {
      log.error('Track not found: ' + fullTitle);
      callback(false);
    }
  }, err => (err ? log.error(err) : null));
}

/**
 * Add track to playlist.
 * @param {string} track - Track as Spotify URI.
 */
function addTrack(track) {
  spotifyApi.setRefreshToken(SPOTIFY_REFRESH_TOKEN);
  refreshToken(() => {
    spotifyApi
      .addTracksToPlaylist(SPOTIFY_USER, SPOTIFY_PLAYLIST, [track])
      .then(
        data => log.info('Added track to playlist.'),
        err => (err ? log.error(err) : null)
      );
  });
}

/**
 * Refresh access token of Spotify.
 * @callback - Fired when token was set.
 */
function refreshToken(callback) {
  spotifyApi.refreshAccessToken().then(data => {
    spotifyApi.setAccessToken(data.body['access_token']);
    callback ? callback() : null;
  }, err => (err ? log.error(err) : null));
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
    log.info('Got all tracks!');
    const tracks = data.body.tracks.items.map(item => ({
      uri: item.track.uri,
    }));
    spotifyApi
      .removeTracksFromPlaylist(SPOTIFY_USER, SPOTIFY_PLAYLIST, tracks)
      .then(data => {
        log.info('Playlist cleared!');
        callback();
      }, err => (err ? log.error(err) : null));
  }, err => (err ? log.error(err) : null));
}

/**
 * Update playlist description.
 */
function updatePlaylistDescription() {
  spotifyApi
    .changePlaylistDetails(SPOTIFY_USER, SPOTIFY_PLAYLIST, {
      description: `${DESCRIPTION} Last updated: ${new Date().toISOString()}`,
    })
    .then(data => log.info('Playlist description updated!')), err =>
    log.error('Something went wrong!', err);
}
