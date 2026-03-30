const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema({
  invoiceNo: String,
  vendor: String,
  amount: Number,
  date: String,
  rawText: String,

  filePath: String,

  processingStatus: {
    type: String,
    enum: ["PROCESSING", "COMPLETED"],
    default: "PROCESSING",
  },

  signatureDetected: {
    type: Boolean,
    default: false,
  },

  status: {
    type: String,
    enum: ["APPROVED", "MANUAL_REVIEW", "REJECTED"],
    default: "MANUAL_REVIEW",
  },

  duplicate: {
    type: Boolean,
    default: false,
  },

  fraudFlag: {
    type: String,
    default: "NONE",
  },

  actionHistory: [
    {
      action: String,
      by: String,
      at: Date,
    },
  ],

  confidence: {
    type: Number,
    default: 90,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ADD INDEX HERE (OUTSIDE SCHEMA)
InvoiceSchema.index({ invoiceNo: 1 });
InvoiceSchema.index({ vendor: 1 });
InvoiceSchema.index({ status: 1 });

module.exports = mongoose.model("Invoice", InvoiceSchema);

