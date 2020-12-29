// One way sync from Remarkable to Google Drive

// Pull out the folders only
// Create a tree
// Walk Remark tree
// - if folder doesn't exist, create it
// - if folder has a new name, rename it
// - if folder has been deleted, delete it

// Iterate over Remark files
// - if version is same, continue
// - if file has new name, rename it
// - if file has new parent, move it
// - if file has changed, download new version

// Iterate over files in Drive
// - if not exists in Remark files: delete it

const execSync = require("child_process").execSync;
const { Readable } = require("stream");

const fs = require("fs");

var JSZip = require("jszip");
const tempy = require("tempy");
const got = require("got");
const util = require("util");
const stream = require("stream");

const { DateTime } = require("luxon");

const pipeline = util.promisify(stream.pipeline);

const { google } = require("googleapis");

const googleme = require("./google");
const { getRemarkableClient, getFolderNameToId } = require("./remarkable");
const { setPref, getPref } = require("../models/remarkable-prefs");

const SYNC_LAST_HASH = "syncLastHash";
const GFOLDER_MIME = "application/vnd.google-apps.folder";

const ITEMFIELDS = "id, name, parents, mimeType, modifiedTime, appProperties";

const BATCH_SIZE = 5;

const MAX_DEAD_FILES = 30;

async function syncToDrive(user, args) {
  const lastSyncHash = await getPref(user, SYNC_LAST_HASH);
  const remarkClient = await getRemarkableClient(user);
  var remarkAllItems = await remarkClient.getAllItems();

  const hashArr = [];
  remarkAllItems.forEach((item) => {
    hashArr.push({
      id: item.ID,
      Version: item.Version,
      ModifiedClient: item.ModifiedClient,
    });
  });
  const remarkHash = hashCode(hashArr);
  if (remarkHash == lastSyncHash) {
    console.log(`Done: No change in remarkable data`);
    console.log(`${JSON.stringify(args)}, ${!args["force"]}`)
    return { success: true, deferred: true };
  }

  const REMARK_ROOT_ID = "";
  const remarkFolders = remarkAllItems.filter(
    (f) => f.Type == "CollectionType"
  );
  var folderBuffer = remarkFolders.filter((f) => f.Parent == REMARK_ROOT_ID);

  const oauth2Client = await googleme.getAuth(user);
  const drive = google.drive({
    version: "v3",
    auth: oauth2Client,
  });

  var dupeFiles = [];
  var remarkIdToGDriveItem = {
    "": { id: process.env.REMARKABLE_MIRROR_FOLDER, seenOnRemarkable: true },
    ...(await getFilesInGDriveFolder(
      drive,
      process.env.REMARKABLE_MIRROR_FOLDER,
      dupeFiles
    )),
  };

  while (folderBuffer.length > 0) {
    var folder = folderBuffer.shift();
    // BFS - add the child folders of this folder onto buffer
    folderBuffer = folderBuffer.concat(
      remarkFolders.filter(
        (f) => f.Parent == folder.ID && f.Type == "CollectionType"
      )
    );

    var folderMetadata = {
      name: folder.VissibleName,
      modifiedTime: folder.ModifiedClient,
      mimeType: GFOLDER_MIME,
      appProperties: {
        ID: folder.ID,
        Version: folder.Version,
        VissibleName: folder.VissibleName,
        Type: folder.Type,
        CurrentPage: folder.CurrentPage,
        Bookmarked: folder.Bookmarked.toString(), // lol
        Parent: folder.Parent,
        ModifiedClient: folder.ModifiedClient,
      },
    };

    var gFolder = remarkIdToGDriveItem[folder.ID];

    var gFolderParents = [remarkIdToGDriveItem[folder.Parent].id];

    if (gFolder == null) {
      console.log(`Folder: create for ${JSON.stringify(folder)}`);

      var res = await drive.files.create({
        resource: { ...folderMetadata, parents: gFolderParents },
        resource: folderMetadata,
        fields: ITEMFIELDS,
      });
      gFolder = res.data;
      remarkIdToGDriveItem[folder.ID] = gFolder;

      console.log(`CREATED!!: ${JSON.stringify(gFolder, null, 2)}`);
    }

    // Get contents of folder
    remarkIdToGDriveItem = {
      ...remarkIdToGDriveItem,
      ...(await getFilesInGDriveFolder(drive, gFolder.id, dupeFiles)),
    };

    if (folder.VissibleName != gFolder.name) {
      console.log(
        `Folder: update name for ${JSON.stringify(
          folder,
          null,
          2
        )}: ${JSON.stringify(gFolder, null, 2)}`
      );
      var res = await drive.files.update({
        fileId: gFolder.id,
        name: folder.VissibleName,
        fields: ITEMFIELDS,
      });
      gFolder = res.data;
      remarkIdToGDriveItem[folder.ID] = gFolder;
    }

    if (remarkIdToGDriveItem[folder.Parent].id != gFolder.parents[0]) {
      console.log(
        `Folder: update parent for ${JSON.stringify(
          folder,
          null,
          2
        )}: ${JSON.stringify(gFolder, null, 2)} | ${
          remarkIdToGDriveItem[folder.Parent].id
        } != ${gFolder.parents[0]}`
      );
      var previousParents = gFolder.parents.join(",");
      var res = await drive.files.update({
        fileId: gFolder.id,
        addParents: gFolderParents,
        removeParents: previousParents,
        fields: ITEMFIELDS,
      });
      gFolder = res.data;
      remarkIdToGDriveItem[folder.ID] = gFolder;
    }

    var timestamp = DateTime.fromISO(folder.ModifiedClient).toUTC().toISO(); // Remark timestamp has more decimal places :-/
    var appPropsEqual = objEqualUnordered(
      gFolder.appProperties || {},
      folderMetadata.appProperties
    );

    if (
      folder.VissibleName != gFolder.name ||
      timestamp != gFolder.modifiedTime ||
      !appPropsEqual
    ) {
      console.log(
        `File: metadata changed (name: ${
          folder.VissibleName != gFolder.name
        } ts: ${timestamp != gFolder.modifiedTime} props: ${!appPropsEqual} `
      );
      console.log(`${JSON.stringify(gFolder.appProperties)}`);
      console.log(`${JSON.stringify(folderMetadata.appProperties)}`);
      var res = await drive.files.update({
        fileId: gFolder.id,
        resource: folderMetadata,
        fields: ITEMFIELDS,
      });
      gFolder = res.data;
      remarkIdToGDriveItem[folder.ID] = gFolder;
      console.log(`gFolder: ${JSON.stringify(gFolder, null, 2)}`);
    }

    gFolder.seenOnRemarkable = true;
  }

  // Remove dead folders
  const deadFolders = Object.values(remarkIdToGDriveItem).filter(
    (f) => f.mimeType == GFOLDER_MIME && f.seenOnRemarkable != true
  );
  await Promise.all(
    deadFolders.map(async (gFolder) => {
      console.log(
        `Folder: deleting non-existent folder ${JSON.stringify(
          gFolder,
          null,
          2
        )}`
      );
      await drive.files.delete({
        fileId: gFolder.id,
      });
      delete remarkIdToGDriveItem[gFolder.appProperties.ID];
    })
  );

  console.log("DONE with folders");

  if (dupeFiles.length > 10) {
    console.log(`Whoa! Too many dupefiles ${dupeFiles.length}??`);
  } else if (dupeFiles.length > 0) {
    console.log(`Delete ${dupeFiles.length} duplicate files`);
    await Promise.all(
      dupeFiles.map(async (gFile) => {
        console.log(
          `File: deleting duplicate file ${JSON.stringify(gFile, null, 2)}`
        );
        await drive.files.delete({
          fileId: gFile.id,
        });
      })
    );
  }

  // -------------------------------------------
  // Sync all files

  const remarkFiles = remarkAllItems.filter((f) => f.Type == "DocumentType");

  while (remarkFiles.length) {
    await Promise.all(
      remarkFiles.splice(0, BATCH_SIZE).map(async (file) => {
        // console.log(`Syncing file: ${file.VissibleName}`);

        if (file.Parent == "trash") {
          // console.log("File: ignoring in trash");
          return;
        }

        var gFile = remarkIdToGDriveItem[file.ID];

        var fileMetadata = {
          name: file.VissibleName,
          modifiedTime: file.ModifiedClient,
          appProperties: {
            ID: file.ID,
            Version: file.Version,
            VissibleName: file.VissibleName,
            Type: file.Type,
            CurrentPage: file.CurrentPage,
            Bookmarked: file.Bookmarked.toString(), // lol
            Parent: file.Parent,
            ModifiedClient: file.ModifiedClient,
          },
        };

        if (remarkIdToGDriveItem[file.Parent]) {
          var gParents = [remarkIdToGDriveItem[file.Parent].id];
        } else {
          console.log(
            `File: couldn't find parent??: ${JSON.stringify(file, null, 2)}`
          );
          return;
        }

        if (gFile == null) {
          console.log("File: No matching gFile found, uploading");
          console.log(`File: ${JSON.stringify(file, null, 2)}`);
          var media = await prepFileForUpload(remarkClient, file, fileMetadata);
          if (
            media.mimeType.endsWith("epub") &&
            !fileMetadata.name.endsWith("epub")
          ) {
            fileMetadata.name = fileMetadata.name + ".epub";
          }
          var res = await drive.files.create({
            resource: { ...fileMetadata, parents: gParents },
            media: media,
            fields: ITEMFIELDS,
            ocrLanguage: "en",
          });
          gFile = res.data;
          remarkIdToGDriveItem[file.ID] = gFile;
          console.log(`gFile uploaded: ${JSON.stringify(gFile, null, 2)}`);
        }

        if (file.Version != gFile.appProperties.Version) {
          console.log(
            `File: version mismatch ${JSON.stringify(
              file,
              null,
              2
            )} > ${JSON.stringify(gFile, null, 2)} | syncing`
          );
          var media = await prepFileForUpload(remarkClient, file, fileMetadata);
          if (
            media.mimeType.endsWith("epub") &&
            !fileMetadata.name.endsWith("epub")
          ) {
            fileMetadata.name = fileMetadata.name + ".epub";
          }
          var res = await drive.files.update({
            fileId: gFile.id,
            resource: fileMetadata,
            media: media,
            fields: ITEMFIELDS,
            ocrLanguage: "en",
          });
          gFile = res.data;
          remarkIdToGDriveItem[file.ID] = gFile;
          console.log(`gFile: ${JSON.stringify(gFile, null, 2)}`);

          console.log("File - Did it really update?");
          var x = await getFilesInGDriveFolder(drive, gFile.parents[0]);
          console.log(`${JSON.stringify(x[file.ID], null, 2)}`);
        }

        if (gParents != gFile.parents[0]) {
          console.log("File: parents mismatch (file moved)");
          var previousParents = gFile.parents.join(",");
          var res = await drive.files.update({
            fileId: gFile.id,
            addParents: gParents,
            removeParents: previousParents,
            fields: ITEMFIELDS,
          });
          gFile = res.data;
          remarkIdToGDriveItem[file.ID] = gFile;
          console.log(`gFile updated: ${JSON.stringify(gFile, null, 2)}`);
        }

        var appPropsEqual = objEqualUnordered(
          gFile.appProperties || {},
          fileMetadata.appProperties
        );

        if (!appPropsEqual) {
          console.log(`File: metadata changed | syncing`);
          console.log(`${JSON.stringify(gFile.appProperties)}`);
          console.log(`${JSON.stringify(fileMetadata.appProperties)}`);
          var res = await drive.files.update({
            fileId: gFile.id,
            resource: fileMetadata,
            fields: ITEMFIELDS,
          });

          gFile = res.data;
          remarkIdToGDriveItem[file.ID] = gFile;
          console.log(`gFile updated: ${JSON.stringify(gFile, null, 2)}`);
        }

        gFile.seenOnRemarkable = true;
      })
    );
  }

  // Remove dead files
  const deadFiles = Object.values(remarkIdToGDriveItem).filter(
    (f) => f.mimeType != GFOLDER_MIME && f.seenOnRemarkable != true
  );
  if (deadFiles.length > MAX_DEAD_FILES) {
    console.log(`File: Way too many deadfiles?? ${deadFiles.length}`);
    console.log(`${JSON.stringify(deadFiles, null, 2)}`);
  } else if (deadFiles.length > 0) {
    console.log(`File: Found ${deadFiles.length} dead files`);
    await deadFiles.forEach(async (gFile) => {
      console.log(
        `file: deleting non-existent file ${JSON.stringify(gFile, null, 2)}`
      );
      await drive.files.delete({
        fileId: gFile.id,
      });
    });
  }

  console.log("DONE with files");
  await setPref(user, SYNC_LAST_HASH, remarkHash);
  return { success: "true" };
}

