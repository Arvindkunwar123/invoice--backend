const pdf = require("pdf-poppler");
const path = require("path");
const fs = require("fs");

async function convertPdfToImage(pdfPath) {
  const outputDir = path.join(__dirname, "uploads");

  const opts = {
    format: "jpeg",
    out_dir: outputDir,
    out_prefix: path.basename(pdfPath, path.extname(pdfPath)),
    page: 1 // first page only (invoice is usually 1 page)
  };

  await pdf.convert(pdfPath, opts);

  const imagePath = path.join(
    outputDir,
    `${path.basename(pdfPath, path.extname(pdfPath))}-1.jpg`
  );

  return imagePath;
}

module.exports = convertPdfToImage;
