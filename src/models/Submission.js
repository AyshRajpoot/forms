// src/models/Submission.js
const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    form: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true },
    // Store submitted field values; can be any JSON object
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    // Backward-compatibility with previous admin UI expecting "answers"
    answers: { type: mongoose.Schema.Types.Mixed, default: undefined },
    // Optional file references (if file uploads are stored separately, e.g., GridFS)
    files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FileUpload' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Submission', submissionSchema);
