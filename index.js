require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dns = require("dns");
const crypto = require("crypto");

const app = express();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use("/public", express.static(`${process.cwd()}/public`));

app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

//Middleware
app.use(express.urlencoded({ extended: true }));

//Schema
const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: String, required: true, unique: true },
});

//Model
const Url = mongoose.model("Url", urlSchema);

//Shorten Url function
function generateShortUrl(url) {
  const salt = process.env.SALT || "SpecialSaltFromSaltBabe";
  return crypto
    .createHash("sha1")
    .update(url + salt)
    .digest("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 8);
}

// Your first API endpoint
app.get("/api/hello", function (req, res) {
  res.json({ greeting: "hello API" });
});

//API POST short URL
app.post("/api/shorturl", async (req, res) => {
  const inputUrl = req.body.url;

  try {
    const hostname = new URL(inputUrl).hostname;

    dns.lookup(hostname, async (err) => {
      if (err) {
        return res.json({ error: "invalid url" });
      }

      const shortUrl = generateShortUrl(inputUrl);

      const record = await Url.findOneAndUpdate(
        { original_url: inputUrl },
        { original_url: inputUrl, short_url: shortUrl },
        { new: true, upsert: true } //upsert avoid duplicate
      );

      res.json({
        original_url: record.original_url,
        short_url: record.short_url,
      });
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid URL" });
  }
});

app.get("/api/shorturl/:short", async (req, res) => {
  try {
    const record = await Url.findOne({ short_url: req.params.short });
    if (!record) {
      return res.json({ error: "No short URL found" });
    }
    return res.redirect(record.original_url);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
