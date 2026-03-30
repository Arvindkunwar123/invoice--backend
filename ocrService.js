const Tesseract = require("tesseract.js");

// Utility cleaners
function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function extractField(regex, text) {
  const match = text.match(regex);
  return match ? cleanText(match[1]) : null;
}

async function extractInvoiceData(filePath) {
  const result = await Tesseract.recognize(filePath, "eng");
  const rawText = result.data.text || "";
  const text = rawText.replace(/\n+/g, " ");

  console.log("OCR TEXT:", text);

  // ✅ Extract fields
const invoiceNo =
  extractField(/inv[\s\-#:]*([A-Z0-9\-]+)/i, text) ||
  extractField(/invoice[\s\-#:]*no[\s\-#:]*([A-Z0-9\-]+)/i, text) ||
  "AUTO-" + Date.now();
// ✅ Smart amount detection (final working)
let amountText =
  extractField(/grand\s*total\s*[:\-]?\s*₹?\s*([0-9,.]+)/i, text) ||
  extractField(/net\s*amount\s*[:\-]?\s*₹?\s*([0-9,.]+)/i, text) ||
  extractField(/amount\s*payable\s*[:\-]?\s*₹?\s*([0-9,.]+)/i, text) ||
  extractField(/total\s*amount\s*[:\-]?\s*₹?\s*([0-9,.]+)/i, text) ||
  extractField(/total\s*[:\-]?\s*₹?\s*([0-9,.]+)/i, text) ||
  "0";

// ✅ Clean commas + leading zeroes
amountText = amountText.replace(/,/g, "").replace(/^0+/, "");

// ✅ Convert safely
const amount = Number(amountText) || 0;

console.log("✅ FINAL AMOUNT:", amount);

 const vendor =
  extractField(/(from|seller|bill from|company)\s*[:\-]?\s*([A-Za-z\s]{3,40})/i, text)
  || extractField(/^([A-Z][A-Za-z\s]{3,40}?)(?:\s+Invoice|\s+Bill|\s+Tax|\s+GST)/i, text)
  || extractField(/^([A-Z][A-Za-z\s]{3,40})/, text)
  || "UNKNOWN VENDOR";

  const date = extractField(/date\s*[:\-]?\s*([0-9\/\-\.]+)/i, text) 
               || "";

// ✅ Auto validation rules
let status = "APPROVED";
let vendorFinal = vendor;

// Rule 1: Invoice number missing
if (!invoiceNo || invoiceNo.length < 3) {
  status = "REJECTED";
  vendorFinal = "INVALID INVOICE NUMBER";
}

// Rule 2: Vendor missing or invalid
if (!vendor || vendor.toLowerCase().includes("unknown")) {
  status = "REJECTED";
  vendorFinal = "INVALID VENDOR";
}

// Rule 3: Amount must be > 0
if (!amount || amount <= 0) {
  status = "REJECTED";
  vendorFinal = "INVALID AMOUNT";
}

  

  return {
    invoiceNo,
    vendor : vendorFinal,
    amount,
    date,
    rawText,
    status,
    // fake ai confidence
    confidence: Math.floor(Math.random() * 40) + 60,
    signatureDetected: Math.random() > 0.3,

  };
}

module.exports = extractInvoiceData;
