import config from "./config";
import spotifyApi from "./spotifyApi";

/**
 * Update playlist description.
 */

export default function updatePlaylistDescription() {
  return spotifyApi.changePlaylistDetails(config.playlistId, {
    description: `${
      config.playlistDescription
    } Last updated on ${new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}.`,
  });
}
