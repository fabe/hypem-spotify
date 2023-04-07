import config from "./config";
import spotifyApi from "./spotifyApi";

/**
 * Add track to playlist.
 * @param {string[]} track - Tracks as Spotify URI.
 */

export default function addTracks(tracks) {
  return spotifyApi.addTracksToPlaylist(config.playlistId, tracks).then(
    (data) => data,
    (err) => console.log(err.body)
  );
}
