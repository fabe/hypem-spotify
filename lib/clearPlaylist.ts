import config from "./config";
import spotifyApi from "./spotifyApi";

/**
 * Clear playlist.
 * @callback - Fired once completed.
 */

export default async function clearPlaylist() {
  const data = await spotifyApi.getPlaylist(config.playlistId);
  console.log("Got all tracks!");

  const tracks = data.body.tracks.items
    .filter((i) => Boolean(i.track))
    .map((item) => ({
      uri: item.track!.uri,
    }));

  return spotifyApi.removeTracksFromPlaylist(config.playlistId, tracks).then(
    () => {
      console.log("Playlist cleared!");
    },
    (err) => (err ? console.error(err) : null)
  );
}
