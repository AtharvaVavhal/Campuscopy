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
  getOrderHistory,
} = require('../controllers/jobController');

const router = express.Router();

router.post('/upload', upload.single('file'), uploadJob);
router.get('/by-phone/:phone', getOrderHistory);       // must be before /:id
router.get('/printer/:printerId', authOrApiKey, getJobsByPrinter);
router.get('/:id', getJob);
router.get('/:id/file', authOrApiKey, serveFile);
router.patch('/:id/status', authOrApiKey, updateJobStatus);

module.exports = router;