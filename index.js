require('dotenv').config();
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const moment = require('moment');
const timestamp = moment().format('DD.MM.YYYY HH:mm:ss');
const winston = require('winston');
const SpotifyWebApi = require('spotify-web-api-node');
const CronJob = require('cron').CronJob;

const DESCRIPTION =
  '🔥 Top 50 Hype Machine tracks that are available on Spotify, updated every 24 hours! Maintained by a 🤖.';
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
      crawlTopTracks().then(tracks => {
        getTracksManually().then(otherTracks => {
          const arr = unique(tracks.concat(otherTracks));
          arr.forEach((uri, i) => {
            setTimeout(() => {
              if (uri) {
                addTrack(uri);
              }
            }, 1000 * i);
          });
        });
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
 * Crawls all popular pages from hypem and returns the tracklist.
 * @promise {array} - Returns the track list as Spotify URIs.
 */
function crawlTopTracks() {
  const urls = [
    'https://hypem.com/popular',
    'https://hypem.com/popular/2',
    'https://hypem.com/popular/3',
  ];
  let promises = [];
  urls.forEach(url => {
    promises.push(getTracksFromHTML(url));
  });

  return Promise.all(promises).then(tracks => {
    const ids = tracks.join().split(',');
    return ids.map(id => `spotify:track:${id}`);
  });
}

/**
 * Crawls a webpage and returns Spotify IDs.
 * @param {string} url - URL of page to crawl.
 * @promise {array} - Returns the track list.
 */
function getTracksFromHTML(url) {
  return fetch(url)
    .then(res => res.text())
    .then(html => {
      const tracks = [];
      const $ = cheerio.load(html);

      $('#track-list')
        .children()
        .each((i, track) => {
          const urls = $(track)
            .find('.meta')
            .find('.download')
            .children();

          const spotify = urls.each((i, el) => {
            el = $(el);
            if (el.text() === 'Spotify') {
              const href = el.attr('href');
              const id = href.substr(href.lastIndexOf('/') + 1);
              tracks.push(id);
            }
          });
        });

      return tracks;
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
  return spotifyApi.searchTracks(fullTitle).then(data => {
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
      description: `${DESCRIPTION} Last updated on ${moment().format(
        'MMMM Do YYYY'
      )}.`,
    })
    .then(data => log.info(timestamp, 'Playlist description updated!')),
    err => log.error(timestamp, 'Something went wrong!', err);
}

/**
 * Create unique array.
 */
function unique(arrArg) {
  return arrArg.filter((elem, pos, arr) => {
    return arr.indexOf(elem) == pos;
  });
}
