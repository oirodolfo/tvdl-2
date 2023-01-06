let arc = require("@architect/functions");
let parseBody = arc.http.helpers.bodyParser;
let axios = require("axios");
const parse = require("url-parse");

exports.handler = async function http(req) {
  let body = parseBody(req);
  try {
    let url = body.url;
    const tweetPath = parse(url).pathname.split("/")[3];
    const requestUrl = `https://api.twitter.com/1.1/statuses/show.json?id=${tweetPath}&tweet_mode=extended`;

    let data;
    data = await axios({
      method: "get",
      url: requestUrl,
      headers: {
        authorization: `Bearer ${process.env.TOKEN}`,
      },
    });

    data = data.data;

    return {
      headers: {
        "content-type": "application/json; charset=utf8",
      },
      body: JSON.stringify(data),
      statusCode: 200,
    };
  } catch (e) {
    console.error("error message", e.message);

    return {
      headers: {
        "content-type": "application/json; charset=utf8",
      },
      body: JSON.stringify(e.message),
      statusCode: 400,
    };
  }
};
