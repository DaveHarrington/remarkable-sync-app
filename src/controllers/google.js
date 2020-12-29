// Connect to Google API
//
// You'll need to create a project here: https://console.cloud.google.com/
// Give it "https://www.googleapis.com/auth/drive" scope
// Then copy the Client ID into .env: GOOGLE_OAUTH2_CLIENT_ID
// and Secret to .env: GOOGLE_OAUTH2_CLIENT_SECRET

// API reference: https://developers.google.com/drive/api/v3/reference/files/list

var express = require("express");
var router = express.Router();
const request = require("request");

const { google } = require("googleapis");

const { getToken, storeToken, deleteToken, GOOGLE } = require("../models/tokens");

const URL_BASE = "/google";

const scopes = [
  "https://www.googleapis.com/auth/drive"
];

router.get("/login", async (req, res) => {
  res.send(`Hello<br><a href="${URL_BASE}/auth">Log in with Google</a>`);
});

router.get("/done", async (req, res) => {
  res.send("Google auth done!");
});

// Initial page redirecting to Google
router.get("/auth", async (req, res) => {
  const client = await getClient();
  const authorizeUrl = client.generateAuthUrl({
    access_type: "offline",
//    prompt: "consent",
    scope: scopes
  });
  res.redirect(authorizeUrl);
});

router.get("/oauthcallback", async (req, res) => {
  console.log("Oauth Callback");
  console.log(req.query);
  const { code } = req.query;
  const client = await getClient();
  const { tokens } = await client.getToken(code);
  
  console.log(tokens);
  
  await storeToken(req.user, GOOGLE, tokens);

  res.redirect(`${URL_BASE}/done`);
});

async function getClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH2_CLIENT_ID,
    process.env.GOOGLE_OAUTH2_CLIENT_SECRET,
    `https://remarkable-syncer.glitch.me${URL_BASE}/oauthcallback`
  );

  google.options({ auth: oauth2Client });
  return oauth2Client;
}

async function getAuth(user) {
  const tokens = await getToken(user, GOOGLE);
  
  if (tokens == null) {
    throw "Missing credentials for Google Auth - need to reauth";
  }
  if (tokens["refresh_token"] == null) {
    throw "Missing refresh token - need to full re-auth :( https://myaccount.google.com/permissions";
  }

  const client = await getClient();
  client.credentials = tokens;
  return client;
}

exports.getAuth = getAuth;

exports.router = router;
