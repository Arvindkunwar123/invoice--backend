const ExcelJS = require("exceljs");

module.exports = async (invoices, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Invoices");

  worksheet.columns = [
    { header: "Invoice No", key: "invoiceNumber", width: 20 },
    { header: "Vendor", key: "vendor", width: 25 },
    { header: "Date", key: "date", width: 15 },
    { header: "Total Amount", key: "totalAmount", width: 15 },
    { header: "GST", key: "gst", width: 10 },
    { header: "Confidence", key: "confidence", width: 12 },
    { header: "Status", key: "status", width: 18 },
    { header: "Created At", key: "createdAt", width: 25 }
  ];

  invoices.forEach(inv => worksheet.addRow(inv));

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=invoices.xlsx"
  );

  await workbook.xlsx.write(res);
  res.end();
};

