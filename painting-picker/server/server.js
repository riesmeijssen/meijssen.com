const express = require("express");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = 3000;

// 🔐 CONFIG
const PASSWORD = "familie123"; // <-- verander dit als je wilt

// 📂 Paths
const DATA_DIR = path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// ✅ Zorg dat data map bestaat
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ✅ Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR));

// 🔐 Login endpoint
app.post("/api/login", (req, res) => {
  const { password } = req.body;

  if (password === PASSWORD) {
    res.cookie("auth", "true", { httpOnly: true });
    return res.json({ success: true });
  }

  res.status(401).json({ success: false, message: "Fout wachtwoord" });
});

// 🔐 Auth check middleware
function requireAuth(req, res, next) {
  if (req.cookies.auth === "true") {
    return next();
  }
  res.status(401).json({ message: "Niet ingelogd" });
}

// 🖼️ Schilderijen ophalen
app.get("/api/paintings", requireAuth, (req, res) => {
  const paintingsFile = path.join(DATA_DIR, "paintings.json");

  if (!fs.existsSync(paintingsFile)) {
    return res.json([]);
  }

  const paintings = JSON.parse(fs.readFileSync(paintingsFile));
  const responsesFile = path.join(DATA_DIR, "responses.json");

  let responses = [];
  if (fs.existsSync(responsesFile)) {
    responses = JSON.parse(fs.readFileSync(responsesFile));
  }

  // tel likes
  const likeCounts = {};
  responses.forEach(r => {
    (r.likes || []).forEach(id => {
      likeCounts[id] = (likeCounts[id] || 0) + 1;
    });
  });

  const result = paintings.map(p => ({
    ...p,
    likes: likeCounts[p.id] || 0
  }));

  res.json(result);
});

// 💾 Opslaan keuzes
app.post("/api/responses", requireAuth, (req, res) => {
  const { name, likes, ranking } = req.body;

  if (!name || !likes || !ranking) {
    return res.status(400).json({ message: "Ongeldige data" });
  }

  const responsesFile = path.join(DATA_DIR, "responses.json");

  let responses = [];
  if (fs.existsSync(responsesFile)) {
    responses = JSON.parse(fs.readFileSync(responsesFile));
  }

  responses.push({
    name,
    likes,
    ranking,
    timestamp: new Date().toISOString()
  });

  fs.writeFileSync(responsesFile, JSON.stringify(responses, null, 2));

  res.json({ success: true });
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});