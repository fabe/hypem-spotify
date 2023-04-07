import type { VercelRequest, VercelResponse } from "@vercel/node";
import addTracks from "../lib/addTracks";
import clearPlaylist from "../lib/clearPlaylist";
import crawlTopTracks from "../lib/crawlTopTracks";
import refreshToken from "../lib/refreshToken";
import updatePlaylistDescription from "../lib/updatePlaylistDescription";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.query.key !== process.env.SECRET) {
    return response.status(401).json({
      status: "error",
      message: "Please provide the correct API key.",
    });
  }

  try {
    // Get an up to date access token
    await refreshToken();

    // Update the playlist description to reflect the current date
    await updatePlaylistDescription();

    // Remove all tracks from the playlist
    await clearPlaylist();

    // Scrape the top tracks and add them to the playlist
    const tracks = await crawlTopTracks();
    await addTracks(tracks);

    response.status(200).json({
      status: "success",
      message: "Success.",
    });
  } catch (error) {
    return response.status(500).json({
      status: "error",
      message: "Unknown server error.",
    });
  }
}
