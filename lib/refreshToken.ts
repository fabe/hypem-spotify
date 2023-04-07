import spotifyApi from "./spotifyApi";

/**
 * Refresh access token of Spotify.
 */

export default async function refreshToken() {
  const data = await spotifyApi.refreshAccessToken();

  return spotifyApi.setAccessToken(data.body["access_token"]);
}
