import * as cheerio from "cheerio";
import fetch from "node-fetch";

/**
 * Crawls a webpage and returns Spotify IDs.
 * @param {string} url - URL of page to crawl.
 * @promise {array} - Returns the track list.
 */

export default function getTracksFromHTML(url): Promise<any> {
  return fetch(url)
    .then((res) => res.text())
    .then(async (html) => {
      const tracks: string[] = [];
      const $ = cheerio.load(html);

      return new Promise((resolve, reject) => {
        $("#track-list")
          .children()
          .each((_, track) => {
            const urls = $(track).find("a");

            urls.each((_, el) => {
              const element = $(el);

              if (element.text() == "Spotify") {
                const href = element.attr("href");
                const id = href!.slice(href!.lastIndexOf("/") + 1);

                tracks.push(id);
              }
            });

            resolve(tracks);
          });
      });
    });
}
