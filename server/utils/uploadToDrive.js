

const { googleDriveClient } = require('../middleware/googleAuth');
const stream = require('stream');

/**
 * Uploads a file to Google Drive
 * @param {Object} file - File object with buffer, originalname, mimetype, size
 * @returns {Promise<Object>} - Object containing file metadata and links
 */
const uploadToDrive = async (file) => {
  if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new Error('Invalid file buffer');
  }

  // Upload to Google Drive
  const driveResponse = await googleDriveClient.files.create({
    requestBody: {
      name: file.originalname,
      mimeType: file.mimetype
    },
    media: {
      mimeType: file.mimetype,
      body: stream.Readable.from(file.buffer)
    },
    fields: 'id'
  });

  const fileId = driveResponse.data.id;

  // Set public read permission
  await googleDriveClient.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });

  // Get file links
  const { data: metadata } = await googleDriveClient.files.get({
    fileId,
    fields: 'webViewLink, webContentLink'
  });

  return {
    fileId,
    webViewLink: metadata.webViewLink,
    webContentLink: metadata.webContentLink,
    filename: file.originalname,
    size: file.size,
    mimeType: file.mimetype
  };
};

/**
 * Deletes a file from Google Drive
 * @param {string} fileId - Google Drive file ID
 */
const deleteFromDrive = async (fileId) => {
  await googleDriveClient.files.delete({ fileId });
};

module.exports = {
  uploadToDrive,
  deleteFromDrive
};