const { googleDriveClient } = require('../middleware/googleAuth');
const stream = require('stream');

const uploadToDrive = async (file) => {
  if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new Error('Invalid file buffer');
  }

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

  await googleDriveClient.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });

  await new Promise((res) => setTimeout(res, 1000));

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

const deleteFromDrive = async (fileId) => {
  await googleDriveClient.files.delete({ fileId });
};

module.exports = {
  uploadToDrive,
  deleteFromDrive
};
