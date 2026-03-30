const express = require("express");
const multer = require("multer");
const cors = require("cors");
const connectDB = require("./db");
const Invoice = require("./invoiceModel");
const extractInvoiceData = require("./ocrService");
const convertPdfToImage = require("./pdfToImage");
const exportToExcel = require("./excelExport");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const upload = multer({ dest: "uploads/" });
//const data = await extractInvoiceData(imagePath);






connectDB();

const app = express();
app.use(cors({
  origin: "*"
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ VERY IMPORTANT FOR FILE PREVIEW
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ================= CREATE SERVER + SOCKET =================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Admin connected to realtime server");
});

// ================= USERS / ROLES =================
const users = [
  {
    email: "admin@gmail.com",
    password: bcrypt.hashSync("admin123", 10),
    role: "ADMIN",
  },
  {
    email: "review@gmail.com",
    password: bcrypt.hashSync("review123", 10),
    role: "REVIEWER",
  },
  {
    email: "view@gmail.com",
    password: bcrypt.hashSync("view123", 10),
    role: "VIEWER",
  },
];

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((u) => u.email === email);

  if (!user) {
    return res.status(400).json({ message: "Invalid login" });
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.status(400).json({ message: "Invalid login" });
  }

  const token = jwt.sign(
    { role: user.role },
    "SECRET123",
    { expiresIn: "1h" }
  );

  res.json({ token });
});

// ================= UPLOAD =================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {

    const storedFileName =
      req.file.filename + path.extname(req.file.originalname);

    const newPath = `uploads/${storedFileName}`;
    fs.renameSync(req.file.path, newPath);

    // ================= STEP 1 — CREATE PROCESSING INVOICE =================
    const processingInvoice = new Invoice({
      invoiceNo: "AUTO-" + Date.now(),
      vendor: "PROCESSING...",
      amount: 0,
      confidence: 0,
      status: "MANUAL_REVIEW",
      filePath: `/uploads/${storedFileName}`,
      actionHistory: [
        {
          action: "UPLOADED",
          by: "system",
          at: new Date(),
        },
      ],
    });

    await processingInvoice.save();

    io.emit("invoiceUpdated");

    // respond immediately (UI shows processing)
    res.json({ success: true });

    // ================= STEP 2 — RUN OCR IN BACKGROUND =================

    let imagePath = newPath;

    if (req.file.mimetype === "application/pdf") {
      imagePath = await convertPdfToImage(newPath);
    }

    const data = await extractInvoiceData(imagePath);

    // ================= DUPLICATE DETECTION =================

// check same invoice number
let duplicateInvoice = await Invoice.findOne({
  invoiceNo: data.invoiceNo,
});

// check same vendor + amount
let duplicateByVendor = await Invoice.findOne({
  vendor: data.vendor,
  amount: data.amount,
});

    const confidence = data.confidence || 90;

    // ================= FRAUD DETECTION =================

let fraudFlag = "NONE";

if (data.amount > 100000) {
  fraudFlag = "FRAUD";
}

if (data.amount > 0 && data.amount < 100) {
  fraudFlag = "SUSPICIOUS";
}
if (fraudFlag === "FRAUD") {
  status = "MANUAL_REVIEW";
}
if (fraudFlag !== "NONE") {
  processingInvoice.actionHistory.push({
    action: "FRAUD_ALERT",
    by: "system",
    at: new Date(),
  });
}

    let status = "APPROVED";

    if (confidence < 75) status = "MANUAL_REVIEW";
    if (data.amount <= 0) status = "REJECTED";
    // Signature rule
if (!data.signatureDetected) {
  status = "MANUAL_REVIEW";
}

    // ================= STEP 3 — UPDATE SAME INVOICE =================

    processingInvoice.vendor = data.vendor || "UNKNOWN";
    processingInvoice.amount = data.amount || 0;
    processingInvoice.confidence = confidence;
    processingInvoice.signatureDetected = data.signatureDetected;
    processingInvoice.status = status;
    processingInvoice.fraudFlag = fraudFlag;

    processingInvoice.actionHistory.push({
      action: "AUTO_PROCESSED",
      by: "system",
      at: new Date(),
    });

    await processingInvoice.save();

    // realtime update again
    io.emit("invoiceUpdated");
    io.emit("invoiceEvent", {
      type: "AUTO_PROCESSED",
      invoiceNo: processingInvoice.invoiceNo,
    });

  } catch (err) {
    console.error(err);
  }
});

// ================= GET INVOICES =================
app.get("/invoices", async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= EXCEL =================
app.get("/invoices/excel", async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    await exportToExcel(invoices, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= UPDATE STATUS =================
app.put("/invoices/:id/status", async (req, res) => {
  const { status } = req.body;

  const invoice = await Invoice.findById(req.params.id);

  invoice.status = status;

  // audit trail
  invoice.actionHistory.push({
    action: status,
    by: "admin",
    at: new Date(),
  });

  await invoice.save();

  //  REALTIME EVENTS
  io.emit("invoiceUpdated");
  io.emit("invoiceEvent", {
    type: status,
    invoiceNo: invoice.invoiceNo,
  });

  res.json(invoice);
});

// ================= DELETE REJECTED =================
app.delete("/invoices/rejected", async (req, res) => {
  try {
    await Invoice.deleteMany({ status: "REJECTED" });

    io.emit("invoiceUpdated");
    io.emit("invoiceEvent", {
      type: "CLEAR_REJECTED",
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete rejected invoices" });
  }
});

// ================= START SERVER =================
//server.listen(5000, () => {
 // console.log("Backend running with realtime at http://localhost:5000");
//}
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



