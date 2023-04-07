type Config = {
  playlistId: string;
  playlistDescription: string;
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRefreshToken: string;
  apiSecret: string;
};

const config: Config = {
  playlistId: process.env.SPOTIFY_PLAYLIST!,
  playlistDescription:
    "🔥 Top 50 Hype Machine tracks that are available on Spotify, updated every 24 hours! Maintained by a 🤖. GitHub: fabe/hypem-spotify.",
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID!,
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
  spotifyRefreshToken: process.env.SPOTIFY_REFRESH_TOKEN!,
  apiSecret: process.env.SECRET!,
};

export default config;