async function getFilesInGDriveFolder(drive, folderId, dupeFiles) {
  var nextPageToken = null;
  var gItemByRemarkId = {};

  while (true) {
    const query = await drive.files.list({
      spaces: "drive",
      fileId: folderId,
      fields: `nextPageToken, files(${ITEMFIELDS})`,
      q: `'${folderId}' in parents and trashed = false`,
      pageToken: nextPageToken,
    });

    const filesInBackup = query.data.files;

    // Find duplicates
    Object.values(filesInBackup).forEach((gItem) => {
      if (
        gItem.appProperties != null &&
        gItemByRemarkId[gItem.appProperties.ID] == null
      ) {
        gItemByRemarkId[gItem.appProperties.ID] = gItem;
      } else {
        // This is a duplicate or bad file
        if (dupeFiles != null) {
          dupeFiles.push(gItem);
        }
      }
    });

    nextPageToken = query.data.nextPageToken;
    if (!nextPageToken) break;
  }

  return gItemByRemarkId;
}

async function prepFileForUpload(remarkClient, file, fileMetadata) {
  const tmpZip = tempy.file({ extension: "zip" });
  const zipBuffer = await remarkClient.downloadZip(file.ID);
  fs.writeFileSync(tmpZip, zipBuffer);

  var fileBody = null;
  var mimeType = null;

  var zip = await JSZip.loadAsync(fs.readFileSync(tmpZip));

  if (zip.file(/\.pdf/).length == 1) {
    try {
      const tmpPDF = tempy.file({ extension: "pdf" });
      execSync(`python3 -m rmrl ${tmpZip} ${tmpPDF}`);
      fileBody = fs.createReadStream(tmpPDF);
      mimeType = "application/pdf";
    } catch {
      // ruh roh - just send the pdf
      fileBody = await zip.file(/\.pdf/)[0].nodeStream();
      mimeType = "application/pdf";
    }
  } else if (zip.file(/\.epub/).length == 1) {
    fileBody = await zip.file(/\.epub/)[0].nodeStream();
    mimeType = "application/zip+epub";
  }
  if (fileBody == null) {
    // Meh, send the Zip I guess
    fileBody = fs.createReadStream(tmpZip);
    mimeType = "application/zip";
  }

  var media = {
    mimeType: mimeType,
    body: fileBody,
  };

  return media;
}

function objEqualUnordered(o1, o2) {
  var k1 = Object.keys(o1).sort();

  if (k1.length != Object.keys(o2).length) return false;

  return k1.every(function (key, index) {
    return o1[key] == o2[key];
  });
}

exports.syncToDrive = syncToDrive;
exports.jobFuncs = {
  "sync:syncToDrive": syncToDrive,
};

function hashCode(obj) {
  return JSON.stringify(obj)
    .split("")
    .reduce(
      (prevHash, currVal) =>
        ((prevHash << 5) - prevHash + currVal.charCodeAt(0)) | 0,
      0
    );
}
