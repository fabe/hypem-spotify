import SpotifyWebApi from "spotify-web-api-node";
import config from "./config";

const spotifyApi = new SpotifyWebApi({
  clientId: config.spotifyClientId,
  clientSecret: config.spotifyClientSecret,
  redirectUri: "https://example.com/callback",
});

spotifyApi.setRefreshToken(config.spotifyRefreshToken);

export default spotifyApi;
