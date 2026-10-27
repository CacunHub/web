// Roblox headshot for a userId (the browser can't call Roblox's thumbnail API directly, so we do it here).
// GET /api/avatar?id=123456  ->  302 to the image (cached for an hour)
"use strict";
module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || "");
  if (!/^\d{1,15}$/.test(id)) { res.statusCode = 400; return res.end("bad id"); }
  try {
    const r = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png&isCircular=false`);
    const j = await r.json();
    const url = j && j.data && j.data[0] && j.data[0].imageUrl;
    if (!url || !/^https:\/\/[a-z0-9.-]+\.rbxcdn\.com\//i.test(url)) { res.statusCode = 404; return res.end("no image"); }
    res.statusCode = 302;
    res.setHeader("Location", url);
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return res.end();
  } catch {
    res.statusCode = 502; return res.end("roblox unreachable");
  }
};
