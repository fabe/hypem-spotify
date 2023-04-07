import getTracksFromHTML from "./getTracksFromHTML";

/**
 * Crawls all popular pages from hypem and returns the tracklist.
 * @promise {array} - Returns the track list as Spotify URIs.
 */

export default function crawlTopTracks() {
  const urls = [
    "https://hypem.com/popular",
    "https://hypem.com/popular/2",
    "https://hypem.com/popular/3",
  ];
  let promises: Promise<any>[] = [];
  urls.forEach((url) => {
    promises.push(getTracksFromHTML(url));
  });

  return Promise.all(promises).then((tracks) => {
    const ids = tracks.join().split(",");
    return ids
      .map((id) => `spotify:track:${id}`)
      .filter((id) => id.length > 21);
  });
}
