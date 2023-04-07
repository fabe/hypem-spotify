import config from "./config";
import spotifyApi from "./spotifyApi";

/**
 * Removes duplicate tracks.
 */

export default function removeDuplicateTracks() {
  return spotifyApi.getPlaylist(config.playlistId).then((data) => {
    console.log("Got all tracks!");
    const tracks = data.body.tracks.items
      .filter((i) => Boolean(i.track))
      .map((item) => ({
        uri: item.track!.uri,
        name: item.track!.name,
      }));

    let uniq = {};
    const duplicates = tracks.filter(function (entry) {
      if (uniq[entry.name]) {
        return true;
      }
      uniq[entry.name] = true;
      return false;
    });

    if (duplicates.length) {
      spotifyApi
        .removeTracksFromPlaylist(config.playlistId, duplicates)
        .then((data) => {
          console.log(`Removed ${duplicates.length} duplicate tracks!`);
        });
    } else {
      console.log(`Removed ${duplicates.length} duplicate tracks!`);
    }
  });
}
