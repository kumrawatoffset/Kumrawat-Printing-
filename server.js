const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "Kumrawat@123";

const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
const dbFile = path.join(dataDir, "orders.json");
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, "[]");

function readOrders() {
  try { return JSON.parse(fs.readFileSync(dbFile, "utf8")); }
  catch { return []; }
}
function writeOrders(orders) {
  fs.writeFileSync(dbFile, JSON.stringify(orders, null, 2));
}
function orderNo() {
  return "KOP-" + new Date().toISOString().slice(0,10).replaceAll("-","") + "-" +
    crypto.randomBytes(3).toString("hex").toUpperCase();
}
function safe(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + crypto.randomBytes(4).toString("hex") + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /\.(pdf|jpg|jpeg|png|doc|docx)$/i.test(file.originalname);
    cb(ok ? null : new Error("Only PDF, JPG, PNG, DOC and DOCX files are allowed."), ok);
  }
});

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return res.status(401).set("WWW-Authenticate",'Basic realm="Kumrawat Admin"').send("Admin login required");
  const raw = Buffer.from(h.slice(6), "base64").toString();
  const i = raw.indexOf(":");
  if (i < 0 || raw.slice(0,i) !== ADMIN_USER || raw.slice(i+1) !== ADMIN_PASS) return res.status(401).set("WWW-Authenticate",'Basic realm="Kumrawat Admin"').send("Invalid login");
  next();
}

app.post("/api/orders", upload.single("file"), (req,res) => {
  try {
    const {name, phone, service, copies, size, color, notes} = req.body;
    if (!name || !phone || !service) return res.status(400).json({error:"Name, phone and service are required."});
    const order = {
      id: orderNo(), createdAt: new Date().toISOString(),
      name, phone, service, copies: copies || "1", size: size || "A4",
      color: color || "B/W", notes: notes || "",
      status: "New", payment: "Pending",
      file: req.file ? {stored:req.file.filename, original:req.file.originalname, size:req.file.size} : null
    };
    const orders = readOrders(); orders.unshift(order); writeOrders(orders);
    res.json({ok:true, orderNo:order.id});
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get("/api/orders/:id", (req,res) => {
  const o = readOrders().find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({error:"Order not found"});
  res.json({id:o.id, createdAt:o.createdAt, name:o.name, service:o.service, copies:o.copies, size:o.size, color:o.color, notes:o.notes, status:o.status, payment:o.payment, fileName:o.file?.original || null});
});

app.get("/api/admin/orders", auth, (req,res) => res.json(readOrders()));

app.patch("/api/admin/orders/:id", auth, (req,res) => {
  const orders = readOrders();
  const o = orders.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({error:"Order not found"});
  if (req.body.status) o.status = req.body.status;
  if (req.body.payment) o.payment = req.body.payment;
  writeOrders(orders);
  res.json({ok:true});
});

app.get("/api/admin/file/:id", auth, (req,res) => {
  const o = readOrders().find(x => x.id === req.params.id);
  if (!o || !o.file) return res.status(404).send("File not found");
  const p = path.join(uploadDir, o.file.stored);
  if (!fs.existsSync(p)) return res.status(404).send("Uploaded file is not available.");
  res.download(p, o.file.original);
});

app.get("/admin", (req,res) => res.sendFile(path.join(__dirname,"public","admin.html")));

app.use((err,req,res,next) => {
  if (err instanceof multer.MulterError || err.message) return res.status(400).json({error:err.message});
  next(err);
});

app.listen(PORT, () => console.log(`Kumrawat Printing running on port ${PORT}`));
