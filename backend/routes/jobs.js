const express = require('express');
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const { authOrApiKey } = require('../middleware/auth');
const {
  uploadJob,
  getJob,
  getJobsByPrinter,
  updateJobStatus,
  serveFile,
} = require('../controllers/jobController');

const router = express.Router();

router.post('/upload', upload.single('file'), uploadJob);
router.get('/:id', getJob);
router.get('/:id/file', authOrApiKey, serveFile);
router.get('/printer/:printerId', authOrApiKey, getJobsByPrinter);
router.patch('/:id/status', authOrApiKey, updateJobStatus);

module.exports = router;
