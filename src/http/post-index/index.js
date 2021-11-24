let arc = require("@architect/functions");
let data = require("@begin/data");
let parseBody = arc.http.helpers.bodyParser;
let axios = require("axios");
const { toDate, lightFormat } = require("date-fns");
const {
  checkBodyUrl,
  checkIsUrl,
  checkIfTwitterUrl,
  getTweetPath,
  getApiRequestUrl,
  checkIfContainsVideoOrGif,
  getBitrate,
  makeDownloadObject,
  sanitize,
  appendAskForSupport,
  appendLatestVersionInformation,
  checkClientVersion,
  logError,
} = require("./helpers");

exports.handler = async function http(req) {
  // Parsing the body to get the contents of the POST request
  let body = parseBody(req);
  // didUpsell tracks whether we asked for support or not
  let didUpsell = false;
  try {
    // if the request is empty, we just throw an error
    if (!body) throw new Error(600);

    // Check versions
    checkClientVersion(body);

    // 1. Check if the body contains the field url
    checkBodyUrl(body);

    // 2. Check if the field url in the body is a url
    const url = body.url;
    checkIsUrl(url);

    // 3. Check if twitter URL
    checkIfTwitterUrl(url);

    // 4. Check if the URL contains a video
    // Getting the Tweet Path
    const tweetPath = getTweetPath(url);
    if (!tweetPath) throw new Error(604);

    // 5. Prepare api request url
    const requestUrl = getApiRequestUrl(tweetPath);

    let data;
    data = await axios({
      method: "get",
      url: requestUrl,
      headers: {
        authorization: `Bearer ${process.env.TOKEN}`,
      },
    });

    data = data.data;

    checkIfContainsVideoOrGif(data);

    // Getting bitrate to calculate the size of the video
    let bitrates = getBitrate(data);

    // creating the download object to send back
    let downloadObject = makeDownloadObject(data, bitrates);

    // adding some more structure to the download object
    downloadObject = sanitize(downloadObject);

    // appending asking for support
    downloadObject = appendAskForSupport(downloadObject);

    if (downloadObject["sell"] === true) didUpsell = true;

    downloadObject = appendLatestVersionInformation(downloadObject, body.ver);

    return {
      headers: {
        "content-type": "application/json; charset=utf8",
      },
      body: JSON.stringify(downloadObject),
      statusCode: 200,
    };
  } catch (e) {
    // console.error("error message", e.message);
    let errorMessages = {
      600: "Empty request.",
      601: "No URL found.",
      602: "Not a URL.",
      603: "Not a Twitter URL.",
      604: "Not a tweet.",
      605: "Video / GIF not found.",
      606: "Shortcut compromised.",
      607: "Outdated shortcut version.",
    };

    let error;

    // creating the error message that'll be sent back
    if (errorMessages[e.message]) {
      error = {
        error:
          errorMessages[e.message] +
          " Try Again. If problem persists, please go to www.tvdl.app to update / reset your shortcut.",
      };
    } else {
      error = {
        error:
          "An unexpected error occurred. Try again. If problem persists, please send an email to help@tvdl.app for more help",
      };
    }

    // Logging errors with 603, 605 and some unexpected errors
    if (
      e.message === "603" ||
      e.message === "605" ||
      !errorMessages[e.message]
    ) {
      // console.log("logging error");
      let message;
      if (e.message === "603") message = `${e.message}: Not a Twitter URL.`;
      else if (e.message === "605")
        message = `${e.message}: Video / GIF not found.`;
      else message = `Unexpected Error: ${e.message}`;
      await logError({
        body,
        message,
      });
    }

    // returning the error
    return {
      headers: {
        "content-type": "application/json; charset=utf8",
      },
      body: JSON.stringify(error),
      statusCode: 400,
    };
  } finally {
    // Save data in db here
    // table = requests
    // key = date
    // prop = total number of requests today
    // value = number of requests today

    let table = "requests";
    let key = lightFormat(toDate(Date.now()), "yyyy-MM-dd");
    await data.incr({ table, key, prop: "totalRequests" });
    if (didUpsell) await data.incr({ table, key, prop: "totalUpsells" });
  }
};
