require('dotenv').config();
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const moment = require('moment');
const timestamp = moment().format('DD.MM.YYYY HH:mm:ss');
const winston = require('winston');
const SpotifyWebApi = require('spotify-web-api-node');
const unique = require('array-unique');
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
 * Jesus christ I'm not proud of this 🙄
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
          setTimeout(() => {
            removeDuplicateTracks();
          }, 1000 * arr.length + 1);
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
    .then(async html => {
      const tracks = [];
      const $ = cheerio.load(html);

      const search = new Promise((resolve, reject) => {
        $('#track-list')
          .children()
          .each(async (i, track) => {
            const urls = $(track)
              .find('.meta')
              .find('.download')
              .children();
            let foundSpotify = false;

            const spotify = urls.each((i, el) => {
              el = $(el);
              if (el.text() === 'Spotify') {
                foundSpotify = true;
                const href = el.attr('href');
                const id = href.substr(href.lastIndexOf('/') + 1);
                tracks.push(id);
              }
            });

            if (!foundSpotify) {
              const artist = $(track)
                .find('.track_name')
                .find('.artist')
                .text();
              const title = $(track)
                .find('.track_name')
                .find('.base-title')
                .text();
              const uri = await searchTrack(artist, title);
              console.log(uri);

              tracks.push(uri);
            }

            resolve(tracks);
          });
      });

      const t = await search.then(tr => tr);
      return t;
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

function removeDuplicateTracks() {
  return spotifyApi.getPlaylist(SPOTIFY_USER, SPOTIFY_PLAYLIST).then(data => {
    log.info(timestamp, 'Got all tracks!');
    const tracks = data.body.tracks.items.map(item => ({
      uri: item.track.uri,
      name: item.track.name,
    }));

    let uniq = {};
    const duplicates = tracks.filter(function(entry) {
      if (uniq[entry.name]) {
        return true;
      }
      uniq[entry.name] = true;
      return false;
    });

    if (duplicates.length) {
      spotifyApi
        .removeTracksFromPlaylist(SPOTIFY_USER, SPOTIFY_PLAYLIST, duplicates)
        .then(data => {
          log.info(timestamp, `Removed ${duplicates.length} duplicate tracks!`);
        });
    }
  });
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
