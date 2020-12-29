# Remarkable Glitch App

This is a app / backend service that can manage content on your reMarkable tablet. It has these features:
 - Gather new items from a set of RSS feeds, format them, bundle them into an ePUB and upload it to reMarkable cloud
 - Recieve a webpage (passed through Safari reader mode) from an iPhone shortcut, convert to ePUB and upload to reMarkable cloud
 - Sync a reMarkable cloud to Google Drive with folder structure, converting custom reMarkable format to PDFs

## Get Started
1. Remix the project
2. **IMPORTANT!** Be sure to set _Project permissions_ to 'Private' (in the Share modal). Your project database will contain your Remarkable token, which is equivalent to a password to all your files; do not share the project with anyone you wouldn't share your password with.
3. Set an environment variable in .env: SESSION_SECRET=\< a random string \>
4. In the project menu, open the _live site_ URL in your browser.
5. Signup as a user
6. Follow the link to connect your Remarkable token.

## Using The App
There's no UX for configuring the app today, I'm too lazy sorry. To update the configuration, modify your preferred settings in <code>src/controllers/intern.js</code>, then load \<your site\>/intern/setconfig to update.

## Known Issues
1. Have to reconnect Google account frequently (weekly?) at the moment. I because it's a test app.
